import { Inject, Injectable } from '@nestjs/common';
import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import type { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { LINEA_CHECKPOINTER } from '../tokens';
import { MemoryService } from './memory.service';
import {
  type GraphContext,
  type LinkedIdentity,
  type MemoryNamespace,
} from '../types';

const IdentityLinkingStateAnnotation = Annotation.Root({
  workspaceId: Annotation<string>(),
  userId: Annotation<string>(),
  correlationId: Annotation<string>(),
  githubAccounts: Annotation<GitHubAccount[]>({
    reducer: (_, next) => next,
    default: () => [],
  }),
  linearAccounts: Annotation<LinearAccount[]>({
    reducer: (_, next) => next,
    default: () => [],
  }),
  slackAccounts: Annotation<SlackAccount[]>({
    reducer: (_, next) => next,
    default: () => [],
  }),
  linkedIdentities: Annotation<LinkedIdentity[]>({
    reducer: (_, next) => next,
    default: () => [],
  }),
  unmatchedAccounts: Annotation<UnmatchedAccount[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  memoriesCreated: Annotation<string[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  errors: Annotation<string[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  phase: Annotation<LinkingPhase>({
    reducer: (_, next) => next,
    default: () => 'collecting',
  }),
});

type IdentityLinkingState = typeof IdentityLinkingStateAnnotation.State;

type LinkingPhase =
  | 'collecting'
  | 'email_matching'
  | 'name_matching'
  | 'llm_inference'
  | 'saving'
  | 'complete'
  | 'error';

export interface GitHubAccount {
  id: number;
  login: string;
  name?: string;
  email?: string;
}

export interface LinearAccount {
  id: string;
  name: string;
  email?: string;
}

export interface SlackAccount {
  id: string;
  name: string;
  realName: string;
  email?: string;
}

export interface UnmatchedAccount {
  platform: 'github' | 'linear' | 'slack';
  account: GitHubAccount | LinearAccount | SlackAccount;
  reason: string;
}

@Injectable()
export class IdentityLinkingGraphsService {
  private graph: ReturnType<typeof this.createIdentityLinkingGraph> | null =
    null;

  constructor(
    @Inject(LINEA_CHECKPOINTER)
    private readonly checkpointer: PostgresSaver,
    private readonly memoryService: MemoryService,
  ) {}

  getGraph() {
    if (!this.graph) {
      this.graph = this.createIdentityLinkingGraph();
    }

    return this.graph;
  }
  private createIdentityLinkingGraph() {
    const memoryService = this.memoryService;

    const matchByEmail = async (
      state: IdentityLinkingState,
    ): Promise<Partial<IdentityLinkingState>> => {
      const linkedIdentities: LinkedIdentity[] = [];
      const usedGitHub = new Set<number>();
      const usedLinear = new Set<string>();
      const usedSlack = new Set<string>();

      for (const gh of state.githubAccounts) {
        const email = gh.email;

        if (!email || usedGitHub.has(gh.id)) {
          continue;
        }

        const linearMatch = state.linearAccounts.find(
          (l) =>
            l.email &&
            l.email.toLowerCase() === email.toLowerCase() &&
            !usedLinear.has(l.id),
        );
        const slackMatch = state.slackAccounts.find(
          (s) =>
            s.email &&
            s.email.toLowerCase() === email.toLowerCase() &&
            !usedSlack.has(s.id),
        );

        if (linearMatch || slackMatch) {
          linkedIdentities.push({
            id: `identity-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            workspaceId: state.workspaceId,
            displayName: gh.name || gh.login,
            email,
            accounts: {
              github: { id: gh.id, login: gh.login, name: gh.name },
              linear: linearMatch
                ? { id: linearMatch.id, name: linearMatch.name }
                : undefined,
              slack: slackMatch
                ? {
                    id: slackMatch.id,
                    name: slackMatch.name,
                    realName: slackMatch.realName,
                  }
                : undefined,
            },
            linkingMethod: 'email',
            confidence: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          usedGitHub.add(gh.id);
          if (linearMatch) usedLinear.add(linearMatch.id);
          if (slackMatch) usedSlack.add(slackMatch.id);
        }
      }

      return { linkedIdentities, phase: 'name_matching' };
    };

    const matchByName = async (
      state: IdentityLinkingState,
    ): Promise<Partial<IdentityLinkingState>> => {
      const linkedIdentities = [...state.linkedIdentities];
      const usedGitHub = new Set(
        linkedIdentities
          .map((l) => l.accounts.github?.id)
          .filter(Boolean) as number[],
      );
      const usedLinear = new Set(
        linkedIdentities
          .map((l) => l.accounts.linear?.id)
          .filter(Boolean) as string[],
      );
      const usedSlack = new Set(
        linkedIdentities
          .map((l) => l.accounts.slack?.id)
          .filter(Boolean) as string[],
      );

      for (const gh of state.githubAccounts) {
        const name = gh.name;

        if (usedGitHub.has(gh.id) || !name) continue;

        const linearMatch = state.linearAccounts.find(
          (l) =>
            !usedLinear.has(l.id) && this.nameSimilarity(name, l.name) > 0.7,
        );
        const slackMatch = state.slackAccounts.find(
          (s) =>
            !usedSlack.has(s.id) && this.nameSimilarity(name, s.realName) > 0.7,
        );

        if (linearMatch || slackMatch) {
          linkedIdentities.push({
            id: `identity-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            workspaceId: state.workspaceId,
            displayName: name || gh.login,
            email: gh.email,
            accounts: {
              github: { id: gh.id, login: gh.login, name: gh.name },
              linear: linearMatch
                ? { id: linearMatch.id, name: linearMatch.name }
                : undefined,
              slack: slackMatch
                ? {
                    id: slackMatch.id,
                    name: slackMatch.name,
                    realName: slackMatch.realName,
                  }
                : undefined,
            },
            linkingMethod: 'name_match',
            confidence: 0.8,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          usedGitHub.add(gh.id);
          if (linearMatch) usedLinear.add(linearMatch.id);
          if (slackMatch) usedSlack.add(slackMatch.id);
        }
      }

      return { linkedIdentities, phase: 'saving' };
    };

    const saveIdentities = async (
      state: IdentityLinkingState,
    ): Promise<Partial<IdentityLinkingState>> => {
      const memoriesCreated: string[] = [];
      const unmatchedAccounts: UnmatchedAccount[] = [];
      const ctx: GraphContext = {
        workspaceId: state.workspaceId,
        userId: state.userId,
        correlationId: state.correlationId,
      };

      try {
        for (const identity of state.linkedIdentities) {
          const memory = await memoryService.saveMemory(ctx, {
            namespace: 'team' as MemoryNamespace,
            category: 'insight',
            content: JSON.stringify(identity),
            summary: `Identity: ${identity.displayName}`,
            importance: 0.9,
            confidence: identity.confidence,
            sourceEventIds: [],
            relatedEntityIds: [identity.id],
            relatedMemoryIds: [],
            entityRefs: {
              userIds: [identity.id],
            },
          });
          memoriesCreated.push(memory.id);
        }

        const usedGitHub = new Set(
          state.linkedIdentities
            .map((l) => l.accounts.github?.id)
            .filter(Boolean),
        );
        const usedLinear = new Set(
          state.linkedIdentities
            .map((l) => l.accounts.linear?.id)
            .filter(Boolean),
        );
        const usedSlack = new Set(
          state.linkedIdentities
            .map((l) => l.accounts.slack?.id)
            .filter(Boolean),
        );

        for (const gh of state.githubAccounts) {
          if (!usedGitHub.has(gh.id)) {
            unmatchedAccounts.push({
              platform: 'github',
              account: gh,
              reason: 'No matching accounts found',
            });
          }
        }

        for (const l of state.linearAccounts) {
          if (!usedLinear.has(l.id)) {
            unmatchedAccounts.push({
              platform: 'linear',
              account: l,
              reason: 'No matching accounts found',
            });
          }
        }

        for (const s of state.slackAccounts) {
          if (!usedSlack.has(s.id)) {
            unmatchedAccounts.push({
              platform: 'slack',
              account: s,
              reason: 'No matching accounts found',
            });
          }
        }

        return { memoriesCreated, unmatchedAccounts, phase: 'complete' };
      } catch (err) {
        return {
          errors: [
            `Failed to save identities: ${err instanceof Error ? err.message : String(err)}`,
          ],
          phase: 'error',
        };
      }
    };

    const shouldContinue = (state: IdentityLinkingState): string => {
      if (state.phase === 'error' || state.errors.length > 5) return END;
      if (state.phase === 'complete') return END;
      return 'continue';
    };

    const workflow = new StateGraph(IdentityLinkingStateAnnotation)
      .addNode('matchByEmail', matchByEmail)
      .addNode('matchByName', matchByName)
      .addNode('saveIdentities', saveIdentities)
      .addEdge(START, 'matchByEmail')
      .addEdge('matchByEmail', 'matchByName')
      .addConditionalEdges('matchByName', shouldContinue, {
        continue: 'saveIdentities',
        [END]: END,
      })
      .addEdge('saveIdentities', END);

    return workflow.compile({ checkpointer: this.checkpointer });
  }

  private normalizeName(name: string | undefined): string {
    if (!name) return '';
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .trim();
  }

  private nameSimilarity(a: string, b: string): number {
    const normA = this.normalizeName(a);
    const normB = this.normalizeName(b);

    if (normA === normB) return 1;
    if (!normA || !normB) return 0;

    if (normA.includes(normB) || normB.includes(normA)) {
      return 0.8;
    }

    const partsA = a.toLowerCase().split(/\s+/);
    const partsB = b.toLowerCase().split(/\s+/);

    for (const partA of partsA) {
      for (const partB of partsB) {
        if (partA.length > 2 && partB.length > 2 && partA === partB) {
          return 0.7;
        }
      }
    }

    return 0;
  }
}
