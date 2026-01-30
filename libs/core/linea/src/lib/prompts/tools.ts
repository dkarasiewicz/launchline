export const TOOL_DESCRIPTIONS = {
  searchMemories: `Search the workspace's memory store for relevant context.

## When to Use This Tool
Use this tool BEFORE answering questions about:
- Past decisions and their rationale
- Why something was done a certain way
- Team patterns, preferences, or conventions
- Historical context about projects, features, or work items
- Relationships between team members, projects, or tickets

## When NOT to Use This Tool
Skip this tool when:
- The question is about current/live data (use get_inbox_items instead)
- You need to take an action (use action tools instead)
- The answer is in the current conversation context

## How to Use Effectively
1. Use specific keywords from the user's question
2. Filter by namespace when you know the category (e.g., "decision", "blocker", "team")
3. Start with broader searches, then narrow down if needed
4. Cross-reference multiple memories for complete context

## Examples

<example>
User: "Why are we using Redis for caching?"
Search: query="Redis caching decision" namespace="decision"
</example>

<example>
User: "Who usually handles authentication issues?"
Search: query="authentication owner assignee" namespace="team"
</example>

<example>
User: "What was the outcome of the performance review last month?"
Search: query="performance review" namespace="retrospective"
</example>`,

  getInboxItems: `Get current inbox items that need PM attention.

## What This Returns
- **Blockers**: Work that's stuck and needs intervention
- **Priority Drift**: Items whose priority has shifted without explicit decision
- **Stalled PRs**: Pull requests with no activity
- **Update Needed**: Work items requiring status updates
- **Action Required**: Items explicitly flagged for PM attention

## When to Use This Tool
Use this to understand:
- What needs attention RIGHT NOW
- Current state of active blockers
- Which team members might need help
- What's falling through the cracks

## Filtering Options
- Filter by type to focus on specific issues
- Filter by priority to see critical items first
- Limit results for quick overviews

## Examples

<example>
User: "What's blocking the team today?"
Call: type="blocker", priority="critical"
</example>

<example>
User: "Any PRs stuck in review?"
Call: type="stalled_pr"
</example>`,

  updateLinearTicket: `Update a Linear ticket's properties.

## ⚠️ IMPORTANT: Requires PM Approval
NEVER execute this tool without explicit confirmation from the PM.
Always explain:
1. What will change
2. Who will be notified
3. Any downstream effects

## What Can Be Updated
- Status (Todo, In Progress, Done, Cancelled, etc.)
- Priority (0=none, 1=urgent, 2=high, 3=medium, 4=low)
- Assignee
- Add comments

## Confirmation Pattern
Before calling this tool, present the change like this:

"I'll update TEAM-123:
- Change status: In Progress → In Review
- This will notify @reviewer in Slack

Should I proceed? (yes/no)"

## Examples

<example>
User: "Mark TEAM-456 as done"

Response: "I'll update TEAM-456:
- Status: In Progress → Done
- This will close the ticket and notify the team

Confirm? (yes/no)"
</example>`,

  sendSlackMessage: `Send a message to a Slack channel or thread.

## ⚠️ IMPORTANT: Requires PM Approval
NEVER send a message without explicit confirmation.
Always show the PM:
1. Exact message content
2. Target channel/thread
3. Who will be notified

## Confirmation Pattern
Before calling this tool, show:

"I'll send to #engineering:

\`\`\`
Hey team, quick update on the auth feature:
- PR #234 is ready for review
- Targeting release by EOD Friday
\`\`\`

Send this message? (yes/no)"

## Best Practices
- Keep messages concise
- Use appropriate channels
- Thread replies when continuing discussions
- Tag people only when necessary`,

  generateProjectUpdate: `Generate a comprehensive project update.

## What This Does
Compiles recent activity from GitHub, Linear, and Slack into a structured update.

## Update Formats
- **slack**: Formatted for Slack posting with emojis and bullet points
- **email**: More formal, suitable for stakeholders
- **standup**: Brief, focused on blockers and today's priorities

## Audience Considerations
- **team**: Technical details, specific PRs and tickets
- **stakeholders**: Business impact, milestone progress
- **executives**: High-level status, risks, timeline

## Examples

<example>
User: "Generate a weekly update for the team"
Call: timeRange="this_week", format="slack", audience="team"
</example>

<example>
User: "Prepare an executive summary"
Call: timeRange="this_month", format="email", audience="executives"
</example>`,

  resolveIdentity: `Resolve a team member's identity across platforms.

## What This Does
Finds a team member's linked accounts across GitHub, Linear, and Slack.
Team members often have different usernames on different platforms - this tool
helps you understand who is who.

## When to Use This Tool
Use this when:
- You see a username and need to find their other accounts
- The user asks "who is @username?"
- You need to mention someone on a different platform
- You want to get a complete picture of someone's activity

## Examples

<example>
User: "Who is sarahdev on GitHub?"
Call: resolve_identity({ name: "sarahdev", platform: "github" })

Response: "Sarah is known as:
- GitHub: @sarahdev
- Slack: @sarah.k
- Linear: Sarah Chen"
</example>

<example>
User: "What has Mike been working on?"
First: resolve_identity({ name: "mike" }) to find their accounts
Then: search_memories to find their recent activity across platforms
</example>`,

  createGitHubIssue: `Create a new issue on GitHub.

## ⚠️ IMPORTANT: Requires PM Approval
NEVER create an issue without explicit confirmation.
Always show the PM:
1. Repository where it will be created
2. Issue title and description
3. Labels and assignees

## Confirmation Pattern
Before calling this tool, show:

"I'll create an issue in owner/repo:

**Title**: Fix authentication timeout issue

**Description**:
Users are experiencing timeout errors when logging in...

**Labels**: bug, priority-high
**Assignees**: @sarahdev

Create this issue? (yes/no)"

## Best Practices
- Write clear, descriptive titles
- Include reproduction steps for bugs
- Add relevant labels
- Assign to the right team member`,
} as const;

export const ERROR_MESSAGES = {
  noWorkspace: "No workspace context found. Please ensure you're logged in.",
  noPermission: "You don't have permission to perform this action.",
  notFound: (entity: string) => `${entity} not found.`,
  actionFailed: (action: string) => `Failed to ${action}. Please try again.`,
  needsConfirmation:
    'This action requires confirmation. Please confirm to proceed.',
} as const;
