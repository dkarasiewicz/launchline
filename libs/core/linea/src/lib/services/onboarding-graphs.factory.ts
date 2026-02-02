import { Injectable, Logger } from '@nestjs/common';
import type { GraphContext, InboxItemCandidate, LinkedIdentity } from '../types';
import { GitHubOnboardingGraphsService } from './github-onboarding-graphs.service';
import {
  IdentityLinkingGraphsService,
  type GitHubAccount,
  type LinearAccount,
  type SlackAccount,
  type UnmatchedAccount,
} from './identity-linking-graphs.service';
import { LinearOnboardingGraphsService } from './linear-onboarding-graphs.service';
import { SlackOnboardingGraphsService } from './slack-onboarding-graphs.service';

@Injectable()
export class OnboardingGraphsFactory {
  private readonly logger = new Logger(OnboardingGraphsFactory.name);

  constructor(
    private readonly linearOnboardingGraphs: LinearOnboardingGraphsService,
    private readonly githubOnboardingGraphs: GitHubOnboardingGraphsService,
    private readonly slackOnboardingGraphs: SlackOnboardingGraphsService,
    private readonly identityLinkingGraphs: IdentityLinkingGraphsService,
  ) {}

  private buildGraphConfig(ctx: GraphContext) {
    return {
      configurable: {
        thread_id: ctx.threadId ?? ctx.correlationId,
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
      },
    };
  }

  async runLinearOnboarding(
    ctx: GraphContext,
    accessToken: string,
    linearTeamId?: string,
  ): Promise<{
    memoriesCreated: string[];
    inboxCandidates: InboxItemCandidate[];
    errors: string[];
  }> {
    this.logger.log(
      { workspaceId: ctx.workspaceId, correlationId: ctx.correlationId },
      'Starting Linear onboarding',
    );

    const graph = this.linearOnboardingGraphs.getGraph();
    const result = await graph.invoke(
      {
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
        correlationId: ctx.correlationId,
        accessToken,
        linearTeamId: linearTeamId || null,
      },
      this.buildGraphConfig(ctx),
    );

    return {
      memoriesCreated: result.memoriesCreated,
      inboxCandidates: result.inboxCandidates,
      errors: result.errors,
    };
  }

  async runGitHubOnboarding(
    ctx: GraphContext,
    githubToken: string,
    githubInstallationId?: string,
    repositories?: string[],
  ): Promise<{ memoriesCreated: string[]; errors: string[] }> {
    this.logger.log(
      { workspaceId: ctx.workspaceId, correlationId: ctx.correlationId },
      'Starting GitHub onboarding',
    );

    const graph = this.githubOnboardingGraphs.getGraph();
    const result = await graph.invoke(
      {
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
        correlationId: ctx.correlationId,
        githubToken,
        githubInstallationId: githubInstallationId || null,
        repositories: repositories || [],
      },
      this.buildGraphConfig(ctx),
    );

    return {
      memoriesCreated: result.memoriesCreated,
      errors: result.errors,
    };
  }

  async runSlackOnboarding(
    ctx: GraphContext,
    slackToken: string,
    slackWorkspaceId: string,
  ): Promise<{ memoriesCreated: string[]; errors: string[] }> {
    this.logger.log(
      { workspaceId: ctx.workspaceId, correlationId: ctx.correlationId },
      'Starting Slack onboarding',
    );

    const graph = this.slackOnboardingGraphs.getGraph();
    const result = await graph.invoke(
      {
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
        correlationId: ctx.correlationId,
        slackToken,
        slackWorkspaceId,
      },
      this.buildGraphConfig(ctx),
    );

    return {
      memoriesCreated: result.memoriesCreated,
      errors: result.errors,
    };
  }

  async runIdentityLinking(
    ctx: GraphContext,
    accounts: {
      github?: GitHubAccount[];
      linear?: LinearAccount[];
      slack?: SlackAccount[];
    },
  ): Promise<{
    linkedIdentities: LinkedIdentity[];
    unmatchedAccounts: UnmatchedAccount[];
    memoriesCreated: string[];
    errors: string[];
  }> {
    this.logger.log(
      { workspaceId: ctx.workspaceId, correlationId: ctx.correlationId },
      'Starting identity linking',
    );

    const graph = this.identityLinkingGraphs.getGraph();
    const result = await graph.invoke(
      {
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
        correlationId: ctx.correlationId,
        githubAccounts: accounts.github || [],
        linearAccounts: accounts.linear || [],
        slackAccounts: accounts.slack || [],
      },
      this.buildGraphConfig(ctx),
    );

    return {
      linkedIdentities: result.linkedIdentities,
      unmatchedAccounts: result.unmatchedAccounts,
      memoriesCreated: result.memoriesCreated,
      errors: result.errors,
    };
  }
}
