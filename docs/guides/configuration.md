# Configuration Guide

This guide lists the essential environment variables for running Launchline locally or in production.

## Core URLs and sessions

```bash
# Backend base URL (used for OAuth callbacks)
APP_URL=http://localhost:3000

# Frontend base URL
FRONTEND_URL=http://localhost:4200

# Session configuration
SESSION_SECRET=replace_with_secure_secret
SESSION_NAME=core.sid
SESSION_SECURE=false
SESSION_SAME_SITE=strict
```

## Integrations

```bash
# Token encryption (32 bytes hex)
INTEGRATION_ENCRYPTION_KEY=your_64_char_hex_string

# Linear OAuth
LINEAR_CLIENT_ID=your_linear_client_id
LINEAR_CLIENT_SECRET=your_linear_client_secret
LINEAR_WEBHOOK_SECRET=optional_webhook_secret

# Slack OAuth + webhook verification
SLACK_CLIENT_ID=your_slack_client_id
SLACK_CLIENT_SECRET=your_slack_client_secret
SLACK_SIGNING_SECRET=your_slack_signing_secret
```

## AI models

```bash
# Primary model
PRIMARY_MODEL_API_KEY=sk-...
PRIMARY_MODEL_NAME=gpt-4o

# Fast model
FAST_MODEL_API_KEY=sk-...
FAST_MODEL_NAME=gpt-4o-mini

# Analysis model
ANALYSIS_MODEL_API_KEY=sk-...
ANALYSIS_MODEL_NAME=gpt-4o

# Reasoning model
REASONING_MODEL_API_KEY=sk-...
REASONING_MODEL_NAME=o1-preview
```

## Database and cache

```bash
# Postgres
DB_USERNAME=postgres
DB_PASS=postgres
DB_DATABASE=launchline
DB_HOST=localhost
DB_PORT=5432

# Redis
CACHE_HOST=localhost
CACHE_PORT=6379

# RabbitMQ
EVENT_BUS_RABBIT_MQ_URL=amqp://localhost:5672
```

## Customer UI

```bash
# GraphQL/API base for Next.js (SSR)
NEXT_PUBLIC_CORE_API_URL=http://localhost:3000
```

## Optional

```bash
# PostHog (optional analytics)
POSTHOG_API_KEY=phc_...
POSTHOG_HOST=https://app.posthog.com
```

## Notes

- Use `openssl rand -hex 32` to generate `INTEGRATION_ENCRYPTION_KEY`.
- `APP_URL` and `FRONTEND_URL` must match the OAuth redirect URLs configured in Linear and Slack.
