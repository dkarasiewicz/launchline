import { Injectable, Logger } from '@nestjs/common';
import {
  DomainEventType,
  EVENT_BUS_EXCHANGE,
  EventType,
  IntegrationConnectedEvent,
  IntegrationWebhookReceivedEvent,
  Public,
} from '@launchline/core-common';
import {
  IntegrationFacade,
  IntegrationType,
  GitHubService,
  SlackService,
} from '@launchline/core-integration';
import {
  RabbitSubscribe,
  MessageHandlerErrorBehavior,
} from '@golevelup/nestjs-rabbitmq';
import { OnboardingGraphsFactory } from './services';
import { LineaFacade } from './linea.facade';
import { randomUUID } from 'crypto';
import { SourceType } from './types';
import { AssistantService } from './assistant.service';
import { LineaJobsService } from './jobs/linea-jobs.service';
import { AgentFactory } from './services/agent.factory';

const LINEA_DOMAIN = 'LINEA';

@Injectable()
export class LineaQueue {
  private readonly logger = new Logger(LineaQueue.name);

  constructor(
    private readonly onboardingGraphsFactory: OnboardingGraphsFactory,
    private readonly integrationFacade: IntegrationFacade,
    private readonly lineaFacade: LineaFacade,
    private readonly githubService: GitHubService,
    private readonly slackService: SlackService,
    private readonly assistantService: AssistantService,
    private readonly lineaJobsService: LineaJobsService,
    private readonly agentFactory: AgentFactory,
  ) {}

  @Public()
  @RabbitSubscribe({
    exchange: EVENT_BUS_EXCHANGE,
    routingKey: 'events.#',
    queue: `${LINEA_DOMAIN}-domain-queue`,
    errorBehavior: MessageHandlerErrorBehavior.REQUEUE,
  })
  public async handleMessage(domainEvent: DomainEventType) {
    this.logger.debug({ domainEvent }, 'Received domain event');

    switch (domainEvent.eventType) {
      case EventType.INTEGRATION_CONNECTED: {
        await this.handleIntegrationConnected(
          domainEvent as IntegrationConnectedEvent,
        );
        break;
      }
      case EventType.INTEGRATION_WEBHOOK_RECEIVED: {
        await this.handleWebhookReceived(
          domainEvent as IntegrationWebhookReceivedEvent,
        );
        break;
      }
    }
  }

  /**
   * Handle incoming webhook events from integrations
   * Routes to appropriate processing based on integration type
   */
  private async handleWebhookReceived(
    event: IntegrationWebhookReceivedEvent,
  ): Promise<void> {
    const { payload } = event;

    this.logger.debug(
      `Processing webhook: ${payload.integrationType}/${payload.eventType}/${payload.action}`,
    );

    if (payload.integrationType === IntegrationType.LINEAR) {
      await this.processLinearWebhook(payload);
    }

    if (payload.integrationType === IntegrationType.SLACK) {
      await this.processSlackWebhook(payload);
    }

    if (payload.integrationType === IntegrationType.GITHUB) {
      await this.processGitHubWebhook(payload);
    }
  }

  /**
   * Process Linear webhook events through Linea's ingestion pipeline
   */
  private async processLinearWebhook(payload: {
    integrationId: string;
    workspaceId: string;
    eventType: string;
    action?: string;
    payload: string;
  }): Promise<void> {
    try {
      const webhookPayload = JSON.parse(payload.payload);

      // Map Linear event type to Linea event type
      const eventType = `${payload.eventType.toLowerCase()}.${payload.action || 'update'}`;

      // Process through LineaFacade
      const result = await this.lineaFacade.processWebhook({
        workspaceId: payload.workspaceId,
        userId: 'system', // Webhooks are system-initiated
        source: 'linear' as SourceType,
        eventType,
        payload: webhookPayload,
      });

      this.logger.debug(
        `Processed Linear webhook: ${result.normalizedEvents.length} events normalized, ${result.inboxItems.length} inbox items`,
      );
    } catch (error) {
      this.logger.error(
        { err: error, workspaceId: payload.workspaceId },
        'Failed to process Linear webhook',
      );
      // Don't rethrow - we don't want to requeue webhook processing failures
    }
  }

