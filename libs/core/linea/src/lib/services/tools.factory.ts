import { Inject, Injectable, Logger } from '@nestjs/common';
import { type StructuredToolInterface, tool } from '@langchain/core/tools';
import { RunnableConfig } from '@langchain/core/runnables';
import { Command } from '@langchain/langgraph';
import { ToolMessage } from '@langchain/core/messages';
import { MemoryService } from './memory.service';
import { LINEA_STORE } from '../tokens';
import { PostgresStore } from '@langchain/langgraph-checkpoint-postgres/store';
import {
  CreateGitHubIssueInputSchema,
  GetBlockersInputSchema,
  GetDecisionsInputSchema,
  GetInboxItemsInputSchema,
  GetWorkspaceStatusInputSchema,
  type GraphContext,
  InternetSearchInputSchema,
  type MemoryCategory,
  type MemoryNamespace,
  ResolveIdentityInputSchema,
  SaveMemoryInputSchema,
  SearchMemoriesInputSchema,
  SendSlackMessageInputSchema,
  ThinkInputSchema,
  UpdateLinearTicketInputSchema,
} from '../types';
import { TOOL_DESCRIPTIONS } from '../prompts';

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

function getToolCallId(config: RunnableConfig): string {
  // LangGraph passes tool call context
  const toolCall = (config as Record<string, unknown>)?.['toolCall'] as
    | { id?: string }
    | undefined;
  return toolCall?.id || `tool-${Date.now()}`;
}

function createContext(config: RunnableConfig): GraphContext {
  return {
    workspaceId: getWorkspaceId(config),
    userId: getUserId(config),
    correlationId: `tool-${Date.now()}`,
  };
}

@Injectable()
export class ToolsFactory {
  private readonly logger = new Logger(ToolsFactory.name);

  constructor(
    private readonly memoryService: MemoryService,
    @Inject(LINEA_STORE)
    private readonly store: PostgresStore,
  ) {}

  createAllTools(): StructuredToolInterface[] {
    return [
      // Memory tools
      this.createSearchMemoriesTool(),
      this.createSaveMemoryTool(),
      this.createGetBlockersTool(),
      this.createGetDecisionsTool(),
      this.createResolveIdentityTool(),
      // Inbox tools
      this.createGetInboxItemsTool(),
      this.createGetWorkspaceStatusTool(),
      // Action tools (require approval)
      this.createUpdateLinearTicketTool(),
      this.createSendSlackMessageTool(),
      this.createCreateGitHubIssueTool(),
      // Search tools
      this.createInternetSearchTool(),
      // Utility tools
      this.createThinkTool(),
    ];
  }

  private createSearchMemoriesTool() {
    const store = this.store;
    const logger = this.logger;

    return tool(
      async ({ query, namespace, limit = 10 }, config) => {
        const workspaceId = getWorkspaceId(config);
        const searchNamespace = namespace
          ? ['workspaces', workspaceId, namespace]
          : ['workspaces', workspaceId];

        try {
          const results = await store.search(searchNamespace, { query, limit });

          if (!results || results.length === 0) {
            return 'No memories found matching your query.';
          }

          return results
            .map((item: { value: Record<string, unknown> }, i: number) => {
              const memory = item.value;
              const ns = memory['namespace'] || 'unknown';
              const cat = memory['category'] || 'general';
              const summary =
                memory['summary'] || memory['content'] || 'No content';
              const importance =
                typeof memory['importance'] === 'number'
                  ? (memory['importance'] as number).toFixed(2)
                  : 'N/A';
              return `${i + 1}. [${ns}/${cat}] ${summary}\n   Importance: ${importance}`;
            })
            .join('\n\n');
        } catch (error) {
          logger.error('[searchMemories] Error:', error);

          return `Error searching memories: ${error instanceof Error ? error.message : 'Unknown error'}`;
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
          logger.error('[saveMemory] Error:', error);
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
          logger.error('[getBlockers] Error:', error);
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
          logger.error('[getDecisions] Error:', error);
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
          logger.error('[resolveIdentity] Error:', error);
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
            return 'No inbox items found.';
          }

          const items = results
            .map((r: { value: Record<string, unknown> }) => r.value)
            .filter((item: Record<string, unknown>) => {
              if (type && item['type'] !== type) return false;

              return !(priority && item['priority'] !== priority);
            })
            .slice(0, limit);

          if (items.length === 0) {
            return 'No inbox items match your criteria.';
          }

          return items
            .map((item: Record<string, unknown>, i: number) => {
              const p = String(item['priority'] || '').toUpperCase();
              const t = String(item['type'] || '');
              const title = String(item['title'] || '');
              const summary = String(item['summary'] || '');
              return `${i + 1}. [${p}] ${t}: ${title}\n   ${summary}`;
            })
            .join('\n\n');
        } catch (error) {
          logger.error('[getInboxItems] Error:', error);
          return `Error fetching inbox items: ${error instanceof Error ? error.message : 'Unknown error'}`;
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
          logger.error('[getWorkspaceStatus] Error:', error);
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

  private createThinkTool() {
    const logger = this.logger;

    return tool(
      async ({ thought }, config) => {
        const workspaceId = getWorkspaceId(config);
        const userId = getUserId(config);
        const timestamp = new Date().toISOString();

        logger.debug(
          `[think] Workspace: ${workspaceId}, User: ${userId}, Time: ${timestamp}`,
        );
        logger.debug(`[think] Thought: ${thought}`);

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
          `[updateLinearTicket] Workspace: ${workspaceId}, User: ${userId}, Ticket: ${ticketId}, Updates: ${JSON.stringify(
            updates,
          )}, Comment: ${comment || 'N/A'}`,
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

        // Return a structured response for UI to render approval request
        return JSON.stringify(
          {
            pendingApproval: true,
            action: 'send_slack_message',
            workspaceId,
            requestedBy: userId,
            channel,
            message,
            threadTs: threadTs || null,
            preview: this.formatSlackMessagePreview(channel, message, threadTs),
          },
          null,
          2,
        );
      },
      {
        name: 'send_slack_message',
        description: TOOL_DESCRIPTIONS.sendSlackMessage,
        schema: SendSlackMessageInputSchema,
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
          const { TavilySearch } = await import('@langchain/tavily');

          const tavilySearch = new TavilySearch({
            maxResults,
            tavilyApiKey,
          });

          return await tavilySearch._call({ query });
        } catch (error) {
          logger.error('[internetSearch] Error:', error);
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
