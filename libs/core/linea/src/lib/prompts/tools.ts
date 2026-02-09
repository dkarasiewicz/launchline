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

  getLatestEmails: `Fetch the latest emails from Gmail.

## What This Returns
- Sender, subject, date, snippet
- Message IDs for follow-up replies

## When to Use This Tool
Use this to:
- Check for new stakeholder requests
- Find urgent customer emails
- Summarize recent inbox activity

## Examples

<example>
User: "Any new emails from the CEO?"
Call: query="from:ceo@company.com" limit=5
</example>`,

  replyToEmail: `Reply to the sender of an email in Gmail.

## ⚠️ IMPORTANT: Requires PM Approval
NEVER send an email without explicit confirmation.
Always show the PM:
1. Exact email body
2. Recipient(s)
3. Subject line

## Confirmation Pattern
Before calling this tool, show:

"I'll reply with:

\`\`\`
- Subject: Re: <subject>
- To: <recipient>
- Body:
  <message>
\`\`\`

Send this email? (yes/no)"`,

  getCalendarEvents: `Fetch upcoming Google Calendar events.

## What This Returns
- Event summary, time, attendees, location
- Helps you prep for meetings and spot conflicts

## Examples

<example>
User: "What's on my calendar this week?"
Call: timeMin="<start ISO>" timeMax="<end ISO>"
</example>`,

  scheduleCalendarEvent: `Schedule a Google Calendar event.

## ⚠️ IMPORTANT: Requires PM Approval
NEVER create a calendar event without explicit confirmation.
Always show the PM:
1. Title, time, attendees
2. Calendar target

## Confirmation Pattern
Before calling this tool, show:

"I'll schedule:
- Title: <title>
- When: <start> to <end> (<timezone>)
- Attendees: <list>

Create this event? (yes/no)"`,

  getGitHubPullRequests: `Fetch pull requests from GitHub.

## What This Returns
- PR title, status, author, and updated timestamps

## Examples

<example>
User: "Show open PRs for launchline/api"
Call: repo="launchline/api" state="open" limit=10
</example>`,

  getGitHubPullRequestDetails: `Fetch detailed information about a GitHub pull request.

## What This Returns
- Description, files changed, additions/deletions, patch excerpts
- Commit list and reviewers

Use this to understand code context, not just the title.`,

  getGitHubIssues: `Fetch issues from GitHub.

## Examples

<example>
User: "List open issues in launchline/web"
Call: repo="launchline/web" state="open" limit=10
</example>`,

  searchGitHubIssues: `Search GitHub issues (optionally scoped to a repo).

## Examples

<example>
User: "Find auth issues in launchline/core"
Call: query="auth bug" repo="launchline/core"
</example>`,

  getGitHubCommits: `Fetch recent commits from a GitHub repository.

## Examples

<example>
User: "What landed on main today in launchline/api?"
Call: repo="launchline/api" branch="main" limit=10
</example>`,

  runSandboxCommand: `Run a command inside a sandboxed container.

## What This Does
- Spins up an isolated container (default: Playwright image)
- Mounts workspace skills into /workspace/skills
- Returns stdout/stderr output and exit code

## When to Use This Tool
Use this when you need to:
- Inspect a webpage or run lightweight scripts safely
- Execute a repeatable workflow defined in a skill file
- Prototype or validate data without touching production systems

## Safety Rules
- Never run destructive commands without explicit PM approval
- Prefer read-only operations and short-running tasks
- Keep outputs concise; summarize results after running

## Examples

<example>
User: "Pull the main headline from example.com"
Call: command="python - <<'PY'\nimport requests, bs4\nhtml=requests.get('https://example.com').text\nsoup=bs4.BeautifulSoup(html,'html.parser')\nprint(soup.h1.text)\nPY"
</example>`,

  runSandboxWorkflow: `Run a multi-step workflow inside a single sandbox session.

## What This Does
- Spins up one container and runs steps sequentially via exec
- Keeps /workspace state between steps (and optionally between runs)
- Returns per-step output plus a final summary
- Default image includes common tooling; pass \`image\` to swap in a different toolchain
- Supports interactive loops by keeping the session alive (\`keepAlive: true\`) and reusing it via \`sessionId\`

## When to Use This Tool
Use this when you need to:
- Execute a sequence of commands that depend on shared state
- Install dependencies and then run scripts/tests in the same sandbox
- Automate a repeatable workflow and capture it as a skill
- Iterate in a loop by reusing the same sandbox session

## Skill Reuse Rules
- If you are running steps from an existing skill, pass \`sourceSkill\` and do **not** save a new skill.
- Only set \`saveSkill: true\` when explicitly asked to update or extend that skill.

## Guardrails
- Create a short plan first (list steps) before calling this tool
- Keep steps minimal and deterministic
- Avoid account creation or sensitive actions without explicit approval
- Close long-running sessions when finished (\`closeSession: true\`)

## Examples

<example>
User: "Check a page, then take a screenshot"
Call: goal="Capture homepage screenshot" steps=[{name="Install deps", command="pnpm add playwright"}, {name="Run script", command="node scripts/snap.js"}]
</example>

<example>
User: "Keep the sandbox open so we can run follow-up commands"
Call: goal="Start sandbox session" steps=[{name="Warmup", command="node -v"}] keepAlive=true
</example>

<example>
User: "Run another command in the same sandbox"
Call: goal="Continue sandbox session" steps=[{name="List files", command="ls -la"}] sessionId="..."
</example>`,

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

  scheduleTask: `Schedule a task for Linea to run later (one-time or recurring).

## What This Does
Queues a background job that will run with workspace context at the specified time.
Use this for recurring check-ins, reminders, or scheduled updates.
Optionally reply back into the current thread by setting replyToThreadId.

## When to Use
- "Every weekday at 9am, prepare a product update"
- "Tomorrow at 2pm, check blockers and summarize"
- "Every Friday, draft a weekly status"

## Guardrails
- Default mode is "suggest" (draft only, no actions).
- Use mode="execute" only for pre-approved automation.

## Examples

<example>
User: "Every Monday at 9am, draft a status update for #product"
Call: cron="0 9 * * 1", timezone="America/New_York", mode="suggest"
</example>

<example>
User: "Tomorrow at 10am, post a reminder in #eng"
Call: runAt="2026-02-02T10:00:00-05:00", mode="execute"
</example>`,

  logDecision: `Log a product decision into workspace memory.

## What This Does
Stores a durable decision record (what, why, impact) so Linea can reference it later.

## When to Use
- Decisions made in Slack threads
- Tradeoffs or scope changes
- Rationale for prioritization

## Examples

<example>
User: "Decided to ship onboarding without the survey to hit the deadline"
Call: title="Onboarding scope decision", decision="Ship without survey", rationale="Deadline risk"
</example>`,

  getTeamInsights: `Summarize team collaboration signals, strengths, and gaps.

## What This Does
Builds a collaboration snapshot from memories across Slack, Linear, and GitHub.
Use it to understand who is overloaded, who is a connector, and where bottlenecks are forming.

## When to Use
- "What are the team’s strengths and gaps?"
- "Who is a collaboration hub right now?"
- "Do we have any silos?"
- "How is Sarah contributing lately?"

## Examples

<example>
User: "Give me a team snapshot"
Call: get_team_insights()
</example>

<example>
User: "How is Alex contributing lately?"
Call: get_team_insights(focus="Alex")
</example>`,

  summarizeSlackChannel: `Summarize recent messages from a Slack channel.

## What This Does
Pulls recent Slack messages and returns a concise summary with decisions, blockers, and asks.

## When to Use
- Daily standup summaries
- Catching up on a channel
- Creating status updates

## Examples

<example>
User: "Summarize #product from this morning"
Call: channel="#product", limit=60
</example>`,

  scheduleStandupDigest: `Schedule a recurring standup digest.

## What This Does
Creates a scheduled job that generates a standup summary at a set time.

## Defaults
- Weekdays at 09:00
- Mode: suggest (draft only)

## Examples

<example>
User: "Every weekday at 9am, send a standup summary to #eng"
Call: channel="#eng", time="09:00", days="weekdays", mode="execute"
</example>`,

  getWorkspacePrompt: `Fetch the workspace's current instructions ("agent soul").

Use this when you need to know the team's preferences, guardrails, or operating style.`,

  updateWorkspacePrompt: `Update the workspace instructions ("agent soul").

Use this when new operating rules, preferences, or guardrails are established.
This does NOT require user confirmation by default.`,

  appendWorkspacePrompt: `Append a single instruction to the workspace prompt.

Use this when the user states a stable preference, guardrail, or workflow rule.
This does NOT require user confirmation by default.`,
} as const;

export const ERROR_MESSAGES = {
  noWorkspace: "No workspace context found. Please ensure you're logged in.",
  noPermission: "You don't have permission to perform this action.",
  notFound: (entity: string) => `${entity} not found.`,
  actionFailed: (action: string) => `Failed to ${action}. Please try again.`,
  needsConfirmation:
    'This action requires confirmation. Please confirm to proceed.',
} as const;
