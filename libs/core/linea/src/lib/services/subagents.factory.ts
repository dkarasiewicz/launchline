/**
 * Subagents Factory
 *
 * Creates subagents with access to injected models and tools.
 * Subagents are specialized agents for specific tasks.
 */

import { Inject, Injectable } from '@nestjs/common';
import { createDeepAgent, type CompiledSubAgent } from 'deepagents';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import {
  LINEA_MODEL_FAST,
  LINEA_MODEL_ANALYSIS,
  LINEA_MODEL_REASONING,
  LINEA_TOOLS,
} from '../tokens';
import type { StructuredToolInterface } from '@langchain/core/tools';
import { Runnable } from '@langchain/core/runnables';

const SUMMARIZER_PROMPT = `You are a summarization expert. Your job is to:
1. Extract key points from long content
2. Identify blockers, decisions, and action items
3. Create concise summaries (max 3 sentences)
4. Preserve important context and links

Format:
**Summary**: [1-2 sentences]
**Key Points**: [bullet list]
**Actions Needed**: [if any]`;

const RESEARCHER_PROMPT = `You are a research specialist for a PM assistant. Your job is to:
1. Search through team memories thoroughly
2. Find relevant historical context
3. Connect related information across different namespaces
4. Search the web for external documentation or best practices when needed
5. Compile comprehensive research reports

When given a research task:
1. Start by searching team memories broadly, then narrow down
2. Look for decisions, blockers, and patterns related to the topic
3. Cross-reference between team, project, and code memories
4. Use internet search when you need external context (documentation, best practices, etc.)
5. Synthesize findings into a clear report

Format your response as:
**Research Summary**: [1-2 sentence overview]
**Key Findings**: [numbered list of important discoveries]
**External Resources**: [relevant links/documentation found, if any]
**Related Context**: [connections to other topics]
**Confidence**: [high/medium/low based on memory coverage]`;

const ANALYST_PROMPT = `You are an analytical expert for a PM assistant. Your job is to:
1. Analyze complex situations with multiple factors
2. Identify risks, dependencies, and trade-offs
3. Provide structured recommendations
4. Consider both short-term and long-term implications

When analyzing a situation:
1. Break down the problem into components
2. Consider different perspectives (engineering, product, business)
3. Identify potential risks and mitigations
4. Provide actionable recommendations with rationale

Format your response as:
**Analysis Summary**: [1-2 sentence assessment]
**Key Factors**: [the main elements affecting this situation]
**Risks & Concerns**: [potential issues to watch]
**Recommendations**: [prioritized list of suggested actions]
**Trade-offs**: [what you gain/lose with each option]`;

const REPORTER_PROMPT = `You are a reporting specialist for a PM assistant. Your job is to:
1. Generate clear, well-structured reports
2. Tailor content for the intended audience
3. Highlight what's most important
4. Include relevant metrics and references

Report types you can create:
- **Team updates**: Technical details, specific PRs and tickets
- **Stakeholder updates**: Business impact, milestone progress
- **Executive summaries**: High-level status, risks, timeline
- **Standup notes**: Blockers, today's priorities, yesterday's wins

Always:
- Start with the most important information
- Use bullet points for scannability
- Include specific references (ticket IDs, PR numbers)
- End with clear next steps or asks`;

@Injectable()
export class SubagentsFactory {
  constructor(
    @Inject(LINEA_MODEL_FAST)
    private readonly modelFast: BaseChatModel,
    @Inject(LINEA_MODEL_ANALYSIS)
    private readonly modelAnalysis: BaseChatModel,
    @Inject(LINEA_MODEL_REASONING)
    private readonly modelReasoning: BaseChatModel,
    @Inject(LINEA_TOOLS)
    private readonly tools: StructuredToolInterface[],
  ) {}

  createAllSubagents(): CompiledSubAgent[] {
    return [
      this.createSummarizerSubagent(),
      this.createResearcherSubagent(),
      this.createAnalystSubagent(),
      this.createReporterSubagent(),
    ];
  }

  private createSummarizerSubagent(): CompiledSubAgent {
    const agent = createDeepAgent({
      model: this.modelFast,
      systemPrompt: SUMMARIZER_PROMPT,
    });

    return {
      name: 'summarizer',
      description:
        'Summarizes long content, threads, and discussions into concise points. Use when you need to condense large amounts of text.',
      runnable: agent as unknown as Runnable,
    };
  }

  private createResearcherSubagent(): CompiledSubAgent {
    const researcherTools = this.tools.filter((t) =>
      [
        'search_memories',
        'get_blockers',
        'get_decisions',
        'internet_search',
      ].includes(t.name),
    );

    const agent = createDeepAgent({
      model: this.modelAnalysis,
      tools: researcherTools,
      systemPrompt: RESEARCHER_PROMPT,
    });

    return {
      name: 'researcher',
      description:
        'Deep research across team memories and external sources. Use when you need thorough investigation of historical context, decisions, or patterns.',
      runnable: agent as unknown as Runnable,
    };
  }

  private createAnalystSubagent(): CompiledSubAgent {
    const agent = createDeepAgent({
      model: this.modelReasoning,
      systemPrompt: ANALYST_PROMPT,
    });

    return {
      name: 'analyst',
      description:
        'Performs complex multi-factor analysis of situations, decisions, or risks. Uses advanced reasoning for nuanced assessments. Use for important decisions or complex trade-offs.',
      runnable: agent as unknown as Runnable,
    };
  }

  private createReporterSubagent(): CompiledSubAgent {
    const reporterTools = this.tools.filter((t) =>
      ['search_memories', 'get_blockers', 'get_inbox_items'].includes(t.name),
    );

    const agent = createDeepAgent({
      model: this.modelAnalysis,
      tools: reporterTools,
      systemPrompt: REPORTER_PROMPT,
    });

    return {
      name: 'reporter',
      description:
        'Generates polished reports and updates for different audiences. Use when creating project updates, stakeholder communications, or standup notes.',
      runnable: agent as unknown as Runnable,
    };
  }
}
