import type { SignalContext, RelatedItems, MemoryItem } from '../types';

export {
  MEMORY_NAMESPACES_DOC,
  LINEA_SYSTEM_PROMPT,
  buildLineaSystemPrompt,
} from './agent';
export { SUBAGENT_PROMPTS } from './subagents';
export { TOOL_DESCRIPTIONS } from './tools';

export function buildClassificationPrompt(
  context: SignalContext,
  related: RelatedItems,
): string {
  return `You are a signal classifier for a PM assistant. Analyze this signal and provide structured classification.

## Signal to Analyze
- **ID**: ${context.signalId}
- **Source**: ${context.source}
- **Event Type**: ${context.eventType}
- **Timestamp**: ${context.timestamp.toISOString()}

### Entity
- **Type**: ${context.entity.type}
- **Title**: ${context.entity.title}
- **Status**: ${context.entity.status}
- **Description**: ${context.entity.description.slice(0, 500)}${context.entity.description.length > 500 ? '...' : ''}

### Team Context
- **Team**: ${context.teamContext.teamName || 'Unknown'}
- **Product Area**: ${context.teamContext.productArea || 'Unknown'}
- **Project**: ${context.teamContext.projectId || 'None'}

${context.prContext ? buildPRContextSection(context) : ''}
${context.ticketContext ? buildTicketContextSection(context) : ''}

### References Found
- **Mentioned Users**: ${context.references.mentionedUsers.join(', ') || 'None'}
- **Linked Issues**: ${context.references.linkedIssues.join(', ') || 'None'}
- **Linked PRs**: ${context.references.linkedPRs.join(', ') || 'None'}
- **Blocker Mentions**: ${context.references.blockerMentions.length > 0 ? context.references.blockerMentions.join('; ') : 'None'}
- **Decision Mentions**: ${context.references.decisionMentions.length > 0 ? context.references.decisionMentions.join('; ') : 'None'}

### Raw Text
**Title**: ${context.rawText.title}

**Body**:
${context.rawText.body.slice(0, 1000)}${context.rawText.body.length > 1000 ? '...' : ''}

${context.rawText.comments?.length ? `**Recent Comments**: ${context.rawText.comments.slice(0, 3).join('\n---\n')}` : ''}

## Related Memories

### Same Entity (${related.sameEntity.length})
${formatMemories(related.sameEntity.slice(0, 3))}

### Recent Blockers (${related.recentBlockers.length})
${formatMemories(related.recentBlockers.slice(0, 3))}

### Recent Decisions (${related.recentDecisions.length})
${formatMemories(related.recentDecisions.slice(0, 3))}

### Same Context (${related.sameContext.length})
${formatMemories(related.sameContext.slice(0, 3))}

## Instructions
1. Analyze the signal for blockers, priority drift, and significance
2. Consider the related memories for context
3. Suggest appropriate memory operations
4. Be conservative with blocker detection - only flag clear blockers
5. Consider code quality only for PR events

Provide your analysis as structured output.`;
}

function buildPRContextSection(context: SignalContext): string {
  const pr = context.prContext;

  if (!pr) {
    return '';
  }

  return `
### PR Context
- **Files Changed**: ${pr.filesChanged}
- **Additions/Deletions**: +${pr.additions} / -${pr.deletions}
- **Reviewers**: ${pr.reviewers.join(', ') || 'None assigned'}
- **Labels**: ${pr.labels.join(', ') || 'None'}
- **Status**: ${pr.isMerged ? 'Merged' : pr.isDraft ? 'Draft' : 'Open'}
- **CI Status**: ${pr.ciStatus || 'Unknown'}

### Code Patterns Detected
- Has Tests: ${pr.patterns.hasTests ? 'Yes' : 'No'}
- Touches Config: ${pr.patterns.touchesConfig ? 'Yes' : 'No'}
- Touches Infrastructure: ${pr.patterns.touchesInfra ? 'Yes' : 'No'}
- Touches API: ${pr.patterns.touchesApi ? 'Yes' : 'No'}
- Breaking Change: ${pr.patterns.hasBreakingChange ? 'Yes' : 'No'}
- Security Relevant: ${pr.patterns.hasSecurityRelevant ? 'Yes' : 'No'}
- Dependency Update: ${pr.patterns.hasDependencyUpdate ? 'Yes' : 'No'}`;
}

function buildTicketContextSection(context: SignalContext): string {
  const ticket = context.ticketContext;

  if (!ticket) {
    return '';
  }

  return `
### Ticket Context
- **Priority**: ${ticket.priority} (0=none, 1=urgent, 2=high, 3=medium, 4=low)
- **Labels**: ${ticket.labels.join(', ') || 'None'}
- **Estimate**: ${ticket.estimate || 'Not estimated'}
- **Cycle**: ${ticket.cycleId || 'No cycle'}
- **Parent**: ${ticket.parentId || 'No parent'}`;
}

function formatMemories(memories: MemoryItem[]): string {
  if (memories.length === 0) return 'None';
  return memories
    .map(
      (m) =>
        `- [${m.category}] ${m.summary} (importance: ${m.importance.toFixed(2)})`,
    )
    .join('\n');
}

export const PROJECT_UPDATE_PROMPT = `Generate a concise project update based on the provided context.

## Guidelines
1. Start with the most important items (blockers, risks)
2. Highlight completed work and progress
3. Note upcoming milestones or deadlines
4. Keep it scannable - use bullet points
5. Include specific ticket/PR references

## Format
Use this structure:
- **🚨 Blockers/Risks**: (if any)
- **✅ Completed**: Key completions this period
- **🔄 In Progress**: Active work items
- **📅 Upcoming**: Milestones or deadlines
- **💡 Notes**: Any other important context`;

export const BLOCKER_SUMMARY_PROMPT = `Summarize this blocker situation for a PM.

Include:
1. What is blocked and why
2. Who is affected
3. What needs to happen to unblock
4. Suggested next action

Keep it brief - 2-3 sentences max.`;

export const DECISION_SUMMARY_PROMPT = `Summarize this decision for documentation.

Include:
1. What was decided
2. Key rationale (1-2 points)
3. Any next steps or implications

Keep it brief but complete.`;

