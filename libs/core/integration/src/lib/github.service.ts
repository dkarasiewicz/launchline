import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

interface GitHubOAuthResponse {
  access_token?: string;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
  error_uri?: string;
}

interface GitHubApiAccount {
  id: number;
  login: string;
  type?: string;
}

interface GitHubApiUser {
  id: number;
  login: string;
  name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
}

interface GitHubApiRepository {
  id: number;
  name: string;
  full_name: string;
  owner?: { login?: string | null } | null;
  description?: string | null;
  language?: string | null;
  default_branch: string;
  private?: boolean;
  html_url?: string | null;
}

interface GitHubApiPullRequest {
  id: number;
  number: number;
  title: string;
  state: string;
  merged?: boolean | null;
  merged_at?: string | null;
  draft?: boolean | null;
  html_url?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  user?: { login?: string | null } | null;
  base?: { ref?: string | null } | null;
  body?: string | null;
  additions?: number | null;
  deletions?: number | null;
  changed_files?: number | null;
  labels?: Array<{ name?: string | null }>;
  requested_reviewers?: Array<{ login?: string | null }>;
}

interface GitHubApiIssue {
  id: number;
  number: number;
  title: string;
  state: string;
  html_url?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  user?: { login?: string | null } | null;
  body?: string | null;
  labels?: Array<{ name?: string | null }>;
  pull_request?: Record<string, unknown>;
}

interface GitHubApiCommit {
  sha: string;
  html_url?: string | null;
  author?: { login?: string | null } | null;
  commit?: {
    message?: string | null;
    author?: { name?: string | null; date?: string | null } | null;
    committer?: { date?: string | null } | null;
  } | null;
  message?: string | null;
  committer?: { date?: string | null } | null;
}

interface GitHubApiPullRequestFile {
  filename: string;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string | null;
}

interface GitHubApiIssueComment {
  user?: { login?: string | null } | null;
  body?: string | null;
}

interface GitHubApiContributor {
  id: number;
  login: string;
  contributions: number;
}

interface GitHubApiWebhook {
  config?: { url?: string | null } | null;
}

interface GitHubApiInstallationRepositories {
  repositories?: GitHubApiRepository[];
}

interface GitHubApiInstallation {
  id: number;
  account?: GitHubApiAccount | null;
  repository_selection?: string | null;
}

interface GitHubApiInstallationAccessToken {
  token: string;
  expires_at?: string | null;
}

interface GitHubApiSearchIssues {
  items?: GitHubApiIssue[];
}

interface GitHubApiCommitDetails extends GitHubApiCommit {
  stats?: { additions?: number | null; deletions?: number | null } | null;
  files?: GitHubApiPullRequestFile[];
}

export interface GitHubUserProfile {
  id: number;
  login: string;
  name?: string;
  email?: string;
  avatarUrl?: string;
}

export interface GitHubRepository {
  id: number;
  name: string;
  fullName: string;
  owner: string;
  description?: string;
  language?: string;
  defaultBranch: string;
  private?: boolean;
  htmlUrl?: string;
}

export interface GitHubPullRequestSummary {
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
  baseBranch?: string;
}

export interface GitHubIssueSummary {
  id: number;
  number: number;
  title: string;
  state: string;
  htmlUrl?: string;
  createdAt?: string;
  updatedAt?: string;
  author?: string;
}

export interface GitHubCommitSummary {
  sha: string;
  message: string;
  author?: string;
  htmlUrl?: string;
  date?: string;
}

export interface GitHubFileChange {
  filename: string;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
}

export interface GitHubPRDetails extends GitHubPullRequestSummary {
  body?: string;
  additions?: number;
  deletions?: number;
  changedFiles?: number;
  files?: GitHubFileChange[];
  commits?: GitHubCommitSummary[];
  labels?: string[];
  reviewers?: string[];
}

export interface GitHubIssueDetails extends GitHubIssueSummary {
  body?: string;
  labels?: string[];
  comments?: Array<{ author: string; body: string }>;
}

export interface GitHubCommitDetails extends GitHubCommitSummary {
  files?: GitHubFileChange[];
  additions?: number;
  deletions?: number;
}

