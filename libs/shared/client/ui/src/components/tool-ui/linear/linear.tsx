'use client';

/**
 * Linear Tool UIs
 *
 * UI components for Linear integration tools.
 * These display real-time data fetched from Linear.
 */

import { useState, useEffect, useMemo } from 'react';
import { makeAssistantToolUI } from '@assistant-ui/react';
import { Card, CardContent } from '../../ui/card';
import { Badge } from '../../ui/badge';
import {
  Loader2,
  AlertTriangle,
  Search,
  Users,
  Target,
  CalendarDays,
  MessageSquare,
  CheckCircle,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { ToolMarkdown } from '../shared';

// ============================================================================
// SHARED COMPONENTS
// ============================================================================

function LinearLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" fill="currentColor" className={className}>
      <path d="M1.22541 61.5228c-.2225-.9485.90748-1.5459 1.59638-.857L39.3342 97.1782c.6889.6889.0915 1.8189-.857 1.5765C20.0515 94.4522 5.54779 79.9485 1.22541 61.5228ZM.00189135 46.8891c-.01764375.2833.08887215.5599.28957165.7606L52.3503 99.7085c.2007.2007.4773.3072.7606.2896 15.8807-.9833 30.0585-9.2913 37.4814-22.9274.3013-.5536.0742-1.2561-.4913-1.5446L1.54623 9.51455c-.5765-.29373-1.29721.00803-1.57469.59185C-2.63609 16.4667-1.70172 32.1274.00189 46.8891ZM52.3503.291054c-.2833-.01764375-.5599.088872-.7606.289572L.289562 51.8907c-.200699.2007-.307194.4773-.289552.7607.973312 15.8807 9.291272 30.0585 22.92737 37.4814.55366.3012 1.25614.0742 1.54463-.4913L89.4351 1.54628c.2937-.57646-.008-1.29718-.5765-1.574692C82.5463-2.63605 66.8856-1.70168 52.3503.291054ZM99.7078 52.3479c.1764-.2833-.0891-.5599-.2896-.7606L60.9554 13.1245c-.6889-.68886-1.8189-.09154-1.5765.857 4.3024 18.4258 18.806 32.9295 37.2318 37.2318.9485.2225 1.5459-.90748.857-1.5765Z" />
    </svg>
  );
}

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

