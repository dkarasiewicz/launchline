---
name: delegation-orchestration
description: Use this skill for multi-track tasks that benefit from delegation, parallel research, or structured planning. It guides the main agent to use the task tool, subagents, and write_todos for coordination.
---

# Delegation Orchestration Skill

## Goal

Run multi-track work efficiently by delegating subproblems to subagents and coordinating with `write_todos`.

## When to Delegate

- The task mixes research, analysis, and drafting.
- There are 2+ independent subtopics.
- You need faster turnaround via parallel work.

## Subagent Roles

- **context_scout**: Rapid memory + signal gathering
- **distiller**: Compress long content into a high-signal brief
- **strategist**: Risk/trade-off analysis + prioritized plan
- **automation_designer**: Sandbox workflow and script design
- **sandbox_runner**: Execute sandbox workflows and report outcomes
- **communications_editor**: Polished updates/messages

## Workflow

1) Create a short plan and todo list with `write_todos`.
2) Spawn subagents using `task` with clear scope and output format.
3) Merge results into a concise response; keep citations and IDs.

## Task Prompt Template

```
Role: <subagent>
Objective: <specific question>
Constraints: <time/source/tool limits>
Output: <required format>
```

## Example

- context_scout: "Find relevant memories and blockers for project X."
- strategist: "Assess risks and propose a 3-step mitigation plan."
- communications_editor: "Draft a 5-line update to #team."
