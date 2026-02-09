---
name: web-research
description: Use this skill for requests that require web research, source gathering, competitive scans, or up-to-date external info. This skill provides a structured plan → delegate → synthesize workflow with citations.
---

# Web Research Skill

## Goal

Conduct comprehensive web research with a clear plan, delegated subtopics, and a concise synthesis with sources.

## Workflow

### 1) Plan first

- Create a short research plan with 2-5 non-overlapping subtopics.
- Use `write_todos` to track progress.
- Save a plan file at `research_[topic_name]/research_plan.md` using `write_file` (the file tool can create the folder if needed).

Plan template:

```md
# Research Plan: <topic>

Main question:
- <question>

Subtopics:
1) <subtopic>
2) <subtopic>
3) <subtopic>

Expected outputs:
- <what you need to answer>
```

### 2) Delegate to subagents

Use the `task` tool to spawn 2-3 subagents in parallel. Each subagent:

- Runs 3-5 `internet_search` queries max
- Saves findings to `research_[topic_name]/findings_[subtopic].md` via `write_file`
- Includes key facts, quotes (short), and source URLs

Subagent prompt template:

```
Research: <specific subtopic>. Use internet_search only.
Save findings to research_<topic>/findings_<subtopic>.md.
Include: key facts, short quotes, source URLs, and any gaps.
Limit to 3-5 searches.
```

### 3) Synthesize

- Use `ls` and `read_file` to review findings files.
- Produce a concise response with:
  - Direct answer to the main question
  - Integrated insights from all subtopics
  - Citations (URLs) for key claims
  - Gaps/uncertainties if any

## Best Practices

- Prefer recent sources and primary documentation.
- Avoid over-researching; stop when you can answer confidently.
- Highlight conflicts between sources.
