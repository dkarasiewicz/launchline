import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface GmailMessageSummary {
  id: string;
  threadId?: string;
  snippet?: string;
  from?: string;
  to?: string;
  subject?: string;
  date?: string;
  messageIdHeader?: string;
  references?: string;
}

export interface CalendarEventSummary {
  id: string;
  summary?: string;
  start?: string;
  end?: string;
  location?: string;
  attendees?: string[];
  organizer?: string;
}

@Injectable()
export class GoogleService {
  private readonly logger = new Logger(GoogleService.name);
  private readonly googleClientId: string | undefined = this.configService.get(
    'integrations.google.clientId',
  );
  private readonly googleClientSecret: string | undefined =
    this.configService.get('integrations.google.clientSecret');

  constructor(private readonly configService: ConfigService) {}

  async refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
    tokenExpiresAt?: Date;
    tokenType?: string;
    scope?: string;
  }> {
    if (!this.googleClientId || !this.googleClientSecret) {
      throw new Error('Google integration is not configured');
    }

    if (!refreshToken) {
      throw new Error('Google refresh token is missing');
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        client_id: this.googleClientId,
        client_secret: this.googleClientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error({ error }, 'Google token refresh failed');
      throw new Error('Failed to refresh Google access token');
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await response.json();

    if (!data?.access_token) {
      this.logger.error({ data }, 'Google token refresh missing access token');
      throw new Error('Failed to refresh Google access token');
    }

    return {
      accessToken: data.access_token,
      refreshToken,
      tokenType: data.token_type || 'Bearer',
      tokenExpiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : undefined,
      scope: data.scope,
    };
  }

  async getUserProfile(accessToken: string): Promise<{
    email?: string;
    name?: string;
    id?: string;
    hostedDomain?: string;
  }> {
    const response = await fetch(
      'https://www.googleapis.com/oauth2/v3/userinfo',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      },
    );

    if (!response.ok) {
      const error = await response.text();
      this.logger.error({ error }, 'Google userinfo fetch failed');
      throw new Error('Failed to fetch Google user profile');
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await response.json();

    return {
      email: data.email,
      name: data.name,
      id: data.sub,
      hostedDomain: data.hd,
    };
  }

  async listGmailMessages(
    accessToken: string,
    options: {
      limit?: number;
      query?: string;
      labelIds?: string[];
      includeSpamTrash?: boolean;
    } = {},
  ): Promise<GmailMessageSummary[]> {
    const url = new URL(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages',
    );
    const limit = Math.min(options.limit ?? 10, 50);
    url.searchParams.set('maxResults', String(limit));

    if (options.query) {
      url.searchParams.set('q', options.query);
    }

    if (options.labelIds?.length) {
      for (const labelId of options.labelIds) {
        url.searchParams.append('labelIds', labelId);
      }
    }

    if (options.includeSpamTrash) {
      url.searchParams.set('includeSpamTrash', 'true');
    }

    const listResponse = await this.fetchJson(url.toString(), accessToken);
    const messageIds: string[] =
      listResponse?.messages?.map((item: { id: string }) => item.id) || [];

    if (!messageIds.length) {
      return [];
    }

    const detailPromises = messageIds.map((messageId) =>
      this.getGmailMessage(accessToken, messageId),
    );

    return Promise.all(detailPromises);
  }

  async getGmailMessage(
    accessToken: string,
    messageId: string,
  ): Promise<GmailMessageSummary> {
    const url = new URL(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`,
    );
    url.searchParams.set('format', 'metadata');
    ['From', 'To', 'Subject', 'Date', 'Message-Id', 'References'].forEach(
      (header) => url.searchParams.append('metadataHeaders', header),
    );

    const message = await this.fetchJson(url.toString(), accessToken);
    const headers = this.parseHeaders(message?.payload?.headers || []);

    return {
      id: message.id,
      threadId: message.threadId,
      snippet: message.snippet,
      from: headers.from,
      to: headers.to,
      subject: headers.subject,
      date: headers.date,
      messageIdHeader: headers.messageId,
      references: headers.references,
    };
  }

  async sendGmailReply(
    accessToken: string,
    input: {
      messageId: string;
      body: string;
    },
  ): Promise<{ messageId: string; threadId?: string }> {
    const message = await this.getGmailMessage(accessToken, input.messageId);

    const toAddress = this.extractEmail(message.from || '');
    if (!toAddress) {
      throw new Error('Unable to determine recipient for reply');
    }

    const subject = message.subject?.startsWith('Re:')
      ? message.subject
      : `Re: ${message.subject || 'Conversation'}`;

    const inReplyTo = message.messageIdHeader || undefined;
    const references = message.references
      ? `${message.references} ${message.messageIdHeader || ''}`.trim()
      : message.messageIdHeader;

    const rawMessage = this.buildRawEmail({
      to: toAddress,
      subject,
      body: input.body,
      inReplyTo,
      references,
    });

    const response = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          raw: rawMessage,
          threadId: message.threadId,
        }),
      },
    );

    if (!response.ok) {
      const error = await response.text();
      this.logger.error({ error }, 'Gmail reply failed');
      throw new Error('Failed to send Gmail reply');
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await response.json();

    return {
      messageId: data.id || '',
      threadId: data.threadId,
    };
  }

  async listCalendarEvents(
    accessToken: string,
    input: {
      timeMin: string;
      timeMax?: string;
      calendarId?: string;
      limit?: number;
    },
  ): Promise<CalendarEventSummary[]> {
    const calendarId = input.calendarId || 'primary';
    const url = new URL(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
        calendarId,
      )}/events`,
    );

    url.searchParams.set('singleEvents', 'true');
    url.searchParams.set('orderBy', 'startTime');
    url.searchParams.set('timeMin', input.timeMin);

    if (input.timeMax) {
      url.searchParams.set('timeMax', input.timeMax);
    }

    url.searchParams.set('maxResults', String(Math.min(input.limit ?? 10, 50)));

    const data = await this.fetchJson(url.toString(), accessToken);
    const items = data?.items || [];

    return items.map((item: any) => ({
      id: item.id,
      summary: item.summary,
      start: item.start?.dateTime || item.start?.date,
      end: item.end?.dateTime || item.end?.date,
      location: item.location,
      attendees: Array.isArray(item.attendees)
        ? item.attendees.map((attendee: any) => attendee.email).filter(Boolean)
        : undefined,
      organizer: item.organizer?.email,
    }));
  }

  async createCalendarEvent(
    accessToken: string,
    input: {
      calendarId?: string;
      summary: string;
      description?: string;
      location?: string;
      start: string;
      end: string;
      timeZone?: string;
      attendees?: string[];
    },
  ): Promise<CalendarEventSummary> {
    const calendarId = input.calendarId || 'primary';

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
        calendarId,
      )}/events`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          summary: input.summary,
          description: input.description,
          location: input.location,
          start: {
            dateTime: input.start,
            timeZone: input.timeZone,
          },
          end: {
            dateTime: input.end,
            timeZone: input.timeZone,
          },
          attendees: input.attendees?.map((email) => ({ email })),
        }),
      },
    );

    if (!response.ok) {
      const error = await response.text();
      this.logger.error({ error }, 'Calendar event creation failed');
      throw new Error('Failed to create calendar event');
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await response.json();

    return {
      id: data.id,
      summary: data.summary,
      start: data.start?.dateTime || data.start?.date,
      end: data.end?.dateTime || data.end?.date,
      location: data.location,
      attendees: Array.isArray(data.attendees)
        ? data.attendees.map((attendee: any) => attendee.email).filter(Boolean)
        : undefined,
      organizer: data.organizer?.email,
    };
  }

  private async fetchJson(url: string, accessToken: string) {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error({ error, url }, 'Google API request failed');
      throw new Error('Google API request failed');
    }

    return response.json();
  }

  private parseHeaders(
    headers: Array<{ name: string; value: string }>,
  ): {
    from?: string;
    to?: string;
    subject?: string;
    date?: string;
    messageId?: string;
    references?: string;
  } {
    const map = new Map<string, string>();

    for (const header of headers) {
      map.set(header.name.toLowerCase(), header.value);
    }

    return {
      from: map.get('from'),
      to: map.get('to'),
      subject: map.get('subject'),
      date: map.get('date'),
      messageId: map.get('message-id'),
      references: map.get('references'),
    };
  }

  private extractEmail(value: string): string | null {
    const match = value.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/);
    return match ? match[0] : null;
  }

  private buildRawEmail(input: {
    to: string;
    subject: string;
    body: string;
    inReplyTo?: string;
    references?: string;
  }): string {
    const headers = [
      `To: ${input.to}`,
      `Subject: ${input.subject}`,
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: 7bit',
    ];

    if (input.inReplyTo) {
      headers.push(`In-Reply-To: ${input.inReplyTo}`);
    }

    if (input.references) {
      headers.push(`References: ${input.references}`);
    }

    const message = `${headers.join('\r\n')}\r\n\r\n${input.body}`;

    return Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }
}
