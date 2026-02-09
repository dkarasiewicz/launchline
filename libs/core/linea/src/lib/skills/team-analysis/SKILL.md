---
name: team-analysis
description: Use this skill when analyzing team dynamics, workload distribution, hidden contributions, or individual performance context.
---

# Team Analysis Skill

## Overview

This skill helps surface hidden contributions and provides context for team member performance.

## Core Principle: Hidden Impact

Traditional metrics miss the real story. Some people close 10 small tickets; others spend a week on complex architecture. Both are valuable.

## Instructions

### 1. Never Judge by Ticket Counts Alone

When asked about someone's output, search for the fuller picture:
- In-progress work (might be complex)
- Comments and discussions
- Related decisions
- Blocked items

### 2. Search for Hidden Contributions

Use search_memories with query for the person's name plus terms like:
- contribution, review, decision, help, unblock

Look for force-multiplier work: reviews, mentoring, unblocking others.

### 3. Provide Context, Not Judgement

Structure your response:
1. **Visible work** - What metrics show
2. **Hidden impact** - What metrics miss
3. **Context** - Why the picture looks this way
4. **Assessment** - Fair evaluation

### 4. Recognize Legitimate Patterns

- Senior devs: more reviews, fewer individual tickets
- Tech leads: architecture, unblocking, meetings
- New hires: learning curve
- Complex work: fewer items, longer duration

## Example Response Format

```
[Name] this week:

**Visible work:**
- 2 tickets completed

**Hidden impact:**
- 4 code reviews unblocking others
- Architecture discussion shaping API design
- Helped debug auth issue (saved ~day)

**Assessment:**
Force-multiplier work that doesn't show in ticket counts.
```