  private async handleIntegrationConnected(
    event: IntegrationConnectedEvent,
  ): Promise<void> {
    const { payload } = event;

    this.logger.log(
      `Integration connected: ${payload.integrationType} for workspace ${payload.workspaceId}`,
    );

    // Handle Linear integration onboarding
    if (payload.integrationType === IntegrationType.LINEAR) {
      await this.triggerLinearOnboarding(
        payload.integrationId,
        payload.workspaceId,
        payload.userId,
      );

      await this.lineaJobsService.ensureHeartbeat(
        payload.workspaceId,
        payload.userId,
      );
    }

    if (payload.integrationType === IntegrationType.SLACK) {
      await this.triggerSlackOnboarding(
        payload.integrationId,
        payload.workspaceId,
        payload.userId,
        payload.externalOrganizationId,
      );

      await this.lineaJobsService.ensureHeartbeat(
        payload.workspaceId,
        payload.userId,
      );
    }

    if (payload.integrationType === IntegrationType.GITHUB) {
      await this.triggerGitHubOnboarding(
        payload.integrationId,
        payload.workspaceId,
        payload.userId,
      );

      await this.lineaJobsService.ensureHeartbeat(
        payload.workspaceId,
        payload.userId,
      );
    }

    // Future: Handle other integration types
    // if (payload.integrationType === IntegrationType.GITHUB) { ... }
    // if (payload.integrationType === IntegrationType.SLACK) { ... }
  }

  private async triggerLinearOnboarding(
    integrationId: string,
    workspaceId: string,
    userId: string,
  ): Promise<void> {
    this.logger.log(
      `Triggering Linear onboarding for workspace ${workspaceId}`,
    );

    try {
      // Get the access token for the integration
      const accessToken =
        await this.integrationFacade.getAccessToken(integrationId);

      if (!accessToken) {
        this.logger.error(
          `No access token found for integration ${integrationId}`,
        );
        return;
      }

      // Create graph context
      const correlationId = randomUUID();
      const ctx = {
        workspaceId,
        userId,
        correlationId,
        threadId: `linear-onboarding-${correlationId}`,
      };

      // Run Linear onboarding
      const result = await this.onboardingGraphsFactory.runLinearOnboarding(
        ctx,
        accessToken,
        // No specific team ID - onboard entire organization
      );

      this.logger.log(
        {
          workspaceId,
          memoriesCreated: result.memoriesCreated.length,
          inboxCandidates: result.inboxCandidates.length,
          errors: result.errors.length,
        },
        'Linear onboarding completed',
      );

      // Create inbox threads for detected items
      if (result.inboxCandidates.length > 0) {
        this.logger.log(
          `Creating ${result.inboxCandidates.length} inbox threads from Linear onboarding`,
        );

        for (const candidate of result.inboxCandidates) {
          try {
            await this.lineaFacade.createInboxThread({
              workspaceId,
              userId,
              type: candidate.type,
              priority: candidate.priority,
              title: candidate.title,
              summary: candidate.summary,
              suggestedActions: candidate.suggestedActions,
              sourceMemoryIds: candidate.sourceMemoryIds,
              entityRefs: candidate.entityRefs,
            });
          } catch (err) {
            this.logger.warn(
              { err, candidateId: candidate.id },
              'Failed to create inbox thread for candidate',
            );
          }
        }
      }

      if (result.errors.length > 0) {
        this.logger.warn(
          { errors: result.errors },
          'Linear onboarding had errors',
        );
      }
    } catch (error) {
      this.logger.error(
        { err: error, workspaceId },
        'Failed to trigger Linear onboarding',
      );
      throw error; // Re-throw to trigger requeue
    }
  }

  private async triggerSlackOnboarding(
    integrationId: string,
    workspaceId: string,
    userId: string,
    slackWorkspaceId?: string,
  ): Promise<void> {
    this.logger.log(
      { workspaceId, slackWorkspaceId },
      'Triggering Slack onboarding',
    );

    try {
      const accessToken =
        await this.integrationFacade.getAccessToken(integrationId);

      if (!accessToken) {
        this.logger.error(
          { integrationId, workspaceId },
          'No Slack access token found for integration',
        );
        return;
      }

      if (!slackWorkspaceId) {
        this.logger.warn(
          { integrationId, workspaceId },
          'Slack onboarding missing workspace id, skipping',
        );
        return;
      }

      const correlationId = randomUUID();
      const ctx = {
        workspaceId,
        userId,
        correlationId,
        threadId: `slack-onboarding-${correlationId}`,
      };

      const result = await this.onboardingGraphsFactory.runSlackOnboarding(
        ctx,
        accessToken,
        slackWorkspaceId,
      );

      this.logger.log(
        {
          workspaceId,
          memoriesCreated: result.memoriesCreated.length,
          errors: result.errors.length,
        },
        'Slack onboarding completed',
      );

      if (result.errors.length > 0) {
        this.logger.warn(
          { errors: result.errors },
          'Slack onboarding had errors',
        );
      }
    } catch (error) {
      this.logger.error(
        { err: error, workspaceId },
        'Failed to trigger Slack onboarding',
      );
      throw error;
    }
  }

