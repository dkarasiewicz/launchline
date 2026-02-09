---
name: deepagents-harness
description: Use this skill when the user asks about deepagents harness capabilities, tool names, task delegation, filesystem access, or sandbox execution. It provides a concise operational cheat sheet.
---

# DeepAgents Harness Skill

## Core Capabilities

- **Task delegation**: Use `task` to spawn subagents for isolated work.
- **Planning**: Use `write_todos` for multi-step tasks and update statuses.
- **Filesystem tools**: `ls`, `read_file`, `write_file`, `edit_file`, `glob`, `grep`.
- **Human-in-the-loop**: `interrupt_on` gates sensitive tools.
- **Summarization**: History auto-compresses at high token usage.

## Operational Guidance

- Delegate early when work can be parallelized (research + analysis + drafting).
- Keep tasks small, with explicit output format.
- Use file tools for structured artifacts and breadcrumbs.
- Prefer short, actionable plans with 3-6 steps.

## Common Patterns

- **Research**: plan → task subagents → synthesize with citations.
- **Automation**: plan → run sandbox workflow → verify → summarize.
- **Comms**: draft → confirm → send.
