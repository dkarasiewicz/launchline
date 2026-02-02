# Tool UIs

This document describes the UI components that render tool outputs in the chat interface. Each backend tool used by the Linea agent has a corresponding UI component.

## Overview

Tool UIs are React components registered with `makeAssistantToolUI` from `@assistant-ui/react`. They render automatically when the agent calls a tool with the matching name.

## Tool Categories

### Memory Tools

| Tool Name | UI Component | Description |
|-----------|--------------|-------------|
| `search_memories` | `SearchMemoriesToolUI` | Memory search results table |
| `save_memory` | `SaveMemoryToolUI` | Save confirmation |
| `get_blockers` | `GetBlockersToolUI` | Active blockers list |
| `get_decisions` | `GetDecisionsToolUI` | Recent decisions list |
| `resolve_identity` | `ResolveIdentityToolUI` | Cross-platform identity resolution |

### Inbox Tools

| Tool Name | UI Component | Description |
|-----------|--------------|-------------|
| `get_inbox_items` | `GetInboxItemsToolUI` | Filterable inbox table |
| `get_workspace_status` | `GetWorkspaceStatusToolUI` | Workspace status summary |

### Linear Skills

| Tool Name | UI Component | Description |
|-----------|--------------|-------------|
| `get_linear_issues` | `GetLinearIssuesToolUI` | Issues list |
| `get_linear_issue_details` | `GetLinearIssueDetailsToolUI` | Full issue details |
| `search_linear_issues` | `SearchLinearIssuesToolUI` | Search results |
| `get_linear_project_status` | `GetLinearProjectStatusToolUI` | Project overview |
| `get_linear_team_workload` | `GetLinearTeamWorkloadToolUI` | Workload distribution |
| `get_linear_cycle_status` | `GetLinearCycleStatusToolUI` | Sprint status |
| `add_linear_comment` | `AddLinearCommentToolUI` | Comment confirmation |

### Project Updates

| Tool Name | UI Component | Description |
|-----------|--------------|-------------|
| `generate_project_update` | `GenerateProjectUpdateToolUI` | Stakeholder update card |

### Approval Tools (human-in-the-loop)

| Tool Name | UI Component | Description |
|-----------|--------------|-------------|
| `update_linear_ticket` | `UpdateLinearTicketToolUI` | Ticket update approval |
| `send_slack_message` | `SendSlackMessageToolUI` | Message preview / send |
| `create_github_issue` | `CreateGitHubIssueToolUI` | Issue creation approval |
| `internet_search` | `InternetSearchToolUI` | Search query approval |

### Utility Tools

| Tool Name | UI Component | Description |
|-----------|--------------|-------------|
| `think` | `ThinkToolUI` | Internal reasoning viewer |
| `write_todos` | `WriteTodosToolUI` | Task planning UI (DeepAgents) |

## File Structure

```
libs/shared/client/ui/src/components/
├── tool-ui/
│   ├── approval/
│   ├── inbox/
│   ├── linear/
│   ├── memories/
│   ├── plan/
│   ├── project-update/
│   ├── shared/
│   └── index.ts         # Tool UI registry
├── inbox/
│   ├── inbox-thread.tsx
│   └── linea-chat.tsx
└── assistant-ui/
    └── index.ts
```

## Creating a New Tool UI

1. **Create the UI component** with `makeAssistantToolUI`:

```tsx
import { makeAssistantToolUI } from '@assistant-ui/react';

export const MyToolUI = makeAssistantToolUI<MyArgs, string>({
  toolName: 'my_tool_name',
  render: ({ args, result, status }) => {
    return <div>{result}</div>;
  },
});
```

2. **Export from the category index** and from `tool-ui/index.ts`.

3. **Register in the chat surfaces**:

- `libs/shared/client/ui/src/components/inbox/inbox-thread.tsx`
- `libs/shared/client/ui/src/components/inbox/linea-chat.tsx`

These two surfaces should register all tool UIs that the agent can call.

## Best Practices

1. Show loading states when `status.type === 'running'`.
2. Parse JSON results defensively and render errors clearly.
3. Keep cards compact and scannable (the inbox UI is dense).
4. Match the tool name exactly to the backend tool name.
