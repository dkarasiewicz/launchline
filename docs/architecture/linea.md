# Linea AI Agent

Linea is the AI PM assistant for Launchline. It helps Product Managers stay on top of their team's work by intelligently synthesizing information from GitHub, Linear, and Slack.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Linea Module                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                      DeepAgent (Main)                         │  │
│  │  - Streaming chat interface                                   │  │
│  │  - Tool calling                                               │  │
│  │  - Subagent delegation                                        │  │
│  │  - Checkpointing & memory                                     │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                       │
│           ┌─────────────────┼─────────────────┐                     │
│           ▼                 ▼                 ▼                     │
│  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐          │
│  │  Memory Tools  │ │ Linear Skills  │ │ Action Tools   │          │
│  │  - search      │ │ - get_issues   │ │ - update_ticket│          │
│  │  - save        │ │ - search       │ │ - send_slack   │          │
│  │  - blockers    │ │ - workload     │ │ (confirm first)│          │
│  │  - decisions   │ │ - cycle_status │ │                │          │
│  └────────────────┘ └────────────────┘ └────────────────┘          │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                       Subagents                               │  │
│  │  summarizer | researcher | analyst | reporter                 │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Ingestion Graphs                                  │
│  ┌──────────────────────┐    ┌──────────────────────┐              │
│  │  Onboarding Graph    │    │  Webhook Graph       │              │
│  │  (runs on connect)   │    │  (processes signals) │              │
│  └──────────────────────┘    └──────────────────────┘              │
└─────────────────────────────────────────────────────────────────────┘
```

## Core Capabilities

### 1. Execution Inbox
Linea's primary job is managing the **execution inbox** - a stream of signals that need PM attention:
- **Blockers** - Work that's stuck and needs intervention
- **Priority drift** - When priorities shift without explicit decisions  
- **Stalled work** - PRs and tickets with no recent activity
- **Update opportunities** - Stakeholders who need to be informed

### 2. Linear Skills (Real Integration)
Linea has direct access to Linear via the `@linear/sdk`:

| Tool | Description |
|------|-------------|
| `get_linear_issues` | Fetch issues with filters (my_issues, blockers, stalled) |
| `get_linear_issue_details` | Get full details including comments and sub-issues |
| `search_linear_issues` | Search across all issues |
| `get_linear_project_status` | Project progress, milestones, deadlines |
| `get_linear_team_workload` | Who has how many issues/points |
| `get_linear_cycle_status` | Sprint progress and timeline |
| `add_linear_comment` | Add comments to issues |

### 3. Memory System
Linea remembers context across conversations:

| Namespace | What's Stored |
|-----------|---------------|
| `decision` | Past decisions and rationale |
| `blocker` | Current and resolved blockers |
| `team` | Team structure, who does what |
| `project` | Project status and history |
| `identity` | Cross-platform identity links |

### 4. Workspace Prompts

Each workspace can store custom instructions for Linea. The backend injects these as a system message on every conversation:

- `GET /assistant/prompt` returns the current workspace prompt
- `POST /assistant/prompt` updates it

This lets teams tune tone, terminology, and decision rules without changing the global system prompt.

### 5. Subagent Delegation
For complex tasks, Linea delegates to specialized subagents:

| Subagent | Use For |
|----------|---------|
| `summarizer` | Condensing long threads or documents |
| `researcher` | Deep investigation across memories |
| `analyst` | Complex decisions with trade-offs |
| `reporter` | Generating polished reports |

## Data Flow

### Onboarding (on Linear connect)
```
IntegrationConnectedEvent
        │
        ▼
┌─────────────────┐
│ Onboarding Graph│
│ - Fetch org     │
│ - Fetch teams   │
│ - Fetch projects│
│ - Analyze data  │
│ - Create inbox  │
└─────────────────┘
        │
        ▼
   Inbox Items + Memories
```

### Webhook Processing
```
Linear Webhook → IntegrationWebhookReceivedEvent
                          │
                          ▼
                  ┌───────────────┐
                  │ Webhook Graph │
                  │ - Normalize   │
                  │ - Classify    │
                  │ - Update inbox│
                  └───────────────┘
```

### User Conversation
```
User Message → AssistantController → DeepAgent
                                        │
                        ┌───────────────┼───────────────┐
                        ▼               ▼               ▼
                  Memory Tools    Linear Skills    Subagents
                        │               │               │
                        └───────────────┼───────────────┘
                                        ▼
                                   Response
```

## Configuration

### Models
Linea uses multiple models for different tasks:

```bash
# Main model (chat)
PRIMARY_MODEL_API_KEY=sk-xxx
PRIMARY_MODEL_NAME=gpt-4o

# Fast model (summarization)
FAST_MODEL_API_KEY=sk-xxx
FAST_MODEL_NAME=gpt-4o-mini

# Analysis model (deep analysis)
ANALYSIS_MODEL_API_KEY=sk-xxx
ANALYSIS_MODEL_NAME=gpt-4o

# Reasoning model (complex decisions)
REASONING_MODEL_API_KEY=sk-xxx
REASONING_MODEL_NAME=o1-preview
```

### Memory
```bash
MEMORY_EMBEDDING_TYPE=text-embedding-3-small
MEMORY_EMBEDDING_DIMS=1536
MEMORY_DEFAULT_SEARCH_LIMIT=20
```

## Key Files

| File | Purpose |
|------|---------|
| `agent.factory.ts` | Creates the DeepAgent instance |
| `tools.factory.ts` | Creates all tools including Linear skills |
| `linear-skills.factory.ts` | Linear SDK integration tools |
| `subagents.factory.ts` | Creates specialized subagents |
| `memory.service.ts` | Memory storage and retrieval |
| `onboarding-graphs.factory.ts` | Linear onboarding graph |
| `prompts/index.ts` | System prompts and tool descriptions |

## System Prompt Philosophy

Linea's system prompt emphasizes:

1. **Proactive, not reactive** - Surface issues before they're asked about
2. **Surface hidden impact** - Highlight work that doesn't show up in metrics
3. **Respect different styles** - Not everyone works the same way
4. **Be actionable** - Every insight should lead to a clear next step
5. **Confirm before acting** - Never take action without explicit approval

## Example Interactions

### Sprint Status
```
User: "How's the sprint going?"

Linea: "Sprint is at 45% completion with 6 days left. Key items:

🚨 Needs attention:
- AUTH-123 blocked for 3 days (waiting on security review)
- 2 PRs have no reviewers assigned

✅ On track:
- Search feature shipping tomorrow
- @mike closed 4 tickets today

📊 Workload:
- Backend team has 8 unassigned issues
- @sarah has 3 urgent items (might need help)

Want me to dig into any of these?"
```

### Hidden Impact
```
User: "What has Alex been working on? Not many tickets closed."

Linea: "Alex closed 2 tickets this week, but here's the bigger picture:

Visible work:
- Merged PR for caching layer (2 tickets)

Hidden impact:
- 4 code reviews that unblocked other PRs
- Architecture discussion that shaped the API design
- Helped @newdev debug auth issue (saved ~day of work)
- Refactored test suite - CI runs 40% faster now

Alex is doing force-multiplier work that doesn't show up in ticket counts."
```

## Future Enhancements

1. **GitHub Skills** - PR review status, CI status, code metrics
2. **Slack Skills** - Channel summaries, thread context
3. **Predictive Blockers** - ML model to predict issues before they block
4. **Auto-triage** - Automatically categorize and prioritize inbox items
5. **Custom Skills** - Allow users to define their own tools via MCP
