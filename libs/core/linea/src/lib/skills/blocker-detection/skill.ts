export const blockerDetectionSkill = {
  name: 'blocker-detection',
  description:
    'Use this skill when investigating blockers, stalled work, or anything preventing progress.',
  content: `# Blocker Detection Skill

## Overview

This skill helps identify and resolve blockers before they derail projects.

## What Counts as a Blocker?

1. **Explicit blockers** - Issues labeled "blocked" or with blocking dependencies
2. **Stalled work** - Items with no updates for 7+ days
3. **Missing dependencies** - Waiting on external input, decisions, or other work
4. **Resource constraints** - Not enough people or time assigned

## Instructions

### 1. Detecting Blockers

Use these tools in order:

1. \`get_linear_issues(filter: "blockers")\` - Explicitly blocked items
2. \`get_linear_issues(filter: "stalled")\` - Work that stopped moving
3. \`search_memories(query: "blocked waiting dependency")\` - Historical context

### 2. Analyzing a Blocker

For each blocker, identify:
- **What's blocked**: The ticket/PR/item
- **Why it's blocked**: Dependency, decision, resource, external
- **How long**: Days blocked
- **Who can unblock**: Person or team
- **Impact**: What else is affected

### 3. Suggesting Resolution

Always provide actionable next steps:
- Who should be contacted
- What decision needs to be made
- Offer to add comments or escalate

## Blocker Types

| Type | Signs | Resolution |
|------|-------|------------|
| Dependency | "waiting on X", linked issue | Escalate to owner of X |
| Decision | "need to decide", "TBD" | Identify decision maker |
| Resource | Unassigned, overloaded owner | Reassign or add capacity |
| External | Third-party, API, approval | Escalate, find workaround |
| Technical | Bug, infrastructure issue | Get engineering help |

## Example Response

\`\`\`
3 Active Blockers:

1. **ABC-123** blocked 5 days
   - Waiting on security review
   - @security-team can unblock
   - Suggested: Ping in #security-reviews?

2. **DEF-456** stalled 8 days
   - No activity, assignee @mike
   - May be forgotten
   - Suggested: Check if still needed?

3. **GHI-789** blocked by dependency
   - Waiting on ABC-100
   - ABC-100 is 80% complete
   - Should unblock in ~2 days

**Suggested actions:**
1. Escalate security review
2. Check in with Mike
3. Monitor ABC-100 progress
\`\`\``,
};
