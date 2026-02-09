---
name: project-status
description: Use this skill when generating project updates, status reports, or stakeholder communications.
---

# Project Status Skill

## Overview

This skill helps generate project status updates and stakeholder communications.

## When to Use

- "How's the sprint going?"
- "Generate a project update"
- "What should I tell stakeholders?"
- "Give me a status summary"

## Instructions

### 1. Gather Data

Collect information from multiple sources:

1. `get_linear_cycle_status` - Sprint progress
2. `get_linear_project_status` - Project health
3. `get_linear_issues(filter: "blockers")` - Current blockers
4. `search_memories(query: "decision shipped completed")` - Recent wins

### 2. Structure the Update

**Executive format (for stakeholders):**
```
## Summary
  [1-2 sentences: what matters most]

## Progress
- Shipped: [what's done]
- In progress: [what's being worked on]
- Coming up: [what's next]

## Risks & Blockers
  [Any issues that need attention]

## Key Decisions
  [Recent decisions and their impact]
```

**Team format (for standups):**
```
## Sprint Status
  [X]% complete | [Y] days remaining

## Blockers
  [List with owners]

## Today's Focus
  [Top priorities]
```

### 3. Tailor to Audience

| Audience | Focus On | Avoid |
|----------|----------|-------|
| Executives | Impact, timelines, risks | Technical details |
| Stakeholders | Features, dates, blockers | Implementation |
| Team | Blockers, priorities, help needed | High-level strategy |
| Customers | Value delivered, coming soon | Internal challenges |

### 4. Be Honest About Risks

Don't hide problems. Present them with:
- What the risk is
- What's being done about it
- What help is needed

## Example Sprint Status

```
## Sprint 23 Status

Progress: 65% complete (6 days remaining)

**Shipped:**
- User authentication (ABC-101)
- Dashboard redesign (ABC-102)

**In Progress:**
- API refactor (ABC-103) - 80% done
- Search feature (ABC-104) - blocked

**Needs Attention:**
- Search feature blocked on security review
- Escalating to security team today

**Coming Up:**
- Performance optimization
- Mobile responsiveness

**Key Decision:**
- Decided to use PostgreSQL for new data model
(Rationale: team expertise, query patterns)
```