function parseJsonResult<T>(content?: string): T | null {
  if (!content) return null;
  try {
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

type ParsedIssue = {
  identifier: string;
  title: string;
  status?: string;
  priority?: string;
  assignee?: string;
  url?: string;
};

type ParsedIssueDetails = {
  identifier?: string;
  title?: string;
  fields: Record<string, string>;
  description?: string;
  subIssues?: string[];
  comments?: Array<{ author: string; date?: string; body: string }>;
};

type ParsedProjectStatus = {
  name: string;
  progress?: string;
  status?: string;
  lead?: string;
  target?: string;
  milestones?: string[];
};

type ParsedWorkload = {
  team?: string;
  entries: Array<{
    name: string;
    issues: number;
    points: number;
    urgent: number;
    unassigned?: boolean;
  }>;
};

type ParsedCycleStatus = {
  name?: string;
  progress?: string;
  timeline?: string;
  daysRemaining?: string;
  issueCounts?: Record<string, string>;
  points?: string;
  warning?: string;
};

type CreateLinearIssueArgs = {
  title: string;
  description?: string;
  teamId?: string;
  projectId?: string;
  assigneeId?: string;
  priority?: number;
  labelIds?: string[];
};

type CreateLinearIssueResult = {
  success?: boolean;
  action?: string;
  id?: string;
  identifier?: string;
  title?: string;
  url?: string;
  error?: string;
};

function extractSection(content: string, heading: string): string | null {
  const regex = new RegExp(
    `###\\s+${heading}\\s*\\n([\\s\\S]*?)(?:\\n###\\s+|$)`,
  );
  const match = content.match(regex);
  return match ? match[1].trim() : null;
}

function parseIssueList(content: string): ParsedIssue[] | null {
  const lines = content.split('\n');
  const items: ParsedIssue[] = [];
  let current: ParsedIssue | null = null;

  const flush = () => {
    if (current) {
      items.push(current);
      current = null;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    const startMatch = line.match(/^\d+\.\s+\*\*(.+?)\*\*:\s*(.+)$/);
    if (startMatch) {
      flush();
      current = {
        identifier: startMatch[1].trim(),
        title: startMatch[2].trim(),
      };
      continue;
    }

    if (!current) {
      continue;
    }

    const statusMatch = line.match(
      /^Status:\s*(.+?)(?:\s*\|\s*Priority:\s*(.+))?$/i,
    );
    if (statusMatch) {
      current.status = statusMatch[1].trim();
      if (statusMatch[2]) {
        current.priority = statusMatch[2].trim();
      }
      continue;
    }

    const assigneeMatch = line.match(/^Assignee:\s*(.+)$/i);
    if (assigneeMatch) {
      current.assignee = assigneeMatch[1].trim();
      continue;
    }

    const urlMatch = line.match(/^URL:\s*(\S+)/i);
    if (urlMatch) {
      current.url = urlMatch[1].trim();
    }
  }

  flush();

  return items.length > 0 ? items : null;
}

function parseIssueDetails(content: string): ParsedIssueDetails | null {
  const headerMatch = content.match(/^##\s*(.+)$/m);
  const header = headerMatch?.[1]?.trim();
  let identifier: string | undefined;
  let title: string | undefined;

  if (header) {
    const parts = header.split(':');
    if (parts.length >= 2) {
      identifier = parts[0].trim();
      title = parts.slice(1).join(':').trim();
    } else {
      title = header;
    }
  }

  const fields: Record<string, string> = {};
  const labels = [
    'Status',
    'Priority',
    'Assignee',
    'Labels',
    'Project',
    'Cycle',
    'Estimate',
    'Created',
    'Updated',
    'URL',
  ];

  for (const label of labels) {
    const match = content.match(
      new RegExp(`\\\\*\\\\*${label}\\\\*\\\\*:\\\\s*(.+)`),
    );
    if (match) {
      fields[label.toLowerCase()] = match[1].trim();
    }
  }

  const description = extractSection(content, 'Description');

  const subIssuesBlock = extractSection(content, 'Sub-issues');
  const subIssues = subIssuesBlock
    ? subIssuesBlock
        .split('\n')
        .map((line) => line.replace(/^[-*]\s*/, '').trim())
        .filter(Boolean)
    : undefined;

  const commentsBlock = extractSection(content, 'Recent Comments');
  let comments: ParsedIssueDetails['comments'];
  if (commentsBlock) {
    comments = commentsBlock
      .split(/\n\n(?=\\*\\*)/)
      .map((chunk) => chunk.trim())
      .filter(Boolean)
      .map((chunk) => {
        const lines = chunk.split('\n');
        const headerLine = lines[0]?.trim() || '';
        const match = headerLine.match(
          /^\*\*(.+?)\*\*\s*(?:\((.+?)\))?:?$/,
        );
        return {
          author: match?.[1] || 'Unknown',
          date: match?.[2],
          body: lines.slice(1).join('\n').trim(),
        };
      });
  }

  if (!identifier && !title && Object.keys(fields).length === 0) {
    return null;
  }

  return {
    identifier,
    title,
    fields,
    description: description || undefined,
    subIssues,
    comments,
  };
}

function parseProjectStatus(content: string): ParsedProjectStatus[] | null {
  if (!content.includes('###')) {
    return null;
  }

  const sections = content.split(/\n###\s+/).slice(1);
  const projects: ParsedProjectStatus[] = [];

  for (const section of sections) {
    const lines = section.split('\n');
    const name = lines.shift()?.trim();
    if (!name) continue;

    const body = lines.join('\n');
    const getField = (label: string) => {
      const match = body.match(
        new RegExp(`\\\\*\\\\*${label}\\\\*\\\\*:\\\\s*(.+)`),
      );
      return match?.[1]?.trim();
    };

    const milestonesIndex = lines.findIndex((line) =>
      line.includes('**Milestones**'),
    );
    let milestones: string[] | undefined;
    if (milestonesIndex >= 0) {
      milestones = lines
        .slice(milestonesIndex + 1)
        .map((line) => line.replace(/^[-*]\s*/, '').trim())
        .filter(Boolean);
    }

    projects.push({
      name,
      progress: getField('Progress'),
      status: getField('Status'),
      lead: getField('Lead'),
      target: getField('Target'),
      milestones,
    });
  }

  return projects.length > 0 ? projects : null;
}

function parseTeamWorkload(content: string): ParsedWorkload | null {
  const lines = content.split('\n');
  const entries: ParsedWorkload['entries'] = [];
  let team: string | undefined;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const headerMatch = line.match(/^##\s+Team Workload:\s+(.+)$/i);
    if (headerMatch) {
      team = headerMatch[1].trim();
      continue;
    }

    const entryMatch = line.match(
      /^\*\*(.+?)\*\*:\s*(\d+) issues,\s*(\d+) points(?:\s*\(🔴\s*(\d+) urgent\))?/,
    );
    if (entryMatch) {
      entries.push({
        name: entryMatch[1].trim(),
        issues: Number(entryMatch[2]),
        points: Number(entryMatch[3]),
        urgent: Number(entryMatch[4] || 0),
        unassigned: entryMatch[1].toLowerCase() === 'unassigned',
      });
    }
  }

  return entries.length > 0 ? { team, entries } : null;
}

function parseCycleStatus(content: string): ParsedCycleStatus | null {
  const headerMatch = content.match(/^##\s+Cycle:\s+(.+)$/m);
  if (!headerMatch) {
    return null;
  }

  const getField = (label: string) => {
    const match = content.match(
      new RegExp(`\\\\*\\\\*${label}\\\\*\\\\*:\\\\s*(.+)`),
    );
    return match?.[1]?.trim();
  };

  const issueSection = extractSection(content, 'Issues');
  const issueCounts: Record<string, string> = {};
  if (issueSection) {
    issueSection.split('\n').forEach((line) => {
      const match = line.match(/-\s+[^:]+:\s*(\d+)/);
      if (match) {
        const labelMatch = line.match(/-\s+([^:]+):\s*\d+/);
        if (labelMatch) {
          issueCounts[labelMatch[1].trim()] = match[1];
        }
      }
    });
  }

  const pointsSection = extractSection(content, 'Points');
  const pointsLine = pointsSection
    ? pointsSection.split('\n').find((line) => line.includes('Completed'))
    : undefined;

  const warningMatch = content.match(/⚠️\s+\*\*(.+?)\*\*/);

  return {
    name: headerMatch[1].trim(),
    progress: getField('Progress'),
    timeline: getField('Timeline'),
    daysRemaining: getField('Days Remaining'),
    issueCounts: Object.keys(issueCounts).length ? issueCounts : undefined,
    points: pointsLine ? pointsLine.replace(/^-\s*/, '').trim() : undefined,
    warning: warningMatch?.[1],
  };
}

// ============================================================================
// GET LINEAR ISSUES
// ============================================================================

type GetLinearIssuesArgs = {
  filter: 'my_issues' | 'team_issues' | 'blockers' | 'stalled' | 'recent';
  teamId?: string;
  limit?: number;
};

export const GetLinearIssuesToolUI = makeAssistantToolUI<
  GetLinearIssuesArgs,
  string
>({
  toolName: 'get_linear_issues',
  render: function GetLinearIssuesUI({ args, result, status }) {
    const isRunning = status.type === 'running';
    const isError = result?.startsWith('❌') || result?.startsWith('Error');
    const parsedIssues = useMemo(
      () => (result ? parseIssueList(result) : null),
      [result],
    );

    const filterLabels: Record<string, string> = {
      my_issues: 'My Issues',
      team_issues: 'Team Issues',
      blockers: 'Blockers',
      stalled: 'Stalled (7+ days)',
      recent: 'Recent',
    };

    return (
      <Card className="w-full max-w-2xl overflow-hidden my-2">
        <CardContent className="pt-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <LinearLogo className="h-4 w-4 text-violet-500" />
              <p className="text-sm font-medium text-foreground">
                {isRunning ? 'Fetching issues...' : 'Linear Issues'}
              </p>
            </div>
            <Badge
              variant="outline"
              className="text-[10px] uppercase tracking-widest text-muted-foreground"
            >
              {filterLabels[args.filter] || args.filter}
            </Badge>
          </div>
          {isRunning ? (
            <ThinkingLoader message="Fetching issues from Linear..." />
          ) : isError ? (
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">{result}</span>
            </div>
          ) : parsedIssues ? (
            <div className="space-y-3">
              {parsedIssues.map((issue) => (
                <div
                  key={issue.identifier}
                  className="rounded-lg border border-border/50 bg-background/60 p-3"
                >
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <Badge variant="outline" className="text-xs font-mono">
                      {issue.identifier}
                    </Badge>
                    <p className="text-sm font-medium text-foreground">
                      {issue.title}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {issue.status && (
                      <span className="rounded-full bg-muted/60 px-2 py-0.5">
                        {issue.status}
                      </span>
                    )}
                    {issue.priority && (
                      <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-amber-600">
                        {issue.priority}
                      </span>
                    )}
                    {issue.assignee && (
                      <span className="rounded-full bg-slate-500/10 px-2 py-0.5">
                        {issue.assignee}
                      </span>
                    )}
                  </div>
                  {issue.url && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {issue.url}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <ToolMarkdown content={result} />
          )}
        </CardContent>
      </Card>
    );
  },
});

// ============================================================================
// GET LINEAR ISSUE DETAILS
// ============================================================================

type GetLinearIssueDetailsArgs = {
  issueId: string;
};

export const GetLinearIssueDetailsToolUI = makeAssistantToolUI<
  GetLinearIssueDetailsArgs,
  string
>({
  toolName: 'get_linear_issue_details',
  render: function GetLinearIssueDetailsUI({ args, result, status }) {
    const isRunning = status.type === 'running';
    const isError = result?.startsWith('❌') || result?.startsWith('Error');
    const details = useMemo(
      () => (result ? parseIssueDetails(result) : null),
      [result],
    );

    return (
      <Card className="w-full max-w-2xl overflow-hidden my-2">
        <CardContent className="pt-4">
          <div className="mb-3 flex items-center gap-2">
            <LinearLogo className="h-4 w-4 text-violet-500" />
            <p className="text-sm font-medium text-foreground">
              {isRunning ? 'Loading issue...' : `Issue ${args.issueId}`}
            </p>
          </div>
          {isRunning ? (
            <ThinkingLoader message={`Loading ${args.issueId}...`} />
          ) : isError ? (
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">{result}</span>
            </div>
          ) : details ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-border/50 bg-background/60 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  {details.identifier && (
                    <Badge variant="outline" className="text-xs font-mono">
                      {details.identifier}
                    </Badge>
                  )}
                  <p className="text-sm font-semibold text-foreground">
                    {details.title || 'Issue details'}
                  </p>
                </div>
                <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                  {Object.entries(details.fields).map(([key, value]) => (
                    <div key={key} className="flex gap-2">
                      <span className="capitalize text-muted-foreground/70">
                        {key}:
                      </span>
                      <span className="text-foreground">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {details.description && (
                <div className="rounded-lg border border-border/50 bg-background/60 p-3">
                  <p className="text-xs text-muted-foreground mb-2">
                    Description
                  </p>
                  <ToolMarkdown content={details.description} />
                </div>
              )}

              {details.subIssues && details.subIssues.length > 0 && (
                <div className="rounded-lg border border-border/50 bg-background/60 p-3">
                  <p className="text-xs text-muted-foreground mb-2">
                    Sub-issues
                  </p>
                  <ul className="text-sm text-foreground space-y-1">
                    {details.subIssues.map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {details.comments && details.comments.length > 0 && (
                <div className="rounded-lg border border-border/50 bg-background/60 p-3">
                  <p className="text-xs text-muted-foreground mb-2">
                    Recent comments
                  </p>
                  <div className="space-y-3">
                    {details.comments.map((comment, index) => (
                      <div key={`${comment.author}-${index}`}>
                        <p className="text-xs text-muted-foreground">
                          {comment.author}
                          {comment.date ? ` • ${comment.date}` : ''}
                        </p>
                        <p className="text-sm text-foreground mt-1">
                          {comment.body || 'No comment body'}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <ToolMarkdown content={result} />
          )}
        </CardContent>
      </Card>
    );
  },
});

// ============================================================================
// SEARCH LINEAR ISSUES
// ============================================================================

type SearchLinearIssuesArgs = {
  query: string;
  includeArchived?: boolean;
  limit?: number;
};

export const SearchLinearIssuesToolUI = makeAssistantToolUI<
  SearchLinearIssuesArgs,
  string
>({
  toolName: 'search_linear_issues',
  render: function SearchLinearIssuesUI({ args, result, status }) {
    const isRunning = status.type === 'running';
    const isError = result?.startsWith('❌') || result?.startsWith('Error');
    const parsedIssues = useMemo(
      () => (result ? parseIssueList(result) : null),
      [result],
    );

    return (
      <Card className="w-full max-w-2xl overflow-hidden my-2">
        <CardContent className="pt-4">
          <div className="mb-3">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-violet-500" />
              <p className="text-sm font-medium text-foreground">
                {isRunning ? 'Searching...' : 'Search Results'}
              </p>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Query: &quot;{args.query}&quot;
              {args.includeArchived && ' (including archived)'}
            </p>
          </div>
          {isRunning ? (
            <ThinkingLoader message={`Searching for "${args.query}"...`} />
          ) : isError ? (
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">{result}</span>
            </div>
          ) : parsedIssues ? (
            <div className="space-y-3">
              {parsedIssues.map((issue) => (
                <div
                  key={issue.identifier}
                  className="rounded-lg border border-border/50 bg-background/60 p-3"
                >
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <Badge variant="outline" className="text-xs font-mono">
                      {issue.identifier}
                    </Badge>
                    <p className="text-sm font-medium text-foreground">
                      {issue.title}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {issue.status && (
                      <span className="rounded-full bg-muted/60 px-2 py-0.5">
                        {issue.status}
                      </span>
                    )}
                    {issue.priority && (
                      <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-amber-600">
                        {issue.priority}
                      </span>
                    )}
                    {issue.assignee && (
                      <span className="rounded-full bg-slate-500/10 px-2 py-0.5">
                        {issue.assignee}
                      </span>
                    )}
                  </div>
                  {issue.url && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {issue.url}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <ToolMarkdown content={result} />
          )}
        </CardContent>
      </Card>
    );
  },
});

// ============================================================================
// GET LINEAR PROJECT STATUS
// ============================================================================

type GetLinearProjectStatusArgs = {
  projectId?: string;
  includeCompleted?: boolean;
};

export const GetLinearProjectStatusToolUI = makeAssistantToolUI<
  GetLinearProjectStatusArgs,
  string
>({
  toolName: 'get_linear_project_status',
  render: function GetLinearProjectStatusUI({ args, result, status }) {
    const isRunning = status.type === 'running';
    const isError = result?.startsWith('❌') || result?.startsWith('Error');
    const projects = useMemo(
      () => (result ? parseProjectStatus(result) : null),
      [result],
    );

    return (
      <Card className="w-full max-w-2xl overflow-hidden my-2">
        <CardContent className="pt-4">
          <div className="mb-3 flex items-center gap-2">
            <Target className="h-4 w-4 text-emerald-500" />
            <p className="text-sm font-medium text-foreground">
              {isRunning ? 'Loading projects...' : 'Project Status'}
            </p>
          </div>
          {isRunning ? (
            <ThinkingLoader message="Fetching project status..." />
          ) : isError ? (
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">{result}</span>
            </div>
          ) : projects ? (
            <div className="space-y-3">
              {projects.map((project) => {
                const progressMatch = project.progress?.match(/(\\d+)%/);
                const progressValue = progressMatch
                  ? Number(progressMatch[1])
                  : null;
                return (
                  <div
                    key={project.name}
                    className="rounded-lg border border-border/50 bg-background/60 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground">
                        {project.name}
                      </p>
                      {project.status && (
                        <Badge variant="outline" className="text-xs">
                          {project.status}
                        </Badge>
                      )}
                    </div>

                    {progressValue !== null && (
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                          <span>Progress</span>
                          <span>{project.progress}</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-muted/60">
                          <div
                            className="h-2 rounded-full bg-emerald-500/80"
                            style={{ width: `${progressValue}%` }}
                          />
                        </div>
                      </div>
                    )}

                    <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                      {project.lead && (
                        <div>
                          <span className="text-muted-foreground/70">Lead:</span>{' '}
                          <span className="text-foreground">{project.lead}</span>
                        </div>
                      )}
                      {project.target && (
                        <div>
                          <span className="text-muted-foreground/70">
                            Target:
                          </span>{' '}
                          <span className="text-foreground">{project.target}</span>
                        </div>
                      )}
                    </div>

                    {project.milestones && project.milestones.length > 0 && (
                      <div className="mt-3 text-xs text-muted-foreground">
                        <p className="mb-1 text-muted-foreground/70">
                          Milestones
                        </p>
                        <ul className="space-y-1">
                          {project.milestones.map((milestone) => (
                            <li key={milestone}>• {milestone}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <ToolMarkdown content={result} />
          )}
        </CardContent>
      </Card>
    );
  },
});

// ============================================================================
// GET LINEAR TEAM WORKLOAD
// ============================================================================

type GetLinearTeamWorkloadArgs = {
  teamId?: string;
  includeUnassigned?: boolean;
};

export const GetLinearTeamWorkloadToolUI = makeAssistantToolUI<
  GetLinearTeamWorkloadArgs,
  string
>({
  toolName: 'get_linear_team_workload',
  render: function GetLinearTeamWorkloadUI({ args, result, status }) {
    const isRunning = status.type === 'running';
    const isError = result?.startsWith('❌') || result?.startsWith('Error');
    const workload = useMemo(
      () => (result ? parseTeamWorkload(result) : null),
      [result],
    );

    return (
      <Card className="w-full max-w-2xl overflow-hidden my-2">
        <CardContent className="pt-4">
          <div className="mb-3 flex items-center gap-2">
            <Users className="h-4 w-4 text-blue-500" />
            <p className="text-sm font-medium text-foreground">
              {isRunning ? 'Loading workload...' : 'Team Workload'}
            </p>
          </div>
          {isRunning ? (
            <ThinkingLoader message="Analyzing team workload..." />
          ) : isError ? (
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">{result}</span>
            </div>
          ) : workload ? (
            <div className="space-y-3">
              {workload.entries.map((entry) => (
                <div
                  key={entry.name}
                  className="rounded-lg border border-border/50 bg-background/60 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">
                      {entry.name}
                    </p>
                    {entry.urgent > 0 && (
                      <Badge variant="outline" className="text-xs">
                        🔴 {entry.urgent} urgent
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {entry.issues} issues • {entry.points} points
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <ToolMarkdown content={result} />
          )}
        </CardContent>
      </Card>
    );
  },
});

// ============================================================================
// GET LINEAR CYCLE STATUS
// ============================================================================

type GetLinearCycleStatusArgs = {
  cycleId?: string;
  teamId?: string;
};

export const GetLinearCycleStatusToolUI = makeAssistantToolUI<
  GetLinearCycleStatusArgs,
  string
>({
  toolName: 'get_linear_cycle_status',
  render: function GetLinearCycleStatusUI({ args, result, status }) {
    const isRunning = status.type === 'running';
    const isError = result?.startsWith('❌') || result?.startsWith('Error');
    const cycle = useMemo(
      () => (result ? parseCycleStatus(result) : null),
      [result],
    );

    return (
      <Card className="w-full max-w-2xl overflow-hidden my-2">
        <CardContent className="pt-4">
          <div className="mb-3 flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-amber-500" />
            <p className="text-sm font-medium text-foreground">
              {isRunning ? 'Loading cycle...' : 'Cycle Status'}
            </p>
          </div>
          {isRunning ? (
            <ThinkingLoader message="Fetching cycle status..." />
          ) : isError ? (
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">{result}</span>
            </div>
          ) : cycle ? (
            <div className="space-y-3">
              <div className="rounded-lg border border-border/50 bg-background/60 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">
                    {cycle.name || 'Cycle status'}
                  </p>
                  {cycle.progress && (
                    <Badge variant="outline" className="text-xs">
                      {cycle.progress}
                    </Badge>
                  )}
                </div>
                <div className="mt-2 text-xs text-muted-foreground space-y-1">
                  {cycle.timeline && <p>Timeline: {cycle.timeline}</p>}
                  {cycle.daysRemaining && (
                    <p>Days remaining: {cycle.daysRemaining}</p>
                  )}
                </div>
              </div>

              {cycle.issueCounts && (
                <div className="rounded-lg border border-border/50 bg-background/60 p-3">
                  <p className="text-xs text-muted-foreground mb-2">
                    Issue breakdown
                  </p>
                  <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                    {Object.entries(cycle.issueCounts).map(([label, value]) => (
                      <div key={label} className="flex justify-between">
                        <span>{label}</span>
                        <span className="text-foreground">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {cycle.points && (
                <div className="rounded-lg border border-border/50 bg-background/60 p-3 text-xs text-muted-foreground">
                  <p className="mb-1 text-muted-foreground/70">Points</p>
                  <p className="text-foreground">{cycle.points}</p>
                </div>
              )}

              {cycle.warning && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700">
                  ⚠️ {cycle.warning}
                </div>
              )}
            </div>
          ) : (
            <ToolMarkdown content={result} />
          )}
        </CardContent>
      </Card>
    );
  },
});

// ============================================================================
// ADD LINEAR COMMENT
// ============================================================================

type AddLinearCommentArgs = {
  issueId: string;
  body: string;
};

export const AddLinearCommentToolUI = makeAssistantToolUI<
  AddLinearCommentArgs,
  string
>({
  toolName: 'add_linear_comment',
  render: function AddLinearCommentUI({ args, result, status }) {
    const isRunning = status.type === 'running';
    const isSuccess = result?.startsWith('✅');
    const isError = result?.startsWith('❌') || result?.startsWith('Error');

    return (
      <Card className="w-full max-w-md overflow-hidden my-2">
        <CardContent className="pt-4">
          <div className="mb-3 flex items-center gap-2">
            {isSuccess ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : isError ? (
              <AlertTriangle className="h-4 w-4 text-destructive" />
            ) : (
              <MessageSquare className="h-4 w-4 text-violet-500" />
            )}
            <p className="text-sm font-medium text-foreground">
              {isRunning
                ? 'Adding comment...'
                : isSuccess
                  ? 'Comment Added'
                  : isError
                    ? 'Failed'
                    : 'Add Comment'}
            </p>
            <Badge variant="outline" className="ml-auto text-xs font-mono">
              {args.issueId}
            </Badge>
          </div>
          {isRunning ? (
            <ThinkingLoader message="Adding comment..." />
          ) : (
            <>
              <div className="rounded-lg border bg-muted/30 p-3 mb-3">
                <p className="text-xs text-muted-foreground mb-1">Comment</p>
                <p className="text-sm">
                  {args.body.slice(0, 200)}
                  {args.body.length > 200 ? '...' : ''}
                </p>
              </div>
              {result && (
                <p
                  className={cn(
                    'text-sm',
                    isSuccess && 'text-green-600',
                    isError && 'text-destructive',
                  )}
                >
                  {result}
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    );
  },
});

// ============================================================================
// CREATE LINEAR ISSUE
// ============================================================================

export const CreateLinearIssueToolUI = makeAssistantToolUI<
  CreateLinearIssueArgs,
  string
>({
  toolName: 'create_linear_issue',
  render: function CreateLinearIssueUI({ args, result, status }) {
    const isRunning = status.type === 'running';
    const parsed = parseJsonResult<CreateLinearIssueResult>(result);
    const isError =
      result?.startsWith('❌') ||
      result?.startsWith('Error') ||
      Boolean(parsed?.error) ||
      parsed?.success === false;

    return (
      <Card className="w-full max-w-2xl overflow-hidden my-2">
        <CardContent className="pt-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <LinearLogo className="h-4 w-4 text-violet-500" />
              <p className="text-sm font-medium text-foreground">
                {isRunning ? 'Creating issue...' : 'Linear Issue'}
              </p>
            </div>
            <Badge
              variant="outline"
              className="text-[10px] uppercase tracking-widest text-muted-foreground"
            >
              Create
            </Badge>
          </div>
          {isRunning ? (
            <ThinkingLoader message="Creating issue in Linear..." />
          ) : isError ? (
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">
                {parsed?.error || result || 'Failed to create issue.'}
              </span>
            </div>
          ) : parsed?.success ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-500" />
                <span className="text-sm font-medium text-foreground">
                  {parsed.identifier || 'Issue created'}
                </span>
              </div>
              <div className="rounded-lg border border-border/50 bg-background/60 p-3">
                <p className="text-sm font-medium text-foreground">
                  {parsed.title || args.title}
                </p>
                {parsed.url && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {parsed.url}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <ToolMarkdown content={result || 'Issue created.'} />
          )}
        </CardContent>
      </Card>
    );
  },
});
