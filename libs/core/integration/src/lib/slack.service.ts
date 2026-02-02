import { Injectable, Logger } from '@nestjs/common';
import { SlackBoltService } from './slack-bolt.service';

export interface SlackChannelSummary {
  id: string;
  name: string;
  topic?: string;
  purpose?: string;
  isPrivate: boolean;
  memberCount: number;
}

export interface SlackMemberSummary {
  id: string;
  name: string;
  realName: string;
  email?: string;
  isAdmin: boolean;
}

export interface SlackMessageSummary {
  ts: string;
  user: string;
  text: string;
  channel: string;
}

@Injectable()
export class SlackService {
  private readonly logger = new Logger(SlackService.name);

  constructor(private readonly slackBoltService: SlackBoltService) {}

  async listChannels(token: string): Promise<SlackChannelSummary[]> {
    const client = this.slackBoltService.getClient();

    const channels: SlackChannelSummary[] = [];
    let cursor: string | undefined;

    do {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response: any = await client.conversations.list({
        token,
        limit: 200,
        cursor,
        exclude_archived: true,
        types: 'public_channel,private_channel',
      });

      if (!response?.ok) {
        throw new Error(response?.error || 'Slack conversations.list failed');
      }

      const batch = (response.channels || []).map((channel: any) => ({
        id: channel.id,
        name: channel.name,
        topic: channel.topic?.value || undefined,
        purpose: channel.purpose?.value || undefined,
        isPrivate: Boolean(channel.is_private),
        memberCount: channel.num_members ?? 0,
      }));

      channels.push(...batch);
      cursor = response?.response_metadata?.next_cursor || undefined;
    } while (cursor);

    return channels;
  }

  async listUsers(token: string): Promise<SlackMemberSummary[]> {
    const client = this.slackBoltService.getClient();

    const members: SlackMemberSummary[] = [];
    let cursor: string | undefined;

    do {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response: any = await client.users.list({
        token,
        limit: 200,
        cursor,
      });

      if (!response?.ok) {
        throw new Error(response?.error || 'Slack users.list failed');
      }

      const batch = (response.members || [])
        .filter((member: any) => !member.deleted)
        .map((member: any) => ({
          id: member.id,
          name: member.name,
          realName:
            member.real_name || member.profile?.real_name || member.name,
          email: member.profile?.email || undefined,
          isAdmin: Boolean(member.is_admin),
        }));

      members.push(...batch);
      cursor = response?.response_metadata?.next_cursor || undefined;
    } while (cursor);

    return members;
  }

  async fetchRecentMessages(
    token: string,
    channelId: string,
    limit = 25,
  ): Promise<SlackMessageSummary[]> {
    const client = this.slackBoltService.getClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response: any = await client.conversations.history({
      token,
      channel: channelId,
      limit,
    });

    if (!response?.ok) {
      throw new Error(response?.error || 'Slack conversations.history failed');
    }

    return (response.messages || [])
      .filter((message: any) => !message.subtype)
      .map((message: any) => ({
        ts: message.ts,
        user: message.user,
        text: message.text || '',
        channel: channelId,
      }));
  }

  async joinChannel(token: string, channelId: string): Promise<void> {
    const client = this.slackBoltService.getClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response: any = await client.conversations.join({
      token,
      channel: channelId,
    });

    if (!response?.ok) {
      throw new Error(response?.error || 'Slack conversations.join failed');
    }
  }

  async postMessage(
    token: string,
    channel: string,
    text: string,
    threadTs?: string,
  ): Promise<void> {
    const client = this.slackBoltService.getClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response: any = await client.chat.postMessage({
      token,
      channel,
      text,
      thread_ts: threadTs,
    });

    if (!response?.ok) {
      this.logger.error(
        { error: response?.error, channel },
        'Slack chat.postMessage failed',
      );
      throw new Error(response?.error || 'Slack chat.postMessage failed');
    }
  }
}
