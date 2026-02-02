export const linearIntegrationSkill = {
  name: 'linear-integration',
  description:
    'Use this skill for requests related to Linear issues, projects, sprints, and team workload. This skill provides guidance on how to effectively query and interact with Linear data.',
  content: `# Linear Integration Skill

## Overview

This skill provides instructions for accessing and working with Linear data through the Linea agent. Use this when the user asks about:
- Issues, tickets, or bugs
- Sprint/cycle status
- Project progress
- Team workload
- Blockers and stalled work

## Available Tools

### Query Tools (Read-Only)

| Tool | Purpose | When to Use |
|------|---------|-------------|
| \`get_linear_issues\` | Fetch issues with filters | General issue queries, blockers, stalled work |
| \`get_linear_issue_details\` | Get full issue details | When you need specifics about one issue |
| \`search_linear_issues\` | Text search across issues | When user mentions specific keywords |
| \`get_linear_project_status\` | Project health and progress | Project status questions |
| \`get_linear_team_workload\` | Workload distribution | Capacity and workload questions |
| \`get_linear_cycle_status\` | Sprint/cycle progress | Sprint status questions |

### Action Tools (Explicit Request)

| Tool | Purpose | When to Use |
|------|---------|-------------|
| \`create_linear_issue\` | Create a new issue | Use when the user explicitly asks to file/create a ticket |
| \`add_linear_comment\` | Add comment to issue | Use when the user wants to add context or questions |
| \`update_linear_ticket\` | Update issue fields | Use when the user wants to change priority, assignee, etc. (confirm if unclear) |

## Instructions

### 1. Understand the Request Type

Categorize the user's request:

- **Status Query**: "How's the sprint?", "What's blocking us?" → Use query tools
- **Specific Lookup**: "What's issue ABC-123 about?" → Use \`get_linear_issue_details\`
- **Search**: "Find issues about authentication" → Use \`search_linear_issues\`
- **Action Request**: "Update the priority" → Use action tools (require approval)
- **Create Request**: "Create a ticket for X" → Use \`create_linear_issue\` with required fields

### 2. Choose the Right Filter

For \`get_linear_issues\`, use appropriate filters:

- "my_issues": Current user's assigned issues
- "team_issues": All team issues
- "blockers": Issues marked as blocked
- "stalled": Issues with no activity for 7+ days
- "recent": Recently updated issues

### 3. Provide Actionable Summaries

When presenting Linear data:

1. **Lead with what matters** - Blockers first, then risks, then status
2. **Use ticket identifiers** - Always include IDs like "ABC-123"
3. **Show assignees** - "@name" format for quick identification
4. **Suggest next steps** - Don't just report, recommend

### 4. Handle Missing Data Gracefully

If Linear returns no results:
- Check if the integration is connected
- Suggest the user verify their Linear workspace
- Offer alternative queries

## Example Workflows

### Sprint Status Check

1. Call get_linear_cycle_status to get current sprint
2. If completion < expected, call get_linear_issues(filter: "stalled")
3. Summarize: completion %, blockers, at-risk items
4. Suggest actions for blockers

### Blocker Investigation

1. Call get_linear_issues(filter: "blockers")
2. For each blocker, note: assignee, age, dependencies
3. Identify who can unblock (check mentions, related issues)
4. Offer to add comments or escalate

### Workload Analysis

1. Call get_linear_team_workload
2. Identify overloaded team members (>50% above average)
3. Check for unassigned high-priority issues
4. Suggest rebalancing if needed

## Best Practices

1. **Be proactive** - Don't just answer, anticipate follow-ups
2. **Show context** - Include relevant links and IDs
3. **Respect privacy** - Don't judge individual performance
4. **Confirm actions** - Always get approval before modifying data`,
};
