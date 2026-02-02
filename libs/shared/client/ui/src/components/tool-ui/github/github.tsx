'use client';

import { useMemo } from 'react';
import { makeAssistantToolUI } from '@assistant-ui/react';
import { Card, CardContent } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { AlertTriangle, Github, Loader2 } from 'lucide-react';
import { cn } from '../../../lib/utils';

type GitHubPullRequest = {
  id: number;
  number: number;
  title: string;
  state: string;
  merged?: boolean;
  draft?: boolean;
  htmlUrl?: string;
  createdAt?: string;
  updatedAt?: string;
  author?: string;
};

type GitHubIssue = {
  id: number;
  number: number;
  title: string;
  state: string;
  htmlUrl?: string;
  createdAt?: string;
  updatedAt?: string;
  author?: string;
};

type GitHubCommit = {
  sha: string;
  message: string;
  author?: string;
  htmlUrl?: string;
  date?: string;
};

type GitHubFileChange = {
  filename: string;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
};

type GitHubPRDetails = GitHubPullRequest & {
  body?: string;
  additions?: number;
  deletions?: number;
  changedFiles?: number;
  files?: GitHubFileChange[];
  commits?: GitHubCommit[];
  labels?: string[];
  reviewers?: string[];
};

type GitHubToolResult = {
  type: string;
  repo?: string;
  state?: string;
  branch?: string | null;
  query?: string;
  items?: GitHubPullRequest[] | GitHubIssue[] | GitHubCommit[];
  pr?: GitHubPRDetails;
  summary?: string;
};

function parseResult(result: unknown): GitHubToolResult | null {
  if (!result) return null;
  if (typeof result === 'object' && result !== null) {
    return result as GitHubToolResult;
  }
  if (typeof result === 'string') {
    try {
      return JSON.parse(result) as GitHubToolResult;
    } catch {
      return null;
    }
  }
  return null;
}

function GitHubHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <Github className="h-4 w-4 text-slate-600" />
      <p className="text-sm font-medium text-foreground">{title}</p>
      {subtitle && (
        <Badge variant="secondary" className="ml-auto text-xs">
          {subtitle}
        </Badge>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  return (
    <Badge
      variant="outline"
      className={cn(
        'text-xs',
        normalized === 'open' && 'text-emerald-600 border-emerald-200',
        normalized === 'closed' && 'text-muted-foreground',
      )}
    >
      {status}
    </Badge>
  );
}

// ============================================================================
// Pull requests list
// ============================================================================

type PullRequestsArgs = {
  repo: string;
  state?: string;
  limit?: number;
};

export const GetGitHubPullRequestsToolUI = makeAssistantToolUI<
  PullRequestsArgs,
  unknown
>({
  toolName: 'get_github_pull_requests',
  render: function GetGitHubPullRequestsUI({ args, result, status }) {
    const isRunning = status.type === 'running';
    const parsed = useMemo(() => parseResult(result), [result]);
    const items = (parsed?.items as GitHubPullRequest[]) || [];
    const isError = typeof result === 'string' && result.startsWith('GitHub');

    return (
      <Card className="w-full max-w-2xl overflow-hidden my-2">
        <CardContent className="pt-4">
          <GitHubHeader title="GitHub PRs" subtitle={args.repo} />
          {isRunning ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading pull requests...</span>
            </div>
          ) : isError ? (
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">{result as string}</span>
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pull requests found.</p>
          ) : (
            <div className="space-y-3">
              {items.map((pr) => (
                <div
                  key={pr.id}
                  className="rounded-lg border border-border/50 bg-background/60 p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-xs font-mono">
                      #{pr.number}
                    </Badge>
                    <p className="text-sm font-medium text-foreground">
                      {pr.title}
                    </p>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <StatusBadge status={pr.state} />
                    {pr.author && <span>by {pr.author}</span>}
                    {pr.updatedAt && (
                      <span>
                        Updated {new Date(pr.updatedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  {pr.htmlUrl && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {pr.htmlUrl}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  },
});

// ============================================================================
// PR details
// ============================================================================

type PullRequestDetailsArgs = {
  repo: string;
  number: number;
};

export const GetGitHubPullRequestDetailsToolUI = makeAssistantToolUI<
  PullRequestDetailsArgs,
  unknown
>({
  toolName: 'get_github_pull_request_details',
  render: function GetGitHubPullRequestDetailsUI({ args, result, status }) {
    const isRunning = status.type === 'running';
    const parsed = useMemo(() => parseResult(result), [result]);
    const pr = parsed?.pr as GitHubPRDetails | undefined;
    const isError = typeof result === 'string' && result.startsWith('GitHub');

    return (
      <Card className="w-full max-w-2xl overflow-hidden my-2">
        <CardContent className="pt-4 space-y-4">
          <GitHubHeader title="PR Details" subtitle={args.repo} />
          {isRunning ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading PR details...</span>
            </div>
          ) : isError ? (
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">{result as string}</span>
            </div>
          ) : pr ? (
            <>
              <div className="rounded-lg border border-border/50 bg-background/60 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-xs font-mono">
                    #{pr.number}
                  </Badge>
                  <p className="text-sm font-semibold text-foreground">
                    {pr.title}
                  </p>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <StatusBadge status={pr.state} />
                  {pr.author && <span>by {pr.author}</span>}
                  {pr.changedFiles !== undefined && (
                    <span>{pr.changedFiles} files</span>
                  )}
                  {pr.additions !== undefined && pr.deletions !== undefined && (
                    <span>
                      +{pr.additions}/-{pr.deletions}
                    </span>
                  )}
                </div>
                {pr.htmlUrl && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {pr.htmlUrl}
                  </p>
                )}
              </div>

              {pr.labels && pr.labels.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {pr.labels.map((label) => (
                    <Badge key={label} variant="secondary" className="text-xs">
                      {label}
                    </Badge>
                  ))}
                </div>
              )}

              {pr.files && pr.files.length > 0 && (
                <div className="rounded-lg border border-border/50 bg-background/60 p-3">
                  <p className="text-xs text-muted-foreground mb-2">Files</p>
                  <div className="space-y-1 text-xs">
                    {pr.files.slice(0, 8).map((file) => (
                      <div key={file.filename} className="flex justify-between">
                        <span className="text-foreground">{file.filename}</span>
                        <span className="text-muted-foreground">
                          +{file.additions}/-{file.deletions}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {pr.commits && pr.commits.length > 0 && (
                <div className="rounded-lg border border-border/50 bg-background/60 p-3">
                  <p className="text-xs text-muted-foreground mb-2">Commits</p>
                  <div className="space-y-2 text-xs">
                    {pr.commits.slice(0, 5).map((commit) => (
                      <div key={commit.sha}>
                        <p className="text-foreground font-medium">
                          {commit.message}
                        </p>
                        <p className="text-muted-foreground">
                          {commit.sha.slice(0, 7)} · {commit.author || 'Unknown'}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No details found.</p>
          )}
        </CardContent>
      </Card>
    );
  },
});

// ============================================================================
// Issues list
// ============================================================================

type IssuesArgs = {
  repo: string;
  state?: string;
  limit?: number;
};

export const GetGitHubIssuesToolUI = makeAssistantToolUI<IssuesArgs, unknown>({
  toolName: 'get_github_issues',
  render: function GetGitHubIssuesUI({ args, result, status }) {
    const isRunning = status.type === 'running';
    const parsed = useMemo(() => parseResult(result), [result]);
    const items = (parsed?.items as GitHubIssue[]) || [];
    const isError = typeof result === 'string' && result.startsWith('GitHub');

    return (
      <Card className="w-full max-w-2xl overflow-hidden my-2">
        <CardContent className="pt-4">
          <GitHubHeader title="GitHub Issues" subtitle={args.repo} />
          {isRunning ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading issues...</span>
            </div>
          ) : isError ? (
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">{result as string}</span>
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No issues found.</p>
          ) : (
            <div className="space-y-3">
              {items.map((issue) => (
                <div
                  key={issue.id}
                  className="rounded-lg border border-border/50 bg-background/60 p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-xs font-mono">
                      #{issue.number}
                    </Badge>
                    <p className="text-sm font-medium text-foreground">
                      {issue.title}
                    </p>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <StatusBadge status={issue.state} />
                    {issue.author && <span>by {issue.author}</span>}
                    {issue.updatedAt && (
                      <span>
                        Updated {new Date(issue.updatedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  {issue.htmlUrl && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {issue.htmlUrl}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  },
});

// ============================================================================
// Issue search
// ============================================================================

type SearchIssuesArgs = {
  query: string;
  repo?: string;
  limit?: number;
};

export const SearchGitHubIssuesToolUI = makeAssistantToolUI<
  SearchIssuesArgs,
  unknown
>({
  toolName: 'search_github_issues',
  render: function SearchGitHubIssuesUI({ args, result, status }) {
    const isRunning = status.type === 'running';
    const parsed = useMemo(() => parseResult(result), [result]);
    const items = (parsed?.items as GitHubIssue[]) || [];
    const isError = typeof result === 'string' && result.startsWith('GitHub');

    return (
      <Card className="w-full max-w-2xl overflow-hidden my-2">
        <CardContent className="pt-4">
          <GitHubHeader title="Issue Search" subtitle={args.repo || 'All repos'} />
          {isRunning ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Searching issues...</span>
            </div>
          ) : isError ? (
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">{result as string}</span>
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No issues found.</p>
          ) : (
            <div className="space-y-3">
              {items.map((issue) => (
                <div
                  key={issue.id}
                  className="rounded-lg border border-border/50 bg-background/60 p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-xs font-mono">
                      #{issue.number}
                    </Badge>
                    <p className="text-sm font-medium text-foreground">
                      {issue.title}
                    </p>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <StatusBadge status={issue.state} />
                    {issue.author && <span>by {issue.author}</span>}
                  </div>
                  {issue.htmlUrl && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {issue.htmlUrl}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  },
});

// ============================================================================
// Commits list
// ============================================================================

type CommitsArgs = {
  repo: string;
  branch?: string;
  limit?: number;
};

export const GetGitHubCommitsToolUI = makeAssistantToolUI<
  CommitsArgs,
  unknown
>({
  toolName: 'get_github_commits',
  render: function GetGitHubCommitsUI({ args, result, status }) {
    const isRunning = status.type === 'running';
    const parsed = useMemo(() => parseResult(result), [result]);
    const items = (parsed?.items as GitHubCommit[]) || [];
    const isError = typeof result === 'string' && result.startsWith('GitHub');

    return (
      <Card className="w-full max-w-2xl overflow-hidden my-2">
        <CardContent className="pt-4">
          <GitHubHeader title="Recent Commits" subtitle={args.repo} />
          {isRunning ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading commits...</span>
            </div>
          ) : isError ? (
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">{result as string}</span>
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No commits found.</p>
          ) : (
            <div className="space-y-3">
              {items.map((commit) => (
                <div
                  key={commit.sha}
                  className="rounded-lg border border-border/50 bg-background/60 p-3"
                >
                  <p className="text-sm font-medium text-foreground">
                    {commit.message}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-xs font-mono">
                      {commit.sha.slice(0, 7)}
                    </Badge>
                    {commit.author && <span>{commit.author}</span>}
                    {commit.date && (
                      <span>{new Date(commit.date).toLocaleDateString()}</span>
                    )}
                  </div>
                  {commit.htmlUrl && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {commit.htmlUrl}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  },
});
