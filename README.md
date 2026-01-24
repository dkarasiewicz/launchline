# Launchline

**Transparency without micromanagement. Impact without fake KPIs.**

Launchline is an AI execution inbox for product teams. It turns signals from Linear, GitHub, and Slack into clear, actionable context so PMs can see what is actually happening without surveillance or vanity metrics.

## Why Launchline

Most teams do not lack effort. They lack shared context.

- Dashboards show tickets closed, but miss blockers and invisible work.
- Metrics reward activity, not impact.
- One-size KPIs punish deep work and collaboration.

Launchline focuses on reality: what is stuck, what is drifting, and who is unblocking the team.

## What you can demo today

- **Execution Inbox** with auto-generated items after Linear connect
- **Linea agent** that explains blockers, drift, and hidden impact
- **Workspace-aware prompts** so each workspace can tune Linea
- **Human-in-the-loop actions** (Linear updates, Slack messages, GitHub issues)
- **Slack interaction** so teams can talk to Linea outside the web UI

## Demo flow (5 minutes)

1. **Connect Linear** (Settings -> Connect Linear)
2. **Show inbox items** (blockers, stalled work, unassigned priorities)
3. **Ask Linea for sprint status** (suggestion prompt)
4. **Show hidden impact** ("What has Sarah been doing?")
5. **Generate a project update** (stakeholder-ready summary)
6. **Optional: send a Slack update** from Linea

## How it works

```
Signals (webhooks, SDK events)
  -> PostgreSQL (event store)
  -> LangGraph (memory + relationships)
  -> Rules + LLM analysis
  -> Inbox items
  -> Linea agent + tool calls
```

Key components:

- **Backend**: NestJS (REST + GraphQL), background workers
- **Frontend**: Next.js + Assistant UI
- **Storage**: Postgres + Redis
- **AI layer**: LangGraph + LangChain + DeepAgents

## Local development

1. Copy `.env.example` to `.env` and fill required values.
2. Start dependencies:

```bash
docker-compose up -d
```

3. Start the stack (from repo root):

```bash
pnpm nx serve-hmr core
pnpm nx dev customer-ui
```

UI: `http://localhost:4200`
API: `http://localhost:3000/graphql`

## License

Launchline is open-core and self-hostable.

- **Core platform**: Business Source License 1.1 (no competing hosted service)
- **SDKs and client libraries**: MIT

See `LICENSE.txt` for details.
