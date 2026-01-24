# Linea Skills

Skills are reusable agent capabilities that provide specialized workflows and domain knowledge for the Linea AI assistant.

## Available Skills

| Skill | Description |
|-------|-------------|
| `linear-integration` | Work with Linear issues, projects, sprints, and team workload |
| `team-analysis` | Analyze team dynamics, hidden contributions, and workload |
| `blocker-detection` | Identify and resolve blockers proactively |
| `project-status` | Generate project updates and stakeholder communications |

## How Skills Work

Skills follow the [Agent Skills standard](https://agentskills.io/). Each skill is a directory containing:

- `SKILL.md` - Instructions and metadata (required)
- Additional scripts (optional)
- Reference documentation (optional)

### Progressive Disclosure

Skills use progressive disclosure - the agent only reviews skill details when relevant:

1. Agent starts: reads skill metadata (name, description)
2. User sends message: agent checks if any skill matches
3. If match found: agent reads the full SKILL.md instructions
4. Agent uses skill guidance to handle the request

## Skill Structure

```
libs/core/linea/src/lib/skills/
├── linear-integration/
│   └── SKILL.md
├── team-analysis/
│   └── SKILL.md
├── blocker-detection/
│   └── SKILL.md
└── project-status/
    └── SKILL.md
```

### SKILL.md Format

```markdown
---
name: skill-name
description: Brief description for matching prompts
---

# Skill Name

## Overview
What this skill does

## Instructions
Step-by-step guidance for the agent

## Examples
Example workflows and responses
```

## Creating New Skills

1. Create a new directory under `libs/core/linea/src/lib/skills/`
2. Add a `SKILL.md` file with frontmatter and instructions
3. Restart the server - skills are loaded at startup

### Best Practices

- **Keep descriptions concise** - Used for matching, should be clear
- **Provide step-by-step instructions** - Agent follows them literally
- **Include examples** - Show expected input/output patterns
- **Reference available tools** - Tell agent which tools to use
- **Set boundaries** - What the skill should NOT do

## Integration

Skills are loaded by `SkillsFactory` and:

1. Stored in PostgresStore under the `filesystem` namespace
2. Passed to the deep agent via `skills: ['/skills/']` config
3. Summarized in the system prompt for quick reference

The agent can then read skill files when handling relevant requests.

## Skill Categories

### Query Skills
- `linear-integration` - Read Linear data
- `blocker-detection` - Find blockers

### Analysis Skills  
- `team-analysis` - Understand team dynamics
- `project-status` - Synthesize status

### Action Skills
Skills can also guide action tools (update_linear_ticket, send_slack_message, etc.) but these require user approval.
