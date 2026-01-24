'use client';

import { useEffect, useState } from 'react';
import { makeAssistantToolUI } from '@assistant-ui/react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Loader2, Mail, CalendarDays, AlertTriangle } from 'lucide-react';
import { ToolMarkdown } from '../shared';
import { cn } from '../../../lib/utils';

function ThinkingLoader({ message }: { message: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShow(true), 300);
    return () => clearTimeout(timer);
  }, []);
  if (!show) return null;
  return (
    <div className="flex items-center gap-2 text-muted-foreground py-3">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span className="text-sm">{message}</span>
    </div>
  );
}

function parseJson(result?: string) {
  if (!result) return null;
  try {
    return JSON.parse(result);
  } catch {
    return null;
  }
}

export const GetLatestEmailsToolUI = makeAssistantToolUI<
  { query?: string; labelIds?: string[]; limit?: number },
  string
>({
  toolName: 'get_latest_emails',
  render: function GetLatestEmailsUI({ args, result, status }) {
    const isRunning = status.type === 'running';

    return (
      <Card className="w-full max-w-2xl overflow-hidden my-2">
        <CardHeader className="pb-3 bg-rose-500/5">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-rose-500" />
            <CardTitle className="text-sm font-medium">
              {isRunning ? 'Checking inbox...' : 'Latest Emails'}
            </CardTitle>
            <Badge variant="secondary" className="ml-auto text-xs">
              Gmail
            </Badge>
          </div>
          {args?.query && (
            <p className="text-xs text-muted-foreground mt-1">
              Query: &quot;{args.query}&quot;
            </p>
          )}
        </CardHeader>
        <CardContent className="pt-4">
          {isRunning ? (
            <ThinkingLoader message="Fetching latest emails..." />
          ) : (
            <ToolMarkdown content={result} />
          )}
        </CardContent>
      </Card>
    );
  },
});

export const ReplyToEmailToolUI = makeAssistantToolUI<
  { messageId: string; body: string },
  string
>({
  toolName: 'reply_to_email',
  render: function ReplyToEmailUI({ result, status }) {
    const isRunning = status.type === 'running';
    const parsed = parseJson(result);
    const isError = Boolean(parsed?.error);

    return (
      <Card className="w-full max-w-2xl overflow-hidden my-2">
        <CardHeader className="pb-3 bg-rose-500/5">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-rose-500" />
            <CardTitle className="text-sm font-medium">
              {isRunning ? 'Sending reply...' : 'Email reply'}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {isRunning ? (
            <ThinkingLoader message="Sending reply..." />
          ) : isError ? (
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">{parsed.error}</span>
            </div>
          ) : (
            <div className={cn('text-sm text-foreground')}>
              Reply sent. Message ID: {parsed?.messageId || 'unknown'}
            </div>
          )}
        </CardContent>
      </Card>
    );
  },
});

export const GetCalendarEventsToolUI = makeAssistantToolUI<
  { timeMin: string; timeMax?: string },
  string
>({
  toolName: 'get_calendar_events',
  render: function GetCalendarEventsUI({ result, status }) {
    const isRunning = status.type === 'running';

    return (
      <Card className="w-full max-w-2xl overflow-hidden my-2">
        <CardHeader className="pb-3 bg-blue-500/5">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-blue-500" />
            <CardTitle className="text-sm font-medium">
              {isRunning ? 'Loading events...' : 'Calendar events'}
            </CardTitle>
            <Badge variant="secondary" className="ml-auto text-xs">
              Google Calendar
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {isRunning ? (
            <ThinkingLoader message="Fetching calendar events..." />
          ) : (
            <ToolMarkdown content={result} />
          )}
        </CardContent>
      </Card>
    );
  },
});

export const ScheduleCalendarEventToolUI = makeAssistantToolUI<
  { summary: string; start: string; end: string },
  string
>({
  toolName: 'schedule_calendar_event',
  render: function ScheduleCalendarEventUI({ result, status }) {
    const isRunning = status.type === 'running';
    const parsed = parseJson(result);
    const isError = Boolean(parsed?.error);

    return (
      <Card className="w-full max-w-2xl overflow-hidden my-2">
        <CardHeader className="pb-3 bg-blue-500/5">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-blue-500" />
            <CardTitle className="text-sm font-medium">
              {isRunning ? 'Scheduling event...' : 'Calendar event scheduled'}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {isRunning ? (
            <ThinkingLoader message="Scheduling calendar event..." />
          ) : isError ? (
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">{parsed.error}</span>
            </div>
          ) : (
            <div className="text-sm text-foreground">
              Event scheduled: {parsed?.event?.summary || 'Untitled'}
            </div>
          )}
        </CardContent>
      </Card>
    );
  },
});