  private async triggerGitHubOnboarding(
    integrationId: string,
    workspaceId: string,
    userId: string,
  ): Promise<void> {
    this.logger.log({ workspaceId }, 'Triggering GitHub onboarding');

    try {
      const accessToken =
        await this.integrationFacade.getAccessToken(integrationId);

      if (!accessToken) {
        this.logger.error(
          { integrationId, workspaceId },
          'No GitHub access token found for integration',
        );
        return;
      }

      const correlationId = randomUUID();
      const ctx = {
        workspaceId,
        userId,
        correlationId,
        threadId: `github-onboarding-${correlationId}`,
      };

      const result = await this.onboardingGraphsFactory.runGitHubOnboarding(
        ctx,
        accessToken,
        undefined,
      );

      this.logger.log(
        {
          workspaceId,
          memoriesCreated: result.memoriesCreated.length,
          errors: result.errors.length,
        },
        'GitHub onboarding completed',
      );

      if (result.errors.length > 0) {
        this.logger.warn(
          { errors: result.errors },
          'GitHub onboarding had errors',
        );
      }
    } catch (error) {
      this.logger.error(
        { err: error, workspaceId },
        'Failed to trigger GitHub onboarding',
      );
      throw error;
    }
  }

  private async processSlackWebhook(payload: {
    integrationId: string;
    workspaceId: string;
    eventType: string;
    action?: string;
    payload: string;
  }): Promise<void> {
    try {
      const webhookPayload = JSON.parse(payload.payload);
      const event = webhookPayload.event as
        | {
            type?: string;
            subtype?: string;
            user?: string;
            text?: string;
            channel?: string;
            channel_type?: string;
            ts?: string;
            thread_ts?: string;
            bot_id?: string;
          }
        | undefined;

      if (event && (event.type === 'message' || event.type === 'app_mention')) {
        await this.handleSlackConversation(payload, webhookPayload, event);
      }

      await this.lineaFacade.processWebhook({
        workspaceId: payload.workspaceId,
        userId: 'system',
        source: 'slack' as SourceType,
        eventType: payload.eventType,
        payload: webhookPayload,
      });
    } catch (error) {
      this.logger.error(
        { err: error, workspaceId: payload.workspaceId },
        'Failed to process Slack webhook',
      );
    }
  }

  private async processGitHubWebhook(payload: {
    integrationId: string;
    workspaceId: string;
    eventType: string;
    action?: string;
    payload: string;
  }): Promise<void> {
    try {
      const webhookPayload = JSON.parse(payload.payload);
      const eventType = payload.eventType || 'github_event';
      const action = payload.action;

      if (
        eventType === 'pull_request' &&
        action &&
        !['opened', 'reopened', 'synchronize', 'closed'].includes(action)
      ) {
        return;
      }

      if (
        eventType === 'issues' &&
        action &&
        !['opened', 'reopened'].includes(action)
      ) {
        return;
      }

      const accessToken = await this.integrationFacade.getAccessToken(
        payload.integrationId,
      );

      let enrichedPayload = webhookPayload as Record<string, unknown>;

      if (accessToken) {
        const repo = webhookPayload.repository as
          | { name?: string; owner?: { login?: string }; default_branch?: string }
          | undefined;
        const owner = repo?.owner?.login;
        const repoName = repo?.name;

        if (eventType === 'pull_request' && owner && repoName) {
          const prPayload = webhookPayload.pull_request as
            | { number?: number; merged?: boolean }
            | undefined;

          if (action === 'closed' && !prPayload?.merged) {
            return;
          }

          const pr = webhookPayload.pull_request as
            | { number?: number }
            | undefined;
          if (pr?.number) {
            const details = await this.githubService.getPullRequestDetails(
              accessToken,
              owner,
              repoName,
              pr.number,
            );
            const summary = this.githubService.buildPrSummary(details);
            enrichedPayload = {
              ...webhookPayload,
              linea: {
                pr: details,
                prSummary: summary.summary,
                prContext: summary.prContext,
              },
            };
          }
        }

        if (eventType === 'issues' && owner && repoName) {
          const issue = webhookPayload.issue as
            | { number?: number }
            | undefined;
          if (issue?.number) {
            const details = await this.githubService.getIssueDetails(
              accessToken,
              owner,
              repoName,
              issue.number,
            );
            enrichedPayload = {
              ...webhookPayload,
              linea: {
                issue: details,
              },
            };
          }
        }

        if (eventType === 'push' && owner && repoName) {
          const ref = webhookPayload.ref as string | undefined;
          const branch = ref?.replace('refs/heads/', '');
          const defaultBranch = repo?.default_branch || 'main';
          if (branch && branch !== defaultBranch) {
            return;
          }

          const headCommit = webhookPayload.head_commit as
            | { id?: string }
            | undefined;
          if (headCommit?.id) {
            const details = await this.githubService.getCommitDetails(
              accessToken,
              owner,
              repoName,
              headCommit.id,
            );
            const summary = this.githubService.buildCommitSummary(details);
            enrichedPayload = {
              ...webhookPayload,
              linea: {
                commit: details,
                commitSummary: summary,
                branch: branch || defaultBranch,
              },
            };
          }
        }
      }

      const resolvedEventType = action
        ? `github.${eventType}.${action}`
        : `github.${eventType}`;

      await this.lineaFacade.processWebhook({
        workspaceId: payload.workspaceId,
        userId: 'system',
        source: 'github' as SourceType,
        eventType: resolvedEventType,
        payload: enrichedPayload,
      });
    } catch (error) {
      this.logger.error(
        { err: error, workspaceId: payload.workspaceId },
        'Failed to process GitHub webhook',
      );
    }
  }

