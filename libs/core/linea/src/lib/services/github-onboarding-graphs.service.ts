import { Inject, Injectable, Logger } from '@nestjs/common';
import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import type { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { LINEA_CHECKPOINTER, LINEA_MODEL_ANALYSIS } from '../tokens';
import { MemoryService } from './memory.service';
import { GitHubService } from '@launchline/core-integration';
import {
  LLMObservationsSchema,
  type GraphContext,
  type LLMObservation,
  type MemoryNamespace,
} from '../types';

const GitHubOnboardingStateAnnotation = Annotation.Root({
  workspaceId: Annotation<string>(),
  userId: Annotation<string>(),
  correlationId: Annotation<string>(),
  githubToken: Annotation<string>(),
  githubInstallationId: Annotation<string | null>(),
  repositories: Annotation<string[]>({
    reducer: (_, next) => next,
    default: () => [],
  }),
  repoInfos: Annotation<GitHubRepo[]>({
    reducer: (_, next) => next,
    default: () => [],
  }),
  contributors: Annotation<GitHubContributor[]>({
    reducer: (_, next) => next,
    default: () => [],
  }),
  openPRs: Annotation<GitHubPR[]>({
    reducer: (_, next) => next,
    default: () => [],
  }),
  recentPRs: Annotation<GitHubPR[]>({
    reducer: (_, next) => next,
    default: () => [],
  }),
  codingPatterns: Annotation<CodingPattern[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  teamPatterns: Annotation<GitHubTeamPattern[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  prInsights: Annotation<PRInsight[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  llmObservations: Annotation<LLMObservation[]>({
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
  phase: Annotation<OnboardingPhase>({
    reducer: (_, next) => next,
    default: () => 'fetching',
  }),
});

type GitHubOnboardingState = typeof GitHubOnboardingStateAnnotation.State;

type OnboardingPhase =
  | 'fetching'
  | 'analyzing'
  | 'llm_analysis'
  | 'detect_inbox'
  | 'creating_memories'
  | 'complete'
  | 'error';

interface GitHubRepo {
  id: number;
  name: string;
  fullName: string;
  description?: string;
  language?: string;
  defaultBranch: string;
}

interface GitHubContributor {
  id: number;
  login: string;
  name?: string;
  contributions: number;
}

interface GitHubPR {
  id: number;
  number: number;
  title: string;
  state: string;
  author: { login: string };
  createdAt: string;
  mergedAt?: string;
}

interface CodingPattern {
  type: 'language' | 'framework' | 'convention' | 'review_style';
  description: string;
  data: Record<string, unknown>;
}

interface GitHubTeamPattern {
  type: 'reviewer' | 'contributor' | 'maintainer';
  description: string;
  members: string[];
  data: Record<string, unknown>;
}

interface PRInsight {
  type: 'review_time' | 'merge_patterns' | 'conflict_areas';
  description: string;
  data: Record<string, unknown>;
}

@Injectable()
export class GitHubOnboardingGraphsService {
  private readonly logger = new Logger(GitHubOnboardingGraphsService.name);
  private graph: ReturnType<typeof this.createGitHubOnboardingGraph> | null =
    null;

  constructor(
    @Inject(LINEA_CHECKPOINTER)
    private readonly checkpointer: PostgresSaver,
    @Inject(LINEA_MODEL_ANALYSIS)
    private readonly modelAnalysis: BaseChatModel,
    private readonly memoryService: MemoryService,
    private readonly githubService: GitHubService,
  ) {}

  getGraph() {
    if (!this.graph) {
      this.graph = this.createGitHubOnboardingGraph();
    }

    return this.graph;
  }
  private createGitHubOnboardingGraph() {
    const memoryService = this.memoryService;
    const model = this.modelAnalysis;

    const fetchRepos = async (
      state: GitHubOnboardingState,
    ): Promise<Partial<GitHubOnboardingState>> => {
      try {
        const repos = await this.githubService.listRepositories(
          state.githubToken,
          { limit: 20 },
        );

        const selected = state.repositories.length
          ? repos.filter((repo) =>
              state.repositories.includes(repo.fullName),
            )
          : repos;

        return {
          repoInfos: selected.map((repo) => ({
            id: repo.id,
            name: repo.name,
            fullName: repo.fullName,
            description: repo.description,
            language: repo.language,
            defaultBranch: repo.defaultBranch,
          })),
          phase: 'fetching',
        };
      } catch (err) {
        return {
          errors: [
            `Failed to fetch repos: ${err instanceof Error ? err.message : String(err)}`,
          ],
          phase: 'error',
        };
      }
    };

    const fetchContributors = async (
      state: GitHubOnboardingState,
    ): Promise<Partial<GitHubOnboardingState>> => {
      try {
        const contributors: GitHubContributor[] = [];

        for (const repo of state.repoInfos.slice(0, 6)) {
          const [owner, repoName] = repo.fullName.split('/');
          if (!owner || !repoName) {
            continue;
          }

          const repoContributors = await this.githubService.listRepoContributors(
            state.githubToken,
            owner,
            repoName,
            10,
          );

          contributors.push(...repoContributors);
        }

        return { contributors };
      } catch (err) {
        return {
          errors: [
            `Failed to fetch contributors: ${err instanceof Error ? err.message : String(err)}`,
          ],
        };
      }
    };

    const fetchPRs = async (
      state: GitHubOnboardingState,
    ): Promise<Partial<GitHubOnboardingState>> => {
      try {
        const openPRs: GitHubPR[] = [];
        const recentPRs: GitHubPR[] = [];

        for (const repo of state.repoInfos.slice(0, 6)) {
          const [owner, repoName] = repo.fullName.split('/');
          if (!owner || !repoName) {
            continue;
          }

          const [open, recent] = await Promise.all([
            this.githubService.listRepoPullRequests(
              state.githubToken,
              owner,
              repoName,
              { state: 'open', limit: 10 },
            ),
            this.githubService.listRepoPullRequests(
              state.githubToken,
              owner,
              repoName,
              { state: 'all', limit: 10 },
            ),
          ]);

          openPRs.push(
            ...open.map((pr) => ({
              id: pr.id,
              number: pr.number,
              title: pr.title,
              state: pr.state,
              author: { login: pr.author || 'unknown' },
              createdAt: pr.createdAt || '',
              mergedAt: pr.merged ? pr.updatedAt : undefined,
            })),
          );

          recentPRs.push(
            ...recent.map((pr) => ({
              id: pr.id,
              number: pr.number,
              title: pr.title,
              state: pr.state,
              author: { login: pr.author || 'unknown' },
              createdAt: pr.createdAt || '',
              mergedAt: pr.merged ? pr.updatedAt : undefined,
            })),
          );
        }

        return { openPRs, recentPRs, phase: 'analyzing' };
      } catch (err) {
        return {
          errors: [
            `Failed to fetch PRs: ${err instanceof Error ? err.message : String(err)}`,
          ],
        };
      }
    };

    const analyze = async (
      state: GitHubOnboardingState,
    ): Promise<Partial<GitHubOnboardingState>> => {
      const codingPatterns: CodingPattern[] = [];
      const teamPatterns: GitHubTeamPattern[] = [];
      const prInsights: PRInsight[] = [];

      const languages = state.repoInfos.map((r) => r.language).filter(Boolean);

      if (languages.length > 0) {
        const langDist = languages.reduce(
          (acc, lang) => {
            if (!lang) {
              return acc;
            }

            acc[lang] = (acc[lang] || 0) + 1;

            return acc;
          },
          {} as Record<string, number>,
        );

        codingPatterns.push({
          type: 'language',
          description: 'Primary languages used',
          data: { distribution: langDist },
        });
      }

      return {
        codingPatterns,
        teamPatterns,
        prInsights,
        phase: 'llm_analysis',
      };
    };

    const llmAnalysis = async (
      state: GitHubOnboardingState,
    ): Promise<Partial<GitHubOnboardingState>> => {
      try {
        if (state.repoInfos.length === 0) {
          return { llmObservations: [], phase: 'creating_memories' };
        }

        const structuredModel = model.withStructuredOutput(
          LLMObservationsSchema,
          { name: 'analyze_github_workspace' },
        );

        const result = await structuredModel.invoke([
          new SystemMessage(
            `You are analyzing a software team's GitHub repositories. Provide structured insights about:
1. Coding patterns - languages, frameworks, conventions
2. Team dynamics - who works on what, collaboration patterns
3. Code quality risks - potential issues or concerns
4. Recommendations - actionable improvements

Return multiple observations with appropriate types and importance scores.`,
          ),
          new HumanMessage(
            `Repositories: ${state.repoInfos.map((r) => `${r.name} (${r.language || 'unknown'})`).join(', ')}
Contributors: ${state.contributors.length}
Open PRs: ${state.openPRs.length}
Recent PRs: ${state.recentPRs.length}`,
          ),
        ]);

        return {
          llmObservations: result.observations,
          phase: 'creating_memories',
        };
      } catch (err) {
        this.logger.warn({ err }, 'LLM analysis failed for GitHub onboarding');
        return {
          errors: [
            `LLM analysis failed: ${err instanceof Error ? err.message : String(err)}`,
          ],
          phase: 'error',
        };
      }
    };

    const createMemories = async (
      state: GitHubOnboardingState,
    ): Promise<Partial<GitHubOnboardingState>> => {
      const memoriesCreated: string[] = [];
      const ctx: GraphContext = {
        workspaceId: state.workspaceId,
        userId: state.userId,
        correlationId: state.correlationId,
      };

      try {
        if (state.repoInfos.length > 0) {
          const memory = await memoryService.saveMemory(ctx, {
            namespace: 'codebase' as MemoryNamespace,
            category: 'insight',
            content: JSON.stringify({
              repos: state.repoInfos,
              contributors: state.contributors,
            }),
            summary: `GitHub repositories: ${state.repoInfos.map((r) => r.name).join(', ')}`,
            importance: 0.8,
            confidence: 1,
            sourceEventIds: [],
            relatedEntityIds: [],
            relatedMemoryIds: [],
            entityRefs: {},
          });
          memoriesCreated.push(memory.id);
        }

        for (const obs of state.llmObservations) {
          const memory = await memoryService.saveMemory(ctx, {
            namespace: 'codebase' as MemoryNamespace,
            category: 'insight',
            content: obs.observation,
            summary: obs.title,
            importance: obs.importance,
            confidence: 0.8,
            sourceEventIds: [],
            relatedEntityIds: obs.relatedEntities || [],
            relatedMemoryIds: [],
            entityRefs: {},
          });
          memoriesCreated.push(memory.id);
        }

        return { memoriesCreated, phase: 'complete' };
      } catch (err) {
        return {
          errors: [
            `Failed to create memories: ${err instanceof Error ? err.message : String(err)}`,
          ],
          phase: 'error',
        };
      }
    };

    const shouldContinue = (state: GitHubOnboardingState): string => {
      if (state.phase === 'error' || state.errors.length > 5) return END;
      if (state.phase === 'complete') return END;
      return 'continue';
    };

    const workflow = new StateGraph(GitHubOnboardingStateAnnotation)
      .addNode('fetchRepos', fetchRepos)
      .addNode('fetchContributors', fetchContributors)
      .addNode('fetchPRs', fetchPRs)
      .addNode('analyze', analyze)
      .addNode('llmAnalysis', llmAnalysis)
      .addNode('createMemories', createMemories)
      .addEdge(START, 'fetchRepos')
      .addEdge('fetchRepos', 'fetchContributors')
      .addEdge('fetchContributors', 'fetchPRs')
      .addEdge('fetchPRs', 'analyze')
      .addEdge('analyze', 'llmAnalysis')
      .addConditionalEdges('llmAnalysis', shouldContinue, {
        continue: 'createMemories',
        [END]: END,
      })
      .addEdge('createMemories', END);

    return workflow.compile({ checkpointer: this.checkpointer });
  }

}
