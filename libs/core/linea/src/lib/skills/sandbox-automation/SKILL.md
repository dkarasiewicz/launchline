---
name: sandbox-automation
description: Use this skill for tasks that require running commands or scripts in the sandbox. It provides a plan-first workflow for using run_sandbox_workflow, dependency setup, verification, and iterative loops.
---

# Sandbox Automation Skill

## Goal

Safely automate multi-step tasks in the sandbox using `run_sandbox_workflow`.

## How this maps to DeepAgents

The DeepAgents example uses an `execute` tool plus filesystem tools. In Linea, use:

- `run_sandbox_workflow` for command execution (analogous to `execute`)
- Shell commands inside the workflow for file ops (e.g., `ls`, `cat`, `mkdir -p`)
- Keep one session alive to iterate (reuse `sessionId`)
- Delegate execution to the `sandbox_runner` subagent when the workflow is multi-step or likely to need retries.
  - The `sandbox_runner` subagent has BaseSandbox-backed `execute` and filesystem tools.

## Workflow

### 1) Plan and track

- Outline the steps and use `write_todos` to track execution.
- Identify required tooling (apt, pnpm, pip) and include installation as step 1.
- Decide on a Docker image if a specific toolchain is needed.

### 2) Execute in a single session

- Use `run_sandbox_workflow` with `persistWorkspace` enabled.
- Keep the session alive for iterative loops (pass `keepAlive: true`).
- Reuse `sessionId` on follow-up calls to continue work.
- For complex workflows, spawn `sandbox_runner` via `task` and have it execute steps + report results.

### 3) Verify and summarize

- Include a verification step (tests, lint, output checks).
- Summarize results and next actions.

## Runbook Template

```
steps:
1) Install deps (apt/pnpm/pip)
2) Prepare workspace (clone/copy/setup)
3) Run primary task
4) Verify results
```

## Example Workflow

```
{
  "goal": "Create and run hello.js",
  "steps": [
    { "name": "init", "command": "mkdir -p app && cd app && printf 'console.log(\"Hello\")\\n' > hello.js" },
    { "name": "run", "command": "cd app && node hello.js" }
  ],
  "persistWorkspace": true,
  "keepAlive": true
}
```

## Notes

- If a step fails, rerun with the same `sessionId` and updated commands.
- Keep commands explicit and deterministic.
