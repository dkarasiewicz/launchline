# Launchline

Launchline is the **execution inbox for product managers (PMs)** — an AI‑augmented platform that watches work across your tools (Linear, Slack, GitHub), surfaces what matters now, and helps PMs take confident action.

Unlike dashboards or planning tools that only track work, Launchline focuses on **understanding** and **acting** on work by turning raw signals into summaries, insights, and suggested actions with a human‑in‑the‑loop workflow.

> Status: Early stage. APIs, schemas, and configuration may change.

---

## Features

- **PM Inbox**
  - One place for blockers, priority drift, and project update opportunities.
- **Generative summaries**
  - Human‑readable explanations of context across Linear, GitHub, Slack.
- **Suggested actions**
  - Structured, user‑approved actions (update Linear, comment on GitHub, notify via Slack).
- **Conversational threads**
  - Chat‑style interface for each Inbox item, powered by AI agents.
- **Tool integrations**
  - Current: Linear, GitHub, Slack.  
  - Planned: Notion, Jira, Figma, feedback tools.

---

## The bigger picture

Product work is becoming too complex for humans alone.

Modern products are built across dozens of tools, teams, and decisions. PMs are expected to keep everything aligned — but the system itself doesn\'t learn. Launchline is building the missing layer: a product copilot that understands context, history, and tradeoffs — not just tickets.

### Today: Execution inbox

Captures blockers, risks, and decisions across tools.

### Next: Product memory

Understands how your team, product, and users behave over time.

### Eventually: Product copilot

Helps steer priorities and tradeoffs — grounded in reality.

We start where the pain is highest: execution. Inbox → decisions → unblock → ship.

---

## Architecture (high level)

Signals flow through the system as follows:

```text
Signals (webhooks / SDK events)
↓
PostgreSQL (structured event store)
↓
LangGraph (memory + semantic relationships)
↓
Rule engine (blocker / drift / staleness detection)
↓
Inbox items
↓
Assistant UI + DeepAgent (chat + reasoning)
↓
Tool calls (user‑approved execution)
```

Key components:

- **Backend**: Nest.js / Express (TypeScript) REST APIs and background workers.
- **Frontend**: Next.js + React + Shadcn UI.
- **Storage**: PostgreSQL for structured data, Redis for caching/rate limits.
- **Queueing**: RabbitMQ (optional) for batched async jobs.
- **AI layer**: LangGraph + LangChain DeepAgent for reasoning and summaries.

---

## Open‑core model & licensing

Launchline is **open‑core** and **self‑hostable**.

- **Core application** (server, UI, agents, prompts, graphs, workflows)
  - Licensed under **Business Source License 1\.1 (BSL 1\.1)** with a *no competing hosted service* restriction.
  - See `LICENSE`.

- **SDKs and client libraries** (TypeScript / JavaScript)
  - Licensed under **MIT** for maximum adoption.
  - See the `LICENSE` file inside each SDK package (for example `packages/sdk`).

You can:

- Audit and self‑host the full platform.
- Use the SDKs in commercial and proprietary applications.
- Not offer Launchline (or a substantially similar service) as a competing hosted service.

---

## Environment configuration

Before running the application (locally or with Docker), copy `.env.example` to `.env` in the repo root and fill in the required environment variables.  
**Do not commit real secrets or credentials.**  
See `.env` for the full list of required variables (database, cache, API keys, etc).

---

## Self‑hosting with `docker‑compose`

### Prerequisites

- Docker
- Docker Compose
- A `.env` file in the repo root (see above).

### Start the stack

From the repository root:

```bash
docker-compose up -d
```

This will start **only the development dependencies/services** needed for local development:

- PostgreSQL (and Redis / RabbitMQ if configured)

> The full local production-ready stack (including backend and frontend containers) will be documented later.

### Access

- UI: `http://localhost:3000` (or the port from `LAUNCHLINE_PORT`)
- API: `http://localhost:3000/api` (or your configured base path)

You can now connect Linear, GitHub, and Slack, then start seeing Inbox items for blockers, drift, and updates.

---

## Using the TypeScript / JavaScript SDK

The SDK is MIT‑licensed and provides a thin client for calling the Launchline API.

Install from npm:

```bash
npm install @launchline/sdk
# or
yarn add @launchline/sdk
# or
pnpm add @launchline/sdk
```

Basic usage:

```ts
import { LaunchlineClient } from '@launchline/sdk';

const client = new LaunchlineClient({
  baseUrl: 'http://localhost:3000',
  apiKey: process.env.LAUNCHLINE_API_KEY,
});

async function main() {
  const result = await client.agents.run({
    agentId: 'my-agent-id',
    input: { message: 'Summarize current blockers' },
  });

  console.log(result);
}

main().catch(console.error);
```

See the SDK package `README` for full API documentation and examples.

---

## Local development (without Docker)

1. Install dependencies:

```bash
npm install
# or
yarn install
# or
pnpm install
```

2. Ensure your local services (PostgreSQL, Redis, RabbitMQ) are running.  
   You can use `docker-compose up -d` to start these dependencies.

3. Create and configure your `.env` file as described above.

4. Run database migrations:

```bash
pnpm nx migrate-run core
```

5. Start dev servers:

```bash
# Backend API (with HMR)
pnpm nx serve-hmr core

# Frontend (customer UI)
pnpm nx start customer-ui -p 2201
```

---

## Contributing

Issues and pull requests are welcome.

By contributing, you agree that:

- Changes to the core application are licensed under BSL 1\.1.
- Changes to SDKs and libraries follow the license of that package (usually MIT).

See `CONTRIBUTING.md` (if present) for guidelines.

---

## License

- Core application, prompts, graphs, and workflows: **Business Source License 1\.1 (BSL 1\.1)** with a *no competing hosted service* restriction. See `LICENSE`.
- SDKs and client libraries: **MIT**. See each package\-specific `LICENSE`.
