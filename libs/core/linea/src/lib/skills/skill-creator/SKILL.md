---
name: skill-creator
description: Guide for creating or updating skills. Covers naming, required frontmatter, store-backed paths, and publishing.
---

# Skill Creator

## When to Use

- User asks to create, update, or validate a skill
- You need to scaffold a new skill directory quickly
- You need to standardize a skill for reuse

## Workflow

### 1) Choose a skill name

- Lowercase with hyphens only (e.g., `web-research`)
- Max 64 characters

### 2) Create the skill file

Create the file directly using `write_file`:

- `/skills/<skill-name>/SKILL.md`
- Include YAML frontmatter with `name` and `description`

### 3) Fill in SKILL.md

- Clear description and when-to-use bullets
- Step-by-step instructions
- Best practices and examples
- Supporting files (scripts/references/assets) if needed

### 4) Validate

- Ensure frontmatter has `name` and `description`
- Keep description under 1024 characters

### 5) Publish

- Confirm the skill path and name
- Call out how to invoke it in future requests

## Best Practices

- Keep skills concise and task-focused
- Prefer concrete steps and exact tool names
- Avoid redundant context the agent already knows
- Test the workflow with a small example

## Example

**User request:** "Create a skill for onboarding GitHub integrations"

**Approach:**
1. Create `/skills/github-onboarding/SKILL.md`
2. Fill in the steps and examples
4. Announce the new skill and when to use it