  private async handleSlackConversation(
    payload: { integrationId: string; workspaceId: string },
    webhookPayload: Record<string, unknown>,
    event: {
      type?: string;
      subtype?: string;
      user?: string;
      text?: string;
      channel?: string;
      channel_type?: string;
      ts?: string;
      thread_ts?: string;
      bot_id?: string;
    },
  ): Promise<void> {
    if (event.subtype || event.bot_id) {
      return;
    }

    const channel = event.channel;
    if (!channel || !event.text || !event.ts) {
      return;
    }

    const isDirectMessage = event.channel_type === 'im';
    const isMention = event.type === 'app_mention';

    if (!isDirectMessage && !isMention) {
      return;
    }

    const accessToken = await this.integrationFacade.getAccessToken(
      payload.integrationId,
    );
    if (!accessToken) {
      this.logger.error(
        { integrationId: payload.integrationId },
        'Slack access token missing for reply',
      );
      return;
    }

    const threadRoot = event.thread_ts || event.ts;
    const threadId = `slack-${payload.workspaceId}-${channel}-${threadRoot}`;
    const userId = event.user ? `slack:${event.user}` : 'slack:unknown';

    const existingThread = await this.assistantService.getThread(threadId);
    if (!existingThread) {
      await this.assistantService.initializeThread(
        payload.workspaceId,
        userId,
        threadId,
      );
    }

    const cleanedText = isMention
      ? event.text.replace(/<@[^>]+>/g, '').trim()
      : event.text.trim();

    if (!cleanedText) {
      return;
    }

    const agent = await this.agentFactory.getAgentForWorkspace(
      payload.workspaceId,
    );

    const messages: Array<{ type: string; content: string }> = [
      { type: 'human', content: cleanedText },
    ];

    const result = (await agent.invoke(
      { messages },
      {
        configurable: {
          thread_id: threadId,
          workspaceId: payload.workspaceId,
          userId,
        },
      },
    )) as { messages?: Array<{ content?: unknown }> } | undefined;

    const lastMessage = result?.messages?.at(-1);
    const reply =
      typeof lastMessage?.content === 'string'
        ? lastMessage.content
        : Array.isArray(lastMessage?.content)
          ? lastMessage.content.map((part) => String(part)).join('\n')
          : null;

    if (!reply) {
      this.logger.warn(
        { eventType: event.type, workspaceId: payload.workspaceId },
        'Slack reply missing from agent response',
      );
      return;
    }

    await this.slackService.postMessage(
      accessToken,
      channel,
      reply,
      event.thread_ts || event.ts,
    );

    this.logger.debug(
      {
        workspaceId: payload.workspaceId,
        channel,
        eventType: event.type,
        eventId: webhookPayload['event_id'],
      },
      'Replied to Slack message',
    );
  }

  // No thread history check needed; workspace prompt is embedded in agent.
}