export interface GitHubContributorSummary {
  id: number;
  login: string;
  contributions: number;
}

export interface GitHubInstallationSummary {
  id: number;
  account: {
    id: number;
    login: string;
    type?: string;
  };
  repositorySelection?: string;
}

@Injectable()
export class GitHubService {
  private readonly logger = new Logger(GitHubService.name);
  private readonly clientId: string | undefined = this.configService.get(
    'integrations.github.clientId',
  );
  private readonly clientSecret: string | undefined = this.configService.get(
    'integrations.github.clientSecret',
  );
  private readonly appId: string | undefined = this.configService.get(
    'integrations.github.appId',
  );
  private readonly appSlug: string | undefined = this.configService.get(
    'integrations.github.appSlug',
  );
  private readonly appPrivateKey: string | undefined = this.configService.get(
    'integrations.github.privateKey',
  );

  constructor(private readonly configService: ConfigService) {}

  isAppConfigured(): boolean {
    return Boolean(this.appId && this.appSlug && this.appPrivateKey);
  }

  getAppSlug(): string | undefined {
    return this.appSlug;
  }

  async exchangeCode(
    code: string,
    redirectUri: string,
  ): Promise<{ accessToken: string; scope?: string; tokenType?: string }> {
    if (!this.clientId || !this.clientSecret) {
      throw new Error('GitHub integration is not configured');
    }

    const response = await fetch(
      'https://github.com/login/oauth/access_token',
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          code,
          redirect_uri: redirectUri,
        }),
      },
    );

    if (!response.ok) {
      const error = await response.text();
      this.logger.error({ error }, 'GitHub OAuth exchange failed');
      throw new Error('Failed to exchange GitHub authorization code');
    }

    const data = (await response.json()) as GitHubOAuthResponse;

    if (!data?.access_token) {
      this.logger.error({ data }, 'GitHub OAuth missing access token');
      throw new Error('GitHub OAuth missing access token');
    }

    return {
      accessToken: data.access_token,
      scope: data.scope,
      tokenType: data.token_type,
    };
  }

  async getInstallation(
    installationId: string,
  ): Promise<GitHubInstallationSummary> {
    const jwtToken = this.buildAppJwt();
    const data = await this.requestWithAuth<GitHubApiInstallation>(
      `https://api.github.com/app/installations/${installationId}`,
      jwtToken,
      { authScheme: 'Bearer' },
    );

    if (!data.account) {
      throw new BadRequestException('Integration not found');
    }

    return {
      id: data.id,
      account: {
        id: data.account?.id,
        login: data.account?.login,
        type: data.account?.type,
      },
      repositorySelection: data.repository_selection ?? undefined,
    };
  }

  async createInstallationAccessToken(
    installationId: string,
  ): Promise<{ token: string; expiresAt?: string }> {
    const jwtToken = this.buildAppJwt();
    const data = await this.requestWithAuth<GitHubApiInstallationAccessToken>(
      `https://api.github.com/app/installations/${installationId}/access_tokens`,
      jwtToken,
      {
        method: 'POST',
        authScheme: 'Bearer',
      },
    );

    return {
      token: data.token,
      expiresAt: data.expires_at ?? undefined,
    };
  }

  async listInstallationRepositories(
    accessToken: string,
    options: { limit?: number } = {},
  ): Promise<GitHubRepository[]> {
    const limit = Math.min(options.limit ?? 30, 100);
    const url = new URL('https://api.github.com/installation/repositories');
    url.searchParams.set('per_page', String(limit));

    const data = await this.request<GitHubApiInstallationRepositories>(
      url.toString(),
      accessToken,
    );
    const repositories = data.repositories ?? [];

    return repositories.map((repo) => this.mapRepository(repo));
  }

  async getViewer(accessToken: string): Promise<GitHubUserProfile> {
    const data = await this.request<GitHubApiUser>(
      'https://api.github.com/user',
      accessToken,
    );

    return {
      id: data.id,
      login: data.login,
      name: data.name || undefined,
      email: data.email || undefined,
      avatarUrl: data.avatar_url || undefined,
    };
  }

  async listRepositories(
    accessToken: string,
    options: { limit?: number } = {},
  ): Promise<GitHubRepository[]> {
    if (this.isInstallationToken(accessToken)) {
      return this.listInstallationRepositories(accessToken, options);
    }

    const limit = Math.min(options.limit ?? 30, 100);
    const url = new URL('https://api.github.com/user/repos');
    url.searchParams.set('per_page', String(limit));
    url.searchParams.set('sort', 'updated');
    url.searchParams.set(
      'affiliation',
      'owner,collaborator,organization_member',
    );

    const data = await this.request<GitHubApiRepository[]>(
      url.toString(),
      accessToken,
    );

    if (!Array.isArray(data)) {
      return [];
    }

    return data.map((repo) => this.mapRepository(repo));
  }

  async listRepoPullRequests(
    accessToken: string,
    owner: string,
    repo: string,
    options: { state?: string; limit?: number } = {},
  ): Promise<GitHubPullRequestSummary[]> {
    const limit = Math.min(options.limit ?? 10, 50);
    const url = new URL(`https://api.github.com/repos/${owner}/${repo}/pulls`);
    url.searchParams.set('per_page', String(limit));
    url.searchParams.set('state', options.state || 'open');
    url.searchParams.set('sort', 'updated');

    const data = await this.request<GitHubApiPullRequest[]>(
      url.toString(),
      accessToken,
    );
    if (!Array.isArray(data)) {
      return [];
    }

    return data.map((pr) => this.mapPullRequest(pr));
  }

  async listRepoContributors(
    accessToken: string,
    owner: string,
    repo: string,
    limit = 10,
  ): Promise<GitHubContributorSummary[]> {
    const url = new URL(
      `https://api.github.com/repos/${owner}/${repo}/contributors`,
    );
    url.searchParams.set('per_page', String(Math.min(limit, 50)));

    const data = await this.request<GitHubApiContributor[]>(
      url.toString(),
      accessToken,
    );
    if (!Array.isArray(data)) {
      return [];
    }

    return data.map((contributor) => ({
      id: contributor.id,
      login: contributor.login,
      contributions: contributor.contributions,
    }));
  }

  async getPullRequestDetails(
    accessToken: string,
    owner: string,
    repo: string,
    number: number,
  ): Promise<GitHubPRDetails> {
    const pr = await this.request<GitHubApiPullRequest>(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${number}`,
      accessToken,
    );

    const [files, commits] = await Promise.all([
      this.listPullRequestFiles(accessToken, owner, repo, number),
      this.listPullRequestCommits(accessToken, owner, repo, number),
    ]);

    return {
      ...this.mapPullRequest(pr),
      body: pr.body || undefined,
      additions: pr.additions ?? undefined,
      deletions: pr.deletions ?? undefined,
      changedFiles: pr.changed_files ?? undefined,
      files,
      commits,
      labels: Array.isArray(pr.labels)
        ? (pr.labels
            .map((label: { name?: string | null }) => label.name)
            .filter(Boolean) as string[])
        : [],
      reviewers: Array.isArray(pr.requested_reviewers)
        ? (pr.requested_reviewers
            .map((reviewer: { login?: string | null }) => reviewer.login)
            .filter(Boolean) as string[])
        : [],
    };
  }

  async listPullRequestFiles(
    accessToken: string,
    owner: string,
    repo: string,
    number: number,
  ): Promise<GitHubFileChange[]> {
    const url = new URL(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${number}/files`,
    );
    url.searchParams.set('per_page', '50');

    const data = await this.request<GitHubApiPullRequestFile[]>(
      url.toString(),
      accessToken,
    );
    if (!Array.isArray(data)) {
      return [];
    }

    return data.map((file) => ({
      filename: file.filename,
      additions: file.additions,
      deletions: file.deletions,
      changes: file.changes,
      patch: file.patch ?? undefined,
    }));
  }

  async listPullRequestCommits(
    accessToken: string,
    owner: string,
    repo: string,
    number: number,
  ): Promise<GitHubCommitSummary[]> {
    const url = new URL(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${number}/commits`,
    );
    url.searchParams.set('per_page', '30');

    const data = await this.request<GitHubApiCommit[]>(
      url.toString(),
      accessToken,
    );
    if (!Array.isArray(data)) {
      return [];
    }

    return data.map((commit) => this.mapCommit(commit));
  }

  async listRepoIssues(
    accessToken: string,
    owner: string,
    repo: string,
    options: { state?: string; limit?: number } = {},
  ): Promise<GitHubIssueSummary[]> {
    const limit = Math.min(options.limit ?? 10, 50);
    const url = new URL(`https://api.github.com/repos/${owner}/${repo}/issues`);
    url.searchParams.set('per_page', String(limit));
    url.searchParams.set('state', options.state || 'open');

    const data = await this.request<GitHubApiIssue[]>(
      url.toString(),
      accessToken,
    );
    if (!Array.isArray(data)) {
      return [];
    }

    return data
      .filter((issue) => !issue.pull_request)
      .map((issue) => this.mapIssue(issue));
  }

  async getIssueDetails(
    accessToken: string,
    owner: string,
    repo: string,
    number: number,
  ): Promise<GitHubIssueDetails> {
    const issue = await this.request<GitHubApiIssue>(
      `https://api.github.com/repos/${owner}/${repo}/issues/${number}`,
      accessToken,
    );

    const comments = await this.listIssueComments(
      accessToken,
      owner,
      repo,
      number,
    );

    return {
      ...this.mapIssue(issue),
      body: issue.body || undefined,
      labels: Array.isArray(issue.labels)
        ? (issue.labels
            .map((label: { name?: string | null }) => label.name)
            .filter(Boolean) as string[])
        : [],
      comments,
    };
  }

  async listIssueComments(
    accessToken: string,
    owner: string,
    repo: string,
    number: number,
  ): Promise<Array<{ author: string; body: string }>> {
    const url = new URL(
      `https://api.github.com/repos/${owner}/${repo}/issues/${number}/comments`,
    );
    url.searchParams.set('per_page', '10');

    const data = await this.request<GitHubApiIssueComment[]>(
      url.toString(),
      accessToken,
    );
    if (!Array.isArray(data)) {
      return [];
    }

    return data.map((comment) => ({
      author: comment.user?.login || 'unknown',
      body: comment.body || '',
    }));
  }

  async listRepoCommits(
    accessToken: string,
    owner: string,
    repo: string,
    options: { sha?: string; limit?: number } = {},
  ): Promise<GitHubCommitSummary[]> {
    const limit = Math.min(options.limit ?? 10, 50);
    const url = new URL(
      `https://api.github.com/repos/${owner}/${repo}/commits`,
    );
    url.searchParams.set('per_page', String(limit));
    if (options.sha) {
      url.searchParams.set('sha', options.sha);
    }

    const data = await this.request<GitHubApiCommit[]>(
      url.toString(),
      accessToken,
    );
    if (!Array.isArray(data)) {
      return [];
    }

    return data.map((commit) => this.mapCommit(commit));
  }

  async searchIssues(
    accessToken: string,
    query: string,
    limit = 10,
  ): Promise<GitHubIssueSummary[]> {
    const url = new URL('https://api.github.com/search/issues');
    url.searchParams.set('q', query);
    url.searchParams.set('per_page', String(Math.min(limit, 50)));

    const data = await this.request<GitHubApiSearchIssues>(
      url.toString(),
      accessToken,
    );
    if (!data?.items || !Array.isArray(data.items)) {
      return [];
    }

    return data.items.map((issue) => this.mapIssue(issue));
  }

  async getCommitDetails(
    accessToken: string,
    owner: string,
    repo: string,
    sha: string,
  ): Promise<GitHubCommitDetails> {
    const commit = await this.request<GitHubApiCommitDetails>(
      `https://api.github.com/repos/${owner}/${repo}/commits/${sha}`,
      accessToken,
    );

    return {
      ...this.mapCommit(commit),
      additions: commit.stats?.additions ?? undefined,
      deletions: commit.stats?.deletions ?? undefined,
      files: Array.isArray(commit.files)
        ? commit.files.map((file) => ({
            filename: file.filename,
            additions: file.additions,
            deletions: file.deletions,
            changes: file.changes,
            patch: file.patch || undefined,
          }))
        : [],
    };
  }

  async ensureWebhook(
    accessToken: string,
    owner: string,
    repo: string,
    input: {
      url: string;
      secret: string;
      events: string[];
    },
  ): Promise<void> {
    try {
      const hooks = await this.request<GitHubApiWebhook[]>(
        `https://api.github.com/repos/${owner}/${repo}/hooks`,
        accessToken,
      );

      if (Array.isArray(hooks)) {
        const existing = hooks.find((hook) => hook?.config?.url === input.url);
        if (existing) {
          return;
        }
      }
    } catch (error) {
      this.logger.warn(
        { err: error, owner, repo },
        'Failed to list GitHub hooks, will attempt to create',
      );
    }

    await this.request<Record<string, unknown>>(
      `https://api.github.com/repos/${owner}/${repo}/hooks`,
      accessToken,
      {
        method: 'POST',
        body: {
          name: 'web',
          active: true,
          events: input.events,
          config: {
            url: input.url,
            content_type: 'json',
            secret: input.secret,
          },
        },
      },
    );
  }

  verifyWebhookSignature(
    rawBody: string,
    signatureHeader: string | undefined,
    secret: string,
  ): boolean {
    if (!signatureHeader || !secret) {
      return false;
    }

    const expected = `sha256=${crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex')}`;

    try {
      return crypto.timingSafeEqual(
        Buffer.from(expected),
        Buffer.from(signatureHeader),
      );
    } catch {
      return false;
    }
  }

  buildPrSummary(details: GitHubPRDetails): {
    summary: string;
    prContext: {
      filesChanged: number;
      additions: number;
      deletions: number;
      hasTests: boolean;
      hasBreakingChange: boolean;
      hasSecurityRelevant: boolean;
      touchesConfig: boolean;
      touchesInfra: boolean;
      touchesApi: boolean;
      hasDependencyUpdate: boolean;
    };
  } {
    const filesChanged = details.changedFiles || details.files?.length || 0;
    const additions = details.additions || 0;
    const deletions = details.deletions || 0;
    const filenames = details.files?.map((file) => file.filename) || [];
    const hasTests = filenames.some((name) =>
      /test|spec|__tests__/i.test(name),
    );
    const hasBreakingChange =
      /breaking change|breaking/i.test(details.body || '') ||
      filenames.some((name) => /migration|schema/i.test(name));
    const hasSecurityRelevant = filenames.some((name) =>
      /auth|security|permission|token|oauth/i.test(name),
    );
    const touchesConfig = filenames.some((name) =>
      /(config|settings|\\.env|\\.ya?ml|\\.toml|\\.ini|\\.json)/i.test(name),
    );
    const touchesInfra = filenames.some((name) =>
      /(terraform|k8s|kubernetes|helm|docker|ci|infra)/i.test(name),
    );
    const touchesApi = filenames.some((name) =>
      /(api|routes|controllers|handlers|openapi|swagger)/i.test(name),
    );
    const hasDependencyUpdate = filenames.some((name) =>
      /(package\\.json|package-lock\\.json|pnpm-lock\\.yaml|yarn\\.lock|go\\.mod|go\\.sum|pom\\.xml|build\\.gradle)/i.test(
        name,
      ),
    );

    const fileSummary = details.files
      ?.slice(0, 8)
      .map(
        (file) => `- ${file.filename} (+${file.additions}/-${file.deletions})`,
      )
      .join('\n');

    const patchSnippet = details.files
      ?.filter((file) => Boolean(file.patch))
      .slice(0, 3)
      .map(
        (file) =>
          `File: ${file.filename}\n${this.truncate(file.patch || '', 800)}`,
      )
      .join('\n\n');

    const summarySections = [
      `Files changed: ${filesChanged}`,
      `Additions/Deletions: +${additions}/-${deletions}`,
      fileSummary ? `Changed files:\n${fileSummary}` : null,
      patchSnippet ? `Patch excerpts:\n${patchSnippet}` : null,
    ].filter(Boolean);

    return {
      summary: summarySections.join('\n\n'),
      prContext: {
        filesChanged,
        additions,
        deletions,
        hasTests,
        hasBreakingChange,
        hasSecurityRelevant,
        touchesConfig,
        touchesInfra,
        touchesApi,
        hasDependencyUpdate,
      },
    };
  }

  buildCommitSummary(details: GitHubCommitDetails): string {
    const files = details.files || [];
    const fileSummary = files
      .slice(0, 6)
      .map(
        (file) => `- ${file.filename} (+${file.additions}/-${file.deletions})`,
      )
      .join('\n');

    const patchSnippet = files
      .filter((file) => Boolean(file.patch))
      .slice(0, 2)
      .map(
        (file) =>
          `File: ${file.filename}\n${this.truncate(file.patch || '', 800)}`,
      )
      .join('\n\n');

    return [
      `Commit: ${details.sha.slice(0, 7)} ${details.message}`,
      `Additions/Deletions: +${details.additions || 0}/-${details.deletions || 0}`,
      fileSummary ? `Changed files:\n${fileSummary}` : null,
      patchSnippet ? `Patch excerpts:\n${patchSnippet}` : null,
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  private async request<T>(
    url: string,
    accessToken: string,
    options: { method?: string; body?: Record<string, unknown> } = {},
  ): Promise<T> {
    return this.requestWithAuth<T>(url, accessToken, {
      method: options.method,
      body: options.body,
    });
  }

  private async requestWithAuth<T>(
    url: string,
    token: string,
    options: {
      method?: string;
      body?: Record<string, unknown>;
      authScheme?: 'Bearer' | 'token';
    } = {},
  ): Promise<T> {
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: {
        Authorization: `${options.authScheme || 'Bearer'} ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(options.method && options.method !== 'GET'
          ? { 'Content-Type': 'application/json' }
          : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error({ url, error }, 'GitHub API request failed');
      throw new Error(`GitHub API request failed (${response.status})`);
    }

    return (await response.json()) as T;
  }

  private buildAppJwt(): string {
    if (!this.appId || !this.appPrivateKey) {
      throw new Error('GitHub App is not configured');
    }

    const privateKey = this.appPrivateKey.replace(/\\n/g, '\n');
    const now = Math.floor(Date.now() / 1000);

    return jwt.sign(
      {
        iat: now - 60,
        exp: now + 540,
        iss: this.appId,
      },
      privateKey,
      {
        algorithm: 'RS256',
      },
    );
  }

  private isInstallationToken(token: string): boolean {
    return token.startsWith('ghs_');
  }

  private mapRepository(repo: GitHubApiRepository): GitHubRepository {
    return {
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      owner: repo.owner?.login || '',
      description: repo.description || undefined,
      language: repo.language || undefined,
      defaultBranch: repo.default_branch,
      private: repo.private,
      htmlUrl: repo.html_url || undefined,
    };
  }

  private mapPullRequest(pr: GitHubApiPullRequest): GitHubPullRequestSummary {
    return {
      id: pr.id,
      number: pr.number,
      title: pr.title,
      state: pr.state,
      merged: pr.merged || pr.merged_at != null,
      draft: pr.draft || undefined,
      htmlUrl: pr.html_url || undefined,
      createdAt: pr.created_at || undefined,
      updatedAt: pr.updated_at || undefined,
      author: pr.user?.login || undefined,
      baseBranch: pr.base?.ref || undefined,
    };
  }

  private mapIssue(issue: GitHubApiIssue): GitHubIssueSummary {
    return {
      id: issue.id,
      number: issue.number,
      title: issue.title,
      state: issue.state,
      htmlUrl: issue.html_url || undefined,
      createdAt: issue.created_at || undefined,
      updatedAt: issue.updated_at || undefined,
      author: issue.user?.login || undefined,
    };
  }

  private mapCommit(commit: GitHubApiCommit): GitHubCommitSummary {
    return {
      sha: commit.sha,
      message: commit.commit?.message || commit.message || '',
      author: commit.commit?.author?.name || commit.author?.login || undefined,
      htmlUrl: commit.html_url || undefined,
      date: commit.commit?.author?.date || commit.committer?.date || undefined,
    };
  }

  private truncate(text: string, max: number): string {
    if (text.length <= max) {
      return text;
    }

    return `${text.slice(0, max)}...`;
  }
}
