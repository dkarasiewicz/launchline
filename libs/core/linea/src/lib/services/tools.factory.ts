import { Inject, Injectable, Logger } from '@nestjs/common';
import { type StructuredToolInterface, tool } from '@langchain/core/tools';
import { RunnableConfig } from '@langchain/core/runnables';
import { TavilySearch } from '@langchain/tavily';
import { Command } from '@langchain/langgraph';
import {
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from '@langchain/core/messages';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { MemoryService } from './memory.service';
import { LinearSkillsFactory } from './linear-skills.factory';
import { LINEA_MODEL_FAST, LINEA_STORE } from '../tokens';
import { PostgresStore } from '@langchain/langgraph-checkpoint-postgres/store';
import {
  IntegrationFacade,
  IntegrationType,
  GoogleService,
  GitHubService,
  SlackService,
  type GmailMessageSummary,
  type CalendarEventSummary,
} from '@launchline/core-integration';
import {
  CreateGitHubIssueInputSchema,
  GetGitHubPullRequestsInputSchema,
  GetGitHubPullRequestDetailsInputSchema,
  GetGitHubIssuesInputSchema,
  SearchGitHubIssuesInputSchema,
  GetGitHubCommitsInputSchema,
  GenerateProjectUpdateInputSchema,
  GetBlockersInputSchema,
  GetDecisionsInputSchema,
  GetInboxItemsInputSchema,
  GetLatestEmailsInputSchema,
  GetCalendarEventsInputSchema,
  GetTeamInsightsInputSchema,
  GetWorkspaceStatusInputSchema,
  type GraphContext,
  InternetSearchInputSchema,
  LogDecisionInputSchema,
  type MemoryCategory,
  type MemoryNamespace,
  ResolveIdentityInputSchema,
  ScheduleStandupDigestInputSchema,
  RunSandboxCommandInputSchema,
  RunSandboxWorkflowInputSchema,
  ScheduleCalendarEventInputSchema,
  ScheduleTaskInputSchema,
  SaveMemoryInputSchema,
  SearchMemoriesInputSchema,
  SendSlackMessageInputSchema,
  ReplyToEmailInputSchema,
  SummarizeSlackChannelInputSchema,
  ThinkInputSchema,
  UpdateLinearTicketInputSchema,
  GetWorkspacePromptInputSchema,
  UpdateWorkspacePromptInputSchema,
  AppendWorkspacePromptInputSchema,
} from '../types';
import { TOOL_DESCRIPTIONS } from '../prompts';
import { LineaJobsService } from '../jobs/linea-jobs.service';
import { AgentPromptService } from './agent-prompt.service';
import { TeamInsightsService } from './team-insights.service';
import { SandboxService } from './sandbox.service';
import { WorkspaceSkillsService } from './workspace-skills.service';

function getWorkspaceId(config: RunnableConfig): string {
  const configurable = config?.configurable as
    | Record<string, unknown>
    | undefined;
  return (configurable?.['workspaceId'] as string) || 'default';
}

function getUserId(config: RunnableConfig): string {
  const configurable = config?.configurable as
    | Record<string, unknown>
    | undefined;
  return (configurable?.['userId'] as string) || 'unknown';
}

function getThreadId(config: RunnableConfig): string | undefined {
  const configurable = config?.configurable as
    | Record<string, unknown>
    | undefined;
  return configurable?.['thread_id'] as string | undefined;
}

function getToolCallId(config: RunnableConfig): string {
  // LangGraph passes tool call context
  const toolCall = (config as Record<string, unknown>)?.['toolCall'] as
    | { id?: string }
    | undefined;
  return toolCall?.id || `tool-${Date.now()}`;
}

function looksLikeExecutionTask(task: string): boolean {
  const actionHint =
    /(create|file|open|send|post|schedule|reply|comment|update|assign|close|merge|label|draft)/i;
  const targetHint =
    /(linear|ticket|issue|bug|github|pull request|pr|slack|email|calendar|meeting|invite)/i;
  return actionHint.test(task) && targetHint.test(task);
}

function createContext(config: RunnableConfig): GraphContext {
  return {
    workspaceId: getWorkspaceId(config),
    userId: getUserId(config),
    correlationId: `tool-${Date.now()}`,
  };
}

async function getIntegrationToken(
  integrationFacade: IntegrationFacade,
  workspaceId: string,
  type: IntegrationType,
): Promise<string | null> {
  const integrations = await integrationFacade.getIntegrationsByType(
    workspaceId,
    type,
  );

  if (!integrations.length) {
    return null;
  }

  return integrationFacade.getAccessToken(integrations[0].id);
}

@Injectable()
export class ToolsFactory {
  private readonly logger = new Logger(ToolsFactory.name);

  constructor(
    private readonly memoryService: MemoryService,
    private readonly linearSkillsFactory: LinearSkillsFactory,
    private readonly integrationFacade: IntegrationFacade,
    private readonly slackService: SlackService,
    private readonly googleService: GoogleService,
    private readonly githubService: GitHubService,
    private readonly lineaJobsService: LineaJobsService,
    private readonly agentPromptService: AgentPromptService,
    private readonly teamInsightsService: TeamInsightsService,
    private readonly sandboxService: SandboxService,
    private readonly workspaceSkillsService: WorkspaceSkillsService,
    @Inject(LINEA_MODEL_FAST)
    private readonly modelFast: BaseChatModel,
    @Inject(LINEA_STORE)
    private readonly store: PostgresStore,
  ) {}

  createAllTools(): StructuredToolInterface[] {
    return [
      ...this.createMemoryTools(),
      ...this.createInboxTools(),
      ...this.linearSkillsFactory.createLinearSkills(),
      ...this.createGitHubTools(),
      ...this.createProjectUpdateTools(),
      ...this.createActionTools(),
      ...this.createSearchTools(),
      ...this.createUtilityTools(),
    ];
  }

  private createMemoryTools(): StructuredToolInterface[] {
    return [
      this.createSearchMemoriesTool(),
      this.createSaveMemoryTool(),
      this.createGetBlockersTool(),
      this.createGetDecisionsTool(),
      this.createResolveIdentityTool(),
      this.createLogDecisionTool(),
      this.createGetTeamInsightsTool(),
      this.createGetWorkspacePromptTool(),
      this.createUpdateWorkspacePromptTool(),
      this.createAppendWorkspacePromptTool(),
    ];
  }

  private createInboxTools(): StructuredToolInterface[] {
    return [
      this.createGetInboxItemsTool(),
      this.createGetWorkspaceStatusTool(),
    ];
  }

  private createActionTools(): StructuredToolInterface[] {
    return [
      this.createUpdateLinearTicketTool(),
      this.createSendSlackMessageTool(),
      this.createReplyToEmailTool(),
      this.createScheduleCalendarEventTool(),
      this.createCreateGitHubIssueTool(),
    ];
  }

  private createProjectUpdateTools(): StructuredToolInterface[] {
    return [this.createGenerateProjectUpdateTool()];
  }

  private createSearchTools(): StructuredToolInterface[] {
    return [
      this.createInternetSearchTool(),
      this.createSummarizeSlackChannelTool(),
      this.createGetLatestEmailsTool(),
      this.createGetCalendarEventsTool(),
    ];
  }

  private createGitHubTools(): StructuredToolInterface[] {
    return [
      this.createGetGitHubPullRequestsTool(),
      this.createGetGitHubPullRequestDetailsTool(),
      this.createGetGitHubIssuesTool(),
      this.createSearchGitHubIssuesTool(),
      this.createGetGitHubCommitsTool(),
    ];
  }

  private createUtilityTools(): StructuredToolInterface[] {
    return [
      this.createThinkTool(),
      this.createScheduleTaskTool(),
      this.createScheduleStandupDigestTool(),
      this.createRunSandboxWorkflowTool(),
    ];
  }

  private createRunSandboxCommandTool(): StructuredToolInterface {
    const sandboxService = this.sandboxService;
    const logger = this.logger;

    return tool(
      async ({ command, timeoutMs, image }, config) => {
        const workspaceId = getWorkspaceId(config);

        try {
          const result = await sandboxService.runCommand({
            workspaceId,
            command,
            timeoutMs,
            image,
          });

          return JSON.stringify(result);
        } catch (error) {
          logger.error(
            { err: error, workspaceId },
            'Failed to run sandbox command',
          );

          return JSON.stringify({
            output: error instanceof Error ? error.message : 'Sandbox error',
            exitCode: null,
            durationMs: 0,
            truncated: false,
          });
        }
      },
      {
        name: 'run_sandbox_command',
        description: TOOL_DESCRIPTIONS.runSandboxCommand,
        schema: RunSandboxCommandInputSchema,
      },
    );
  }

  private createRunSandboxWorkflowTool(): StructuredToolInterface {
    const sandboxService = this.sandboxService;
    const workspaceSkillsService = this.workspaceSkillsService;
    const logger = this.logger;

    return tool(
      async (
        {
          goal,
          sourceSkill,
          saveSkill,
          steps,
          timeoutMs,
          image,
          persistWorkspace,
          sessionId,
          keepAlive,
          closeSession,
        },
        config,
      ) => {
        const workspaceId = getWorkspaceId(config);
        const resolvedSteps = steps ?? [];

        try {
          if (!closeSession && this.requiresSandboxWorkflowApproval(goal, resolvedSteps)) {
            return JSON.stringify({
              goal,
              steps: [],
              success: false,
              exitCode: null,
              durationMs: 0,
              truncated: false,
              summary:
                'Approval required for sensitive workflow. Confirm before running.',
              skillSaved: false,
              skillSaveError: null,
              skillTitle: null,
              requiresApproval: true,
              sessionId,
            });
          }

          const result = await sandboxService.runWorkflow({
            workspaceId,
            goal,
            steps: resolvedSteps,
            timeoutMs,
            image,
            persistWorkspace,
            sessionId,
            keepAlive,
            closeSession,
          });

          let skillSaved = false;
          let skillSaveError: string | null = null;
          let skillTitle: string | null = null;

          const hasSourceSkill =
            typeof sourceSkill === 'string' && sourceSkill.trim().length > 0;
          const shouldSaveSkill =
            result.success &&
            !closeSession &&
            resolvedSteps.length > 0 &&
            (saveSkill ?? !hasSourceSkill);

          if (shouldSaveSkill) {
            const targetSkillName = hasSourceSkill ? sourceSkill!.trim() : goal;
            const skill = this.buildSandboxWorkflowSkill({
              title: targetSkillName,
              goal,
              steps: resolvedSteps,
              image,
              persistWorkspace,
            });
            skillTitle = targetSkillName;
            try {
              await workspaceSkillsService.upsertWorkspaceSkill(
                workspaceId,
                targetSkillName,
                skill.content,
                hasSourceSkill ? { id: targetSkillName } : undefined,
              );
              skillSaved = true;
            } catch (error) {
              skillSaveError =
                error instanceof Error
                  ? error.message
                  : 'Failed to save workflow skill';
              logger.error(
                { err: error, workspaceId, goal },
                'Failed to save sandbox workflow skill',
              );
            }
          }

          return JSON.stringify({
            ...result,
            skillSaved,
            skillSaveError,
            skillTitle,
            requiresApproval: false,
          });
        } catch (error) {
          logger.error(
            { err: error, workspaceId, goal },
            'Failed to run sandbox workflow',
          );

          return JSON.stringify({
            goal,
            steps: [],
            success: false,
            exitCode: null,
            durationMs: 0,
            truncated: false,
            summary:
              error instanceof Error ? error.message : 'Sandbox workflow error',
            skillSaved: false,
            skillSaveError: null,
            skillTitle: null,
            requiresApproval: false,
            sessionId,
          });
        }
      },
      {
        name: 'run_sandbox_workflow',
        description: TOOL_DESCRIPTIONS.runSandboxWorkflow,
        schema: RunSandboxWorkflowInputSchema,
      },
    );
  }

  private buildSandboxWorkflowSkill(input: {
    title?: string;
    goal: string;
    steps: Array<{ name: string; command: string }>;
    image?: string;
    persistWorkspace?: boolean;
  }): { title: string; content: string } {
    const trimmedGoal = input.goal.trim();
    const resolvedTitle =
      input.title && input.title.trim().length > 0
        ? input.title.trim()
        : trimmedGoal.length > 0
          ? trimmedGoal
          : 'Sandbox Workflow';
    const persistWorkspace = input.persistWorkspace ?? true;
    const lines: string[] = [];

    lines.push(`# ${resolvedTitle}`);
    lines.push('');
    lines.push(`Goal: ${trimmedGoal || resolvedTitle}`);
    lines.push('');
    lines.push('## Preconditions');
    lines.push(
      `- Sandbox image: ${input.image ? input.image : 'Default sandbox image'}`,
    );
    lines.push(
      `- Workspace persistence: ${persistWorkspace ? 'enabled' : 'disabled'}`,
    );
    lines.push(
      '- Required env/tokens: Provide any tokens referenced in steps.',
    );
    lines.push('');
    lines.push('## Steps');

    input.steps.forEach((step, index) => {
      lines.push(`${index + 1}. ${step.name}`);
      lines.push('```bash');
      lines.push(step.command);
      lines.push('```');
    });

    lines.push('');
    lines.push('## Verification');
    lines.push('- Confirm each step exits with code 0.');
    lines.push('- Verify expected files/output in /workspace.');
    lines.push('');
    lines.push('## Troubleshooting');
    lines.push('- Re-run the failing step alone to inspect output.');
    lines.push('- If installs fail, check network/registry access.');

    return { title: resolvedTitle, content: lines.join('\n') };
  }

  private requiresSandboxWorkflowApproval(
    goal: string,
    steps: Array<{ name: string; command: string }>,
  ): boolean {
    if (process.env['LINEA_SANDBOX_WORKFLOW_REQUIRE_APPROVAL'] !== 'true') {
      return false;
    }

    const keywords = (
      process.env['LINEA_SANDBOX_WORKFLOW_APPROVAL_KEYWORDS'] ||
      'create account,sign up,signup,register,billing,payment,checkout,delete,remove,drop'
    )
      .split(',')
      .map((keyword) => keyword.trim().toLowerCase())
      .filter(Boolean);

    if (keywords.length === 0) {
      return false;
    }

    const haystack = [
      goal,
      ...steps.map((step) => `${step.name} ${step.command}`),
    ]
      .join(' ')
      .toLowerCase();

    return keywords.some((keyword) => haystack.includes(keyword));
  }

  private createScheduleTaskTool(): StructuredToolInterface {
    const jobsService = this.lineaJobsService;
    const logger = this.logger;

    return tool(
      async (
        {
          task,
          runAt,
          cron,
          timezone,
          mode = 'suggest',
          name,
          deliverToInbox,
          replyToThreadId,
        },
        config,
      ) => {
        const workspaceId = getWorkspaceId(config);
        const userId = getUserId(config);
        const currentThreadId = getThreadId(config);
        const resolvedReplyToThreadId = replyToThreadId ?? currentThreadId;
        const resolvedMode =
          mode === 'execute' || looksLikeExecutionTask(task)
            ? 'execute'
            : 'suggest';
        const resolvedDeliverToInbox =
          deliverToInbox ?? !resolvedReplyToThreadId;

        let runAtDate: Date | undefined;
        if (runAt) {
          runAtDate = new Date(runAt);
          if (Number.isNaN(runAtDate.getTime())) {
            return 'Invalid runAt timestamp. Provide an ISO 8601 datetime.';
          }
        }

        try {
          const result = await jobsService.scheduleTask({
            workspaceId,
            userId,
            task,
            runAt: runAtDate,
            cron,
            timezone,
            mode: resolvedMode,
            name,
            deliverToInbox: resolvedDeliverToInbox,
            replyToThreadId: resolvedReplyToThreadId,
          });

          if (result.cron) {
            return `Scheduled recurring task (${result.jobId}) with cron: ${result.cron} (${resolvedMode}).`;
          }

          if (result.runAt) {
            return `Scheduled task (${result.jobId}) for ${result.runAt.toISOString()} (${resolvedMode}).`;
          }

          return `Scheduled task (${result.jobId}) (${resolvedMode}).`;
        } catch (error) {
          logger.error(
            { err: error, workspaceId, userId },
            'Failed to schedule task',
          );

          return `Failed to schedule task: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
      },
      {
        name: 'schedule_task',
        description: TOOL_DESCRIPTIONS.scheduleTask,
        schema: ScheduleTaskInputSchema,
      },
    );
  }

  private createSearchMemoriesTool() {
    const memoryService = this.memoryService;
    const logger = this.logger;

    return tool(
      async ({ query, namespace, limit = 10 }, config) => {
        const workspaceId = getWorkspaceId(config);

        try {
          const results = await memoryService.searchMemories({
            workspaceId,
            namespaces: namespace ? [namespace] : undefined,
            query,
            limit,
          });

          const memories = results.map((memory) => {
            const createdAt =
              memory.createdAt instanceof Date
                ? memory.createdAt
                : new Date(memory.createdAt);
            const timestamp = Number.isNaN(createdAt.valueOf())
              ? new Date().toISOString()
              : createdAt.toISOString();

            return {
              id: memory.id,
              content: memory.summary || memory.content,
              category: memory.category,
              namespace: memory.namespace,
              importance: memory.importance,
              timestamp,
            };
          });

          return JSON.stringify({ memories });
        } catch (error) {
          logger.error(
            { err: error, workspaceId, query, namespace, limit },
            'Search memories failed',
          );

          return JSON.stringify({
            memories: [],
            error:
              error instanceof Error
                ? error.message
                : 'Unknown error searching memories',
          });
        }
      },
      {
        name: 'search_memories',
        description: TOOL_DESCRIPTIONS.searchMemories,
        schema: SearchMemoriesInputSchema,
      },
    );
  }

  private createSaveMemoryTool() {
    const memoryService = this.memoryService;
    const logger = this.logger;

    return tool(
      async (
        { content, summary, namespace, category, importance = 0.5, entityId },
        config,
      ) => {
        const ctx = createContext(config);
        const toolCallId = getToolCallId(config);

        try {
          const memory = await memoryService.saveMemory(ctx, {
            content,
            summary,
            namespace: namespace as MemoryNamespace,
            category: category as MemoryCategory,
            importance,
            confidence: 0.8,
            sourceEventIds: [],
            relatedEntityIds: entityId ? [entityId] : [],
            relatedMemoryIds: [],
            entityRefs: {},
          });

          // Return Command to update graph state with the saved memory reference
          // This enables tracking which memories were created in this conversation
          return new Command({
            update: {
              messages: [
                new ToolMessage({
                  content: `Memory saved successfully with ID: ${memory.id}`,
                  tool_call_id: toolCallId,
                }),
              ],
              // Update short-term state to track last saved memory
              lastSavedMemoryId: memory.id,
            },
          });
        } catch (error) {
          logger.error(
            {
              err: error,
              workspaceId: ctx.workspaceId,
              namespace,
              category,
              entityId,
            },
            'Save memory failed',
          );
          return `Error saving memory: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
      },
      {
        name: 'save_memory',
        description:
          'Save important information to workspace memory for future reference.',
        schema: SaveMemoryInputSchema,
      },
    );
  }

  private createLogDecisionTool() {
    const memoryService = this.memoryService;
    const logger = this.logger;

    return tool(
      async (
        { title, decision, rationale, impact, relatedTicketIds, importance },
        config,
      ) => {
        const ctx = createContext(config);

        const contentLines = [
          `Decision: ${decision}`,
          rationale ? `Rationale: ${rationale}` : null,
          impact ? `Impact: ${impact}` : null,
          relatedTicketIds?.length
            ? `Related tickets: ${relatedTicketIds.join(', ')}`
            : null,
        ].filter(Boolean) as string[];

        try {
          const memory = await memoryService.saveMemory(ctx, {
            namespace: 'decision',
            category: 'decision',
            content: contentLines.join('\n'),
            summary: title,
            importance: importance ?? 0.6,
            confidence: 1,
            sourceEventIds: [],
            relatedEntityIds: relatedTicketIds ?? [],
            relatedMemoryIds: [],
            entityRefs: {
              ticketIds: relatedTicketIds ?? undefined,
            },
          });

          return `Decision logged: ${memory.id}`;
        } catch (error) {
          logger.error(
            { err: error, workspaceId: ctx.workspaceId },
            'Log decision failed',
          );
          return `Error logging decision: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
      },
      {
        name: 'log_decision',
        description: TOOL_DESCRIPTIONS.logDecision,
        schema: LogDecisionInputSchema,
      },
    );
  }

  private createGetTeamInsightsTool() {
    const teamInsightsService = this.teamInsightsService;
    const logger = this.logger;

    return tool(
      async ({ focus, limit = 200 }, config) => {
        const workspaceId = getWorkspaceId(config);

        try {
          const graph = await teamInsightsService.buildTeamGraph(
            workspaceId,
            limit,
          );

          return teamInsightsService.summarizeTeam(graph, focus);
        } catch (error) {
          logger.error({ err: error, workspaceId }, 'Get team insights failed');
          return `Error generating team insights: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
      },
      {
        name: 'get_team_insights',
        description: TOOL_DESCRIPTIONS.getTeamInsights,
        schema: GetTeamInsightsInputSchema,
      },
    );
  }

  private createGetWorkspacePromptTool() {
    const promptService = this.agentPromptService;

    return tool(
      async (_, config) => {
        const workspaceId = getWorkspaceId(config);
        const record =
          await promptService.getWorkspacePromptRecord(workspaceId);

        if (!record) {
          return 'No workspace instructions found yet.';
        }

        return `Workspace instructions (v${record.version}, updated ${record.updatedAt}):\n${record.prompt}`;
      },
      {
        name: 'get_workspace_prompt',
        description: TOOL_DESCRIPTIONS.getWorkspacePrompt,
        schema: GetWorkspacePromptInputSchema,
      },
    );
  }

  private createUpdateWorkspacePromptTool() {
    const promptService = this.agentPromptService;
    const logger = this.logger;

    return tool(
      async ({ prompt }, config) => {
        const workspaceId = getWorkspaceId(config);
        const userId = getUserId(config);

        try {
          const record = await promptService.upsertWorkspacePrompt(
            workspaceId,
            prompt,
            userId,
          );

          return `Workspace instructions updated to v${record.version}.`;
        } catch (error) {
          logger.error(
            { err: error, workspaceId },
            'Update workspace prompt failed',
          );
          return `Error updating workspace instructions: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
      },
      {
        name: 'update_workspace_prompt',
        description: TOOL_DESCRIPTIONS.updateWorkspacePrompt,
        schema: UpdateWorkspacePromptInputSchema,
      },
    );
  }

  private createAppendWorkspacePromptTool() {
    const promptService = this.agentPromptService;
    const logger = this.logger;

    return tool(
      async ({ addition }, config) => {
        const workspaceId = getWorkspaceId(config);
        const userId = getUserId(config);

        try {
          const record = await promptService.appendWorkspacePrompt(
            workspaceId,
            addition,
            userId,
          );

          return `Workspace instructions appended (v${record.version}).`;
        } catch (error) {
          logger.error(
            { err: error, workspaceId },
            'Append workspace prompt failed',
          );
          return `Error updating workspace instructions: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
      },
      {
        name: 'append_workspace_prompt',
        description: TOOL_DESCRIPTIONS.appendWorkspacePrompt,
        schema: AppendWorkspacePromptInputSchema,
      },
    );
  }

  private createGetBlockersTool() {
    const memoryService = this.memoryService;
    const logger = this.logger;

    return tool(
      async ({ limit = 10 }, config) => {
        const workspaceId = getWorkspaceId(config);

        try {
          const blockers = await memoryService.getRecentBlockers(
            workspaceId,
            limit,
          );

          if (blockers.length === 0) {
            return 'No active blockers found.';
          }

          return blockers
            .map((b, i) => {
              const status = b.archivedAt ? '✅ Resolved' : '🚫 Active';
              return `${i + 1}. ${status} ${b.summary || b.content}`;
            })
            .join('\n');
        } catch (error) {
          logger.error(
            { err: error, workspaceId, limit },
            'Get blockers failed',
          );
          return `Error getting blockers: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
      },
      {
        name: 'get_blockers',
        description: 'Get recent blockers for the workspace.',
        schema: GetBlockersInputSchema,
      },
    );
  }

  private createGetDecisionsTool() {
    const memoryService = this.memoryService;
    const logger = this.logger;

    return tool(
      async ({ limit = 10 }, config) => {
        const workspaceId = getWorkspaceId(config);

        try {
          const decisions = await memoryService.getRecentDecisions(
            workspaceId,
            limit,
          );

          if (decisions.length === 0) {
            return 'No recent decisions found.';
          }

          return decisions
            .map((d, i) => `${i + 1}. ${d.summary || d.content}`)
            .join('\n');
        } catch (error) {
          logger.error(
            { err: error, workspaceId, limit },
            'Get decisions failed',
          );
          return `Error getting decisions: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
      },
      {
        name: 'get_decisions',
        description: 'Get recent decisions made in the workspace.',
        schema: GetDecisionsInputSchema,
      },
    );
  }

  private createResolveIdentityTool() {
    const store = this.store;
    const logger = this.logger;

    return tool(
      async ({ name }, config) => {
        const workspaceId = getWorkspaceId(config);

        try {
          const results = await store.search(
            ['workspaces', workspaceId, 'identity'],
            { query: `${name} identity linked account`, limit: 5 },
          );

          if (!results || results.length === 0) {
            return `No linked identity found for "${name}".`;
          }

          for (const result of results) {
            const metadata = result.value as Record<string, unknown>;
            if (!metadata?.['accounts']) continue;

            const accounts = metadata['accounts'] as {
              github?: { login: string; name?: string };
              linear?: { name: string; displayName?: string };
              slack?: { name: string; realName: string; displayName?: string };
            };

            const searchLower = name.toLowerCase();
            const matchesGitHub =
              accounts.github &&
              (accounts.github.login.toLowerCase().includes(searchLower) ||
                accounts.github.name?.toLowerCase().includes(searchLower));
            const matchesLinear =
              accounts.linear &&
              (accounts.linear.name.toLowerCase().includes(searchLower) ||
                accounts.linear.displayName
                  ?.toLowerCase()
                  .includes(searchLower));
            const matchesSlack =
              accounts.slack &&
              (accounts.slack.name.toLowerCase().includes(searchLower) ||
                accounts.slack.realName.toLowerCase().includes(searchLower) ||
                accounts.slack.displayName
                  ?.toLowerCase()
                  .includes(searchLower));

            if (matchesGitHub || matchesLinear || matchesSlack) {
              const displayName = metadata['displayName'] as string;
              const accountList: string[] = [];
              if (accounts.github)
                accountList.push(`GitHub: @${accounts.github.login}`);
              if (accounts.linear)
                accountList.push(`Linear: ${accounts.linear.name}`);
              if (accounts.slack)
                accountList.push(`Slack: @${accounts.slack.name}`);

              return `**${displayName}**\nAccounts: ${accountList.join(', ')}\nEmail: ${metadata['email'] || 'Unknown'}`;
            }
          }

          return `No linked identity found for "${name}".`;
        } catch (error) {
          logger.error(
            { err: error, workspaceId, identity: name || null },
            'Resolve identity failed',
          );
          return `Error resolving identity: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
      },
      {
        name: 'resolve_identity',
        description: TOOL_DESCRIPTIONS.resolveIdentity,
        schema: ResolveIdentityInputSchema,
      },
    );
  }

  private createGetInboxItemsTool() {
    const store = this.store;
    const logger = this.logger;

    return tool(
      async ({ type, priority, limit = 20 }, config) => {
        const workspaceId = getWorkspaceId(config);

        try {
          const results = await store.search(
            ['workspaces', workspaceId, 'inbox'],
            { query: type || 'inbox item', limit: limit * 2 },
          );

          if (!results || results.length === 0) {
            return JSON.stringify({ items: [] });
          }

          const items = results
            .map((r: { value: Record<string, unknown> }) => r.value)
            .filter((item: Record<string, unknown>) => {
              if (type && item['type'] !== type) return false;

              return !(priority && item['priority'] !== priority);
            })
            .slice(0, limit);

          const payload = {
            items: items.map((item: Record<string, unknown>) => ({
              id: String(item['id'] || item['threadId'] || item['title'] || ''),
              type: String(item['type'] || ''),
              priority: String(item['priority'] || ''),
              title: String(item['title'] || ''),
              summary: String(item['summary'] || ''),
              createdAt: String(item['createdAt'] || item['created_at'] || ''),
            })),
          };

          return JSON.stringify(payload);
        } catch (error) {
          logger.error(
            { err: error, workspaceId, type, priority, limit },
            'Get inbox items failed',
          );
          return JSON.stringify({
            items: [],
            error: `Error fetching inbox items: ${error instanceof Error ? error.message : 'Unknown error'}`,
          });
        }
      },
      {
        name: 'get_inbox_items',
        description: TOOL_DESCRIPTIONS.getInboxItems,
        schema: GetInboxItemsInputSchema,
      },
    );
  }

  private createGetWorkspaceStatusTool() {
    const store = this.store;
    const logger = this.logger;

    return tool(
      async ({ includeMetrics = false }, config) => {
        const workspaceId = getWorkspaceId(config);

        try {
          const [blockers, inboxItems, recentDecisions] = await Promise.all([
            store.search(['workspaces', workspaceId, 'blocker'], { limit: 10 }),
            store.search(['workspaces', workspaceId, 'inbox'], { limit: 50 }),
            store.search(['workspaces', workspaceId, 'decision'], { limit: 5 }),
          ]);

          const activeBlockers = blockers?.length || 0;
          const pendingItems = inboxItems?.length || 0;
          const decisionsThisWeek = recentDecisions?.length || 0;

          let status = `**Workspace Status**\n\n`;
          status += `🚨 Active Blockers: ${activeBlockers}\n`;
          status += `📥 Pending Inbox Items: ${pendingItems}\n`;
          status += `📝 Recent Decisions: ${decisionsThisWeek}\n`;

          if (includeMetrics && inboxItems) {
            const byType: Record<string, number> = {};
            for (const item of inboxItems) {
              const type =
                ((item.value as Record<string, unknown>)['type'] as string) ||
                'other';
              byType[type] = (byType[type] || 0) + 1;
            }

            status += `\n**Inbox Breakdown:**\n`;
            for (const [type, count] of Object.entries(byType)) {
              status += `- ${type}: ${count}\n`;
            }
          }

          return status;
        } catch (error) {
          logger.error(
            { err: error, workspaceId, includeMetrics },
            'Get workspace status failed',
          );
          return `Error getting workspace status: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
      },
      {
        name: 'get_workspace_status',
        description:
          'Get an overview of workspace status including blockers, inbox items, and recent decisions.',
        schema: GetWorkspaceStatusInputSchema,
      },
    );
  }

  private createGenerateProjectUpdateTool() {
    const model = this.modelFast;
    const logger = this.logger;

    return tool(
      async ({ projectId, timeRange, format, audience }, config) => {
        const workspaceId = getWorkspaceId(config);
        const normalizedTimeRange = timeRange || 'this week';
        const normalizedFormat = format || 'slack';
        const normalizedAudience = audience || 'team';

        try {
          const response = await model.invoke([
            new SystemMessage(
              `You are Linea, generating a concise project update for a PM.
Format it for ${normalizedAudience} and output in ${normalizedFormat} style.
Use short sections with clear headings and bullets.`,
            ),
            new HumanMessage(
              `Generate a ${normalizedTimeRange} update for project ${projectId || 'the workspace'}.
Include: highlights, risks/blockers, next steps.`,
            ),
          ]);

          const updateText =
            typeof response.content === 'string'
              ? response.content
              : JSON.stringify(response.content);

          return JSON.stringify(
            {
              workspaceId,
              projectId: projectId || null,
              timeRange: normalizedTimeRange,
              format: normalizedFormat,
              audience: normalizedAudience,
              update: updateText,
              sections: updateText
                .split('\n')
                .map((line) => line.trim())
                .filter(Boolean)
                .slice(0, 6),
              stats: {
                prsOpened: 0,
                prsMerged: 0,
                ticketsClosed: 0,
                blockers: 0,
              },
              note: 'Update generated from current workspace context.',
            },
            null,
            2,
          );
        } catch (error) {
          logger.error(
            { err: error, workspaceId, projectId },
            'Failed to generate project update',
          );

          return JSON.stringify(
            {
              error:
                error instanceof Error
                  ? error.message
                  : 'Unknown error generating update',
            },
            null,
            2,
          );
        }
      },
      {
        name: 'generate_project_update',
        description: TOOL_DESCRIPTIONS.generateProjectUpdate,
        schema: GenerateProjectUpdateInputSchema,
      },
    );
  }

  private createThinkTool() {
    const logger = this.logger;

    return tool(
      async ({ thought }, config) => {
        const workspaceId = getWorkspaceId(config);
        const userId = getUserId(config);
        const timestamp = new Date().toISOString();

        logger.debug({ workspaceId, userId, timestamp }, 'Think tool invoked');
        logger.debug({ workspaceId, thought }, 'Think tool thought');

        return `Thought recorded at ${timestamp}. Continue with your analysis.`;
      },
      {
        name: 'think',
        description: `Tool for strategic reflection on research progress and decision-making.
Use this tool after each search to analyze results and plan next steps systematically.`,
        schema: ThinkInputSchema,
      },
    );
  }

  private createUpdateLinearTicketTool() {
    const logger = this.logger;

    return tool(
      async ({ ticketId, status, priority, assigneeId, comment }, config) => {
        const workspaceId = getWorkspaceId(config);
        const userId = getUserId(config);

        // Prepare the update payload
        const updates: Record<string, unknown> = {};

        if (status) updates['status'] = status;
        if (priority !== undefined) updates['priority'] = priority;
        if (assigneeId) updates['assignee'] = assigneeId;

        // TODO: implement actual Linear API call here after approval workflow

        logger.debug(
          {
            workspaceId,
            userId,
            ticketId,
            updates,
            comment: comment || null,
          },
          'Prepared Linear ticket update',
        );

        // Return a structured response for UI to render approval request
        return JSON.stringify(
          {
            pendingApproval: true,
            action: 'update_linear_ticket',
            workspaceId,
            requestedBy: userId,
            ticketId,
            updates,
            comment: comment || null,
            message: '⚠️ This action requires PM approval before execution',
            preview: this.formatLinearUpdatePreview(ticketId, updates, comment),
          },
          null,
          2,
        );
      },
      {
        name: 'update_linear_ticket',
        description: TOOL_DESCRIPTIONS.updateLinearTicket,
        schema: UpdateLinearTicketInputSchema,
      },
    );
  }

  private formatLinearUpdatePreview(
    ticketId: string,
    updates: Record<string, unknown>,
    comment?: string,
  ): string {
    const lines = [`Update ticket ${ticketId}:`];

    if (updates['status']) lines.push(`  • Status → ${updates['status']}`);
    if (updates['priority'] !== undefined) {
      const priorityNames = ['None', 'Urgent', 'High', 'Normal', 'Low'];
      lines.push(
        `  • Priority → ${priorityNames[updates['priority'] as number] || updates['priority']}`,
      );
    }
    if (updates['assignee'])
      lines.push(`  • Assignee → ${updates['assignee']}`);
    if (comment)
      lines.push(
        `  • Add comment: "${comment.slice(0, 50)}${comment.length > 50 ? '...' : ''}"`,
      );

    return lines.join('\n');
  }

  private createSendSlackMessageTool() {
    return tool(
      async ({ channel, message, threadTs }, config) => {
        const workspaceId = getWorkspaceId(config);
        const userId = getUserId(config);

        try {
          const integrations =
            await this.integrationFacade.getIntegrationsByType(
              workspaceId,
              IntegrationType.SLACK,
            );
          const integrationId = integrations[0]?.id;

          if (!integrationId) {
            return JSON.stringify(
              {
                error: 'Slack integration is not connected.',
              },
              null,
              2,
            );
          }

          const token =
            await this.integrationFacade.getAccessToken(integrationId);

          if (!token) {
            return JSON.stringify(
              {
                error: 'Slack access token is missing.',
              },
              null,
              2,
            );
          }

          await this.slackService.postMessage(
            token,
            channel,
            message,
            threadTs || undefined,
          );

          return JSON.stringify(
            {
              success: true,
              action: 'send_slack_message',
              workspaceId,
              requestedBy: userId,
              channel,
              message,
              threadTs: threadTs || null,
              preview: this.formatSlackMessagePreview(
                channel,
                message,
                threadTs,
              ),
            },
            null,
            2,
          );
        } catch (error) {
          this.logger.error(
            { err: error, workspaceId, channel },
            'Failed to send Slack message',
          );

          return JSON.stringify(
            {
              error:
                error instanceof Error ? error.message : 'Unknown Slack error',
            },
            null,
            2,
          );
        }
      },
      {
        name: 'send_slack_message',
        description: TOOL_DESCRIPTIONS.sendSlackMessage,
        schema: SendSlackMessageInputSchema,
      },
    );
  }

  private createGetLatestEmailsTool(): StructuredToolInterface {
    const logger = this.logger;

    return tool(
      async ({ query, labelIds, limit = 10, includeSpamTrash }, config) => {
        const workspaceId = getWorkspaceId(config);

        try {
          const token = await getIntegrationToken(
            this.integrationFacade,
            workspaceId,
            IntegrationType.GOOGLE,
          );

          if (!token) {
            return 'Google integration is not connected.';
          }

          const emails = await this.googleService.listGmailMessages(token, {
            query,
            labelIds,
            limit,
            includeSpamTrash,
          });

          if (!emails.length) {
            return 'No emails found for that query.';
          }

          return this.formatEmailSummary(emails);
        } catch (error) {
          logger.error(
            { err: error, workspaceId },
            'Failed to fetch Gmail messages',
          );
          return `Failed to fetch Gmail messages: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
      },
      {
        name: 'get_latest_emails',
        description: TOOL_DESCRIPTIONS.getLatestEmails,
        schema: GetLatestEmailsInputSchema,
      },
    );
  }

  private createReplyToEmailTool(): StructuredToolInterface {
    const logger = this.logger;

    return tool(
      async ({ messageId, body }, config) => {
        const workspaceId = getWorkspaceId(config);
        const userId = getUserId(config);

        try {
          const token = await getIntegrationToken(
            this.integrationFacade,
            workspaceId,
            IntegrationType.GOOGLE,
          );

          if (!token) {
            return JSON.stringify(
              { error: 'Google integration is not connected.' },
              null,
              2,
            );
          }

          const result = await this.googleService.sendGmailReply(token, {
            messageId,
            body,
          });

          return JSON.stringify(
            {
              success: true,
              action: 'reply_to_email',
              workspaceId,
              requestedBy: userId,
              messageId,
              threadId: result.threadId || null,
            },
            null,
            2,
          );
        } catch (error) {
          logger.error(
            { err: error, workspaceId, messageId },
            'Failed to reply to email',
          );
          return JSON.stringify(
            {
              error:
                error instanceof Error ? error.message : 'Unknown Gmail error',
            },
            null,
            2,
          );
        }
      },
      {
        name: 'reply_to_email',
        description: TOOL_DESCRIPTIONS.replyToEmail,
        schema: ReplyToEmailInputSchema,
      },
    );
  }

  private createGetCalendarEventsTool(): StructuredToolInterface {
    const logger = this.logger;

    return tool(
      async ({ timeMin, timeMax, calendarId, limit = 10 }, config) => {
        const workspaceId = getWorkspaceId(config);

        try {
          const token = await getIntegrationToken(
            this.integrationFacade,
            workspaceId,
            IntegrationType.GOOGLE,
          );

          if (!token) {
            return 'Google integration is not connected.';
          }

          const events = await this.googleService.listCalendarEvents(token, {
            timeMin,
            timeMax,
            calendarId,
            limit,
          });

          if (!events.length) {
            return 'No calendar events found for that time window.';
          }

          return this.formatCalendarSummary(events);
        } catch (error) {
          logger.error(
            { err: error, workspaceId },
            'Failed to fetch calendar events',
          );
          return `Failed to fetch calendar events: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
      },
      {
        name: 'get_calendar_events',
        description: TOOL_DESCRIPTIONS.getCalendarEvents,
        schema: GetCalendarEventsInputSchema,
      },
    );
  }

  private createScheduleCalendarEventTool(): StructuredToolInterface {
    const logger = this.logger;

    return tool(
      async (
        {
          summary,
          description,
          location,
          start,
          end,
          timeZone,
          attendees,
          calendarId,
        },
        config,
      ) => {
        const workspaceId = getWorkspaceId(config);
        const userId = getUserId(config);

        try {
          const token = await getIntegrationToken(
            this.integrationFacade,
            workspaceId,
            IntegrationType.GOOGLE,
          );

          if (!token) {
            return JSON.stringify(
              { error: 'Google integration is not connected.' },
              null,
              2,
            );
          }

          const event = await this.googleService.createCalendarEvent(token, {
            summary,
            description,
            location,
            start,
            end,
            timeZone,
            attendees,
            calendarId,
          });

          return JSON.stringify(
            {
              success: true,
              action: 'schedule_calendar_event',
              workspaceId,
              requestedBy: userId,
              event,
            },
            null,
            2,
          );
        } catch (error) {
          logger.error(
            { err: error, workspaceId },
            'Failed to schedule calendar event',
          );
          return JSON.stringify(
            {
              error:
                error instanceof Error
                  ? error.message
                  : 'Unknown calendar error',
            },
            null,
            2,
          );
        }
      },
      {
        name: 'schedule_calendar_event',
        description: TOOL_DESCRIPTIONS.scheduleCalendarEvent,
        schema: ScheduleCalendarEventInputSchema,
      },
    );
  }

  private formatSlackMessagePreview(
    channel: string,
    message: string,
    threadTs?: string,
  ): string {
    const lines = [
      `Send to ${channel}${threadTs ? ' (reply in thread)' : ''}:`,
      `"${message.slice(0, 100)}${message.length > 100 ? '...' : ''}"`,
    ];
    return lines.join('\n');
  }

  private formatEmailSummary(emails: GmailMessageSummary[]): string {
    const header = `## Gmail (latest ${emails.length})`;
    const lines = emails.map((email, index) => {
      const subject = email.subject || '(no subject)';
      const from = email.from || 'Unknown sender';
      const date = email.date || '';
      const snippet = email.snippet ? `\n   Snippet: ${email.snippet}` : '';
      return `${index + 1}. **${subject}**\n   From: ${from}\n   Date: ${date}\n   Message ID: ${email.id}${snippet}`;
    });
    return [header, ...lines].join('\n\n');
  }

  private formatCalendarSummary(events: CalendarEventSummary[]): string {
    const header = `## Calendar events (${events.length})`;
    const lines = events.map((event, index) => {
      const summary = event.summary || '(no title)';
      const start = event.start || '';
      const end = event.end || '';
      const attendees = event.attendees?.length
        ? `\n   Attendees: ${event.attendees.join(', ')}`
        : '';
      const location = event.location ? `\n   Location: ${event.location}` : '';
      return `${index + 1}. **${summary}**\n   ${start} to ${end}${location}${attendees}`;
    });
    return [header, ...lines].join('\n\n');
  }

  private parseRepoIdentifier(
    repo: string,
  ): { owner: string; repo: string } | null {
    const parts = repo.split('/');
    if (parts.length !== 2) {
      return null;
    }
    const owner = parts[0]?.trim();
    const name = parts[1]?.trim();
    if (!owner || !name) {
      return null;
    }
    return { owner, repo: name };
  }

  private async getSlackAccessToken(
    workspaceId: string,
  ): Promise<{ token: string; integrationId: string } | null> {
    const integrations = await this.integrationFacade.getIntegrationsByType(
      workspaceId,
      IntegrationType.SLACK,
    );
    const integrationId = integrations[0]?.id;

    if (!integrationId) {
      return null;
    }

    const token = await this.integrationFacade.getAccessToken(integrationId);

    if (!token) {
      return null;
    }

    return { token, integrationId };
  }

  private async resolveSlackChannelId(
    token: string,
    channel: string,
  ): Promise<{ id: string; name?: string } | null> {
    const trimmed = channel.replace(/^#/, '');
    const channels = await this.slackService.listChannels(token);
    const match =
      channels.find((c) => c.id === channel) ||
      channels.find((c) => c.name === trimmed);

    if (!match) {
      return null;
    }

    return { id: match.id, name: match.name };
  }

  private createSummarizeSlackChannelTool() {
    const logger = this.logger;
    const memoryService = this.memoryService;
    const model = this.modelFast;

    return tool(
      async ({ channel, limit = 50, saveMemory = true }, config) => {
        const workspaceId = getWorkspaceId(config);
        const userId = getUserId(config);
        const ctx = createContext(config);

        try {
          const tokenResult = await this.getSlackAccessToken(workspaceId);
          if (!tokenResult) {
            return 'Slack integration is not connected.';
          }

          const resolved = await this.resolveSlackChannelId(
            tokenResult.token,
            channel,
          );
          if (!resolved) {
            return `Slack channel not found: ${channel}`;
          }

          const messages = await this.slackService.fetchRecentMessages(
            tokenResult.token,
            resolved.id,
            limit,
          );

          if (messages.length === 0) {
            return `No recent messages found for ${channel}.`;
          }

          const formattedMessages = messages
            .map((msg) => `- ${msg.user}: ${msg.text}`)
            .join('\n');

          const prompt = `Summarize the following Slack messages for a PM. Include:
- Key updates
- Decisions
- Blockers
- Open questions/asks

Messages:
${formattedMessages}

Summary:`;

          const response = await model.invoke(prompt);
          const summary =
            typeof response.content === 'string'
              ? response.content.trim()
              : String(response.content).trim();

          if (saveMemory) {
            await memoryService.saveMemory(ctx, {
              namespace: 'slack_thread',
              category: 'discussion',
              content: summary,
              summary: `Slack summary: ${resolved.name || channel}`,
              importance: 0.5,
              confidence: 0.7,
              sourceEventIds: [],
              relatedEntityIds: [],
              relatedMemoryIds: [],
              entityRefs: {},
            });
          }

          return summary;
        } catch (error) {
          logger.error(
            { err: error, workspaceId, userId, channel },
            'Slack summarization failed',
          );

          return `Failed to summarize Slack channel: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
      },
      {
        name: 'summarize_slack_channel',
        description: TOOL_DESCRIPTIONS.summarizeSlackChannel,
        schema: SummarizeSlackChannelInputSchema,
      },
    );
  }

  private createScheduleStandupDigestTool() {
    const jobsService = this.lineaJobsService;
    const logger = this.logger;

    return tool(
      async (
        {
          channel,
          time = '09:00',
          timezone = 'UTC',
          days = 'weekdays',
          mode = 'suggest',
        },
        config,
      ) => {
        const workspaceId = getWorkspaceId(config);
        const userId = getUserId(config);
        const resolvedMode = mode === 'execute' ? 'execute' : 'suggest';

        const timeMatch = time.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
        if (!timeMatch) {
          return 'Invalid time format. Use HH:mm (24h).';
        }

        const hour = Number(timeMatch[1]);
        const minute = Number(timeMatch[2]);
        const dayMap: Record<string, string> = {
          weekdays: '1-5',
          daily: '*',
          mon: '1',
          tue: '2',
          wed: '3',
          thu: '4',
          fri: '5',
          sat: '6',
          sun: '0',
        };
        const dayPart = dayMap[days];

        if (!dayPart) {
          return 'Invalid days selection for standup digest.';
        }

        const cron = `${minute} ${hour} * * ${dayPart}`;
        const task = `Prepare a standup digest for ${channel}. Summarize blockers, progress, and asks from the last 24 hours. ${
          resolvedMode === 'execute'
            ? `Post the summary to ${channel} in Slack.`
            : 'Draft the summary only.'
        }`;

        try {
          const result = await jobsService.scheduleTask({
            workspaceId,
            userId,
            task,
            cron,
            timezone,
            mode: resolvedMode,
            name: `standup:${channel}:${days}:${time}`,
            deliverToInbox: true,
          });

          return `Scheduled standup digest (${result.jobId}) at ${time} ${timezone} (${days}).`;
        } catch (error) {
          logger.error(
            { err: error, workspaceId, channel },
            'Failed to schedule standup digest',
          );

          return `Failed to schedule standup digest: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
      },
      {
        name: 'schedule_standup_digest',
        description: TOOL_DESCRIPTIONS.scheduleStandupDigest,
        schema: ScheduleStandupDigestInputSchema,
      },
    );
  }

  private createCreateGitHubIssueTool() {
    return tool(
      async ({ repo, title, body, labels }, config) => {
        const workspaceId = getWorkspaceId(config);
        const userId = getUserId(config);

        // Return a structured response for UI to render approval request
        return JSON.stringify(
          {
            pendingApproval: true,
            action: 'create_github_issue',
            workspaceId,
            requestedBy: userId,
            repo,
            title,
            body: body || null,
            labels: labels || [],
            preview: this.formatGitHubIssuePreview(repo, title, body, labels),
          },
          null,
          2,
        );
      },
      {
        name: 'create_github_issue',
        description: TOOL_DESCRIPTIONS.createGitHubIssue,
        schema: CreateGitHubIssueInputSchema,
      },
    );
  }

  private createGetGitHubPullRequestsTool(): StructuredToolInterface {
    const githubService = this.githubService;
    const logger = this.logger;

    return tool(
      async ({ repo, state = 'open', limit = 10 }, config) => {
        const workspaceId = getWorkspaceId(config);
        const repoInfo = this.parseRepoIdentifier(repo);
        if (!repoInfo) {
          return 'Invalid repo format. Use owner/repo.';
        }

        const token = await getIntegrationToken(
          this.integrationFacade,
          workspaceId,
          IntegrationType.GITHUB,
        );
        if (!token) {
          return 'GitHub integration is not connected.';
        }

        try {
          const prs = await githubService.listRepoPullRequests(
            token,
            repoInfo.owner,
            repoInfo.repo,
            { state, limit },
          );

          return JSON.stringify({
            type: 'github.pr.list',
            repo,
            state,
            items: prs,
          });
        } catch (error) {
          logger.error(
            { err: error, workspaceId, repo, state, limit },
            'GitHub pull request list failed',
          );

          return JSON.stringify({
            type: 'github.pr.list',
            repo,
            state,
            items: [],
            error: this.formatGitHubError(error, repo),
          });
        }
      },
      {
        name: 'get_github_pull_requests',
        description: TOOL_DESCRIPTIONS.getGitHubPullRequests,
        schema: GetGitHubPullRequestsInputSchema,
      },
    );
  }

  private createGetGitHubPullRequestDetailsTool(): StructuredToolInterface {
    const githubService = this.githubService;
    const logger = this.logger;

    return tool(
      async ({ repo, number }, config) => {
        const workspaceId = getWorkspaceId(config);
        const repoInfo = this.parseRepoIdentifier(repo);
        if (!repoInfo) {
          return 'Invalid repo format. Use owner/repo.';
        }

        const token = await getIntegrationToken(
          this.integrationFacade,
          workspaceId,
          IntegrationType.GITHUB,
        );
        if (!token) {
          return 'GitHub integration is not connected.';
        }

        try {
          const details = await githubService.getPullRequestDetails(
            token,
            repoInfo.owner,
            repoInfo.repo,
            number,
          );
          const summary = githubService.buildPrSummary(details);

          return JSON.stringify({
            type: 'github.pr.details',
            repo,
            pr: details,
            summary: summary.summary,
            prContext: summary.prContext,
          });
        } catch (error) {
          logger.error(
            { err: error, workspaceId, repo, number },
            'GitHub pull request details failed',
          );

          return JSON.stringify({
            type: 'github.pr.details',
            repo,
            pr: null,
            summary: null,
            prContext: null,
            error: this.formatGitHubError(error, repo),
          });
        }
      },
      {
        name: 'get_github_pull_request_details',
        description: TOOL_DESCRIPTIONS.getGitHubPullRequestDetails,
        schema: GetGitHubPullRequestDetailsInputSchema,
      },
    );
  }

  private createGetGitHubIssuesTool(): StructuredToolInterface {
    const githubService = this.githubService;
    const logger = this.logger;

    return tool(
      async ({ repo, state = 'open', limit = 10 }, config) => {
        const workspaceId = getWorkspaceId(config);
        const repoInfo = this.parseRepoIdentifier(repo);
        if (!repoInfo) {
          return 'Invalid repo format. Use owner/repo.';
        }

        const token = await getIntegrationToken(
          this.integrationFacade,
          workspaceId,
          IntegrationType.GITHUB,
        );
        if (!token) {
          return 'GitHub integration is not connected.';
        }

        try {
          const issues = await githubService.listRepoIssues(
            token,
            repoInfo.owner,
            repoInfo.repo,
            { state, limit },
          );

          return JSON.stringify({
            type: 'github.issue.list',
            repo,
            state,
            items: issues,
          });
        } catch (error) {
          logger.error(
            { err: error, workspaceId, repo, state, limit },
            'GitHub issue list failed',
          );

          return JSON.stringify({
            type: 'github.issue.list',
            repo,
            state,
            items: [],
            error: this.formatGitHubError(error, repo),
          });
        }
      },
      {
        name: 'get_github_issues',
        description: TOOL_DESCRIPTIONS.getGitHubIssues,
        schema: GetGitHubIssuesInputSchema,
      },
    );
  }

  private createSearchGitHubIssuesTool(): StructuredToolInterface {
    const githubService = this.githubService;
    const logger = this.logger;

    return tool(
      async ({ query, repo, limit = 10 }, config) => {
        const workspaceId = getWorkspaceId(config);
        let searchQuery = query;
        if (repo) {
          searchQuery = `${query} repo:${repo}`;
        }

        const token = await getIntegrationToken(
          this.integrationFacade,
          workspaceId,
          IntegrationType.GITHUB,
        );
        if (!token) {
          return 'GitHub integration is not connected.';
        }

        try {
          const issues = await githubService.searchIssues(
            token,
            searchQuery,
            limit,
          );

          return JSON.stringify({
            type: 'github.issue.search',
            query: searchQuery,
            items: issues,
          });
        } catch (error) {
          logger.error(
            { err: error, workspaceId, query: searchQuery, limit },
            'GitHub issue search failed',
          );

          return JSON.stringify({
            type: 'github.issue.search',
            query: searchQuery,
            items: [],
            error: this.formatGitHubError(error, searchQuery),
          });
        }
      },
      {
        name: 'search_github_issues',
        description: TOOL_DESCRIPTIONS.searchGitHubIssues,
        schema: SearchGitHubIssuesInputSchema,
      },
    );
  }

  private createGetGitHubCommitsTool(): StructuredToolInterface {
    const githubService = this.githubService;
    const logger = this.logger;

    return tool(
      async ({ repo, branch, limit = 10 }, config) => {
        const workspaceId = getWorkspaceId(config);
        const repoInfo = this.parseRepoIdentifier(repo);
        if (!repoInfo) {
          return 'Invalid repo format. Use owner/repo.';
        }

        const token = await getIntegrationToken(
          this.integrationFacade,
          workspaceId,
          IntegrationType.GITHUB,
        );
        if (!token) {
          return 'GitHub integration is not connected.';
        }

        try {
          const commits = await githubService.listRepoCommits(
            token,
            repoInfo.owner,
            repoInfo.repo,
            { sha: branch, limit },
          );

          return JSON.stringify({
            type: 'github.commit.list',
            repo,
            branch: branch || null,
            items: commits,
          });
        } catch (error) {
          logger.error(
            { err: error, workspaceId, repo, branch, limit },
            'GitHub commit list failed',
          );

          return JSON.stringify({
            type: 'github.commit.list',
            repo,
            branch: branch || null,
            items: [],
            error: this.formatGitHubError(error, repo),
          });
        }
      },
      {
        name: 'get_github_commits',
        description: TOOL_DESCRIPTIONS.getGitHubCommits,
        schema: GetGitHubCommitsInputSchema,
      },
    );
  }

  private formatGitHubError(error: unknown, context: string): string {
    const message =
      error instanceof Error ? error.message : String(error || 'Unknown error');

    if (message.includes('404')) {
      return `GitHub repo not found or access denied (${context}). Check the repo slug and GitHub installation access.`;
    }
    if (message.includes('401')) {
      return `GitHub authentication failed (${context}). Reconnect the GitHub integration.`;
    }
    if (message.includes('403')) {
      return `GitHub access forbidden (${context}). Ensure the token has repo access.`;
    }

    return `GitHub request failed (${context}): ${message}`;
  }

  private formatGitHubIssuePreview(
    repo: string,
    title: string,
    body?: string,
    labels?: string[],
  ): string {
    const lines = [`Create issue in ${repo}:`, `Title: ${title}`];
    if (body)
      lines.push(`Body: ${body.slice(0, 50)}${body.length > 50 ? '...' : ''}`);
    if (labels && labels.length > 0) lines.push(`Labels: ${labels.join(', ')}`);
    return lines.join('\n');
  }

  private createInternetSearchTool() {
    const logger = this.logger;

    return tool(
      async ({ query, maxResults = 5 }) => {
        const tavilyApiKey = process.env['TAVILY_API_KEY'];
        if (!tavilyApiKey) {
          return 'Internet search is not configured. Please set the TAVILY_API_KEY environment variable.';
        }

        try {
          // Dynamic import to avoid issues if Tavily isn't installed

          const tavilySearch = new TavilySearch({
            maxResults,
            tavilyApiKey,
          });

          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          //@ts-expect-error
          return await tavilySearch.invoke({ query });
        } catch (error) {
          logger.error(
            { err: error, query, maxResults },
            'Internet search failed',
          );
          return `Error searching the web: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
      },
      {
        name: 'internet_search',
        description: `Search the web for information. Use this to:
- Find documentation about technologies, libraries, or frameworks
- Research best practices or patterns
- Get up-to-date information that may not be in team memories
- Verify external references or links`,
        schema: InternetSearchInputSchema,
      },
    );
  }
}
