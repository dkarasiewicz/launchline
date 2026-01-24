# Integration Domain Architecture

The Integration domain owns OAuth connections, token storage, and webhook ingestion for external tools (Linear, Slack, GitHub).

## Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Integration Domain                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐    ┌─────────────────────────┐            │
│  │ IntegrationCtrl  │───▶│ IntegrationOAuthService │            │
│  │  (REST API)      │    │ (provider OAuth flows)  │            │
│  └──────────────────┘    └──────────────┬───────────┘            │
│           │                            │                        │
│           │                            ▼                        │
│           │                   ┌──────────────────┐             │
│           │                   │ IntegrationService│             │
│           │                   │ (tokens + CRUD)   │             │
│           │                   └────────┬─────────┘             │
│           │                            │                        │
│           ▼                            ▼                        │
│  ┌──────────────────┐     ┌──────────────────┐                  │
│  │ IntegrationWebhook│     │  Provider APIs  │                  │
│  │ Service           │     │ Linear / Slack  │                  │
│  └────────┬──────────┘     └──────────────────┘                  │
│           │                                                      │
│           ▼                                                      │
│     EventBus (RabbitMQ)  ─────────────▶ Linea Domain             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Components

### IntegrationController (`integration.controller.ts`)

REST endpoints for OAuth and webhook entry points:

- `GET /integrations/oauth/linear/init`
- `GET /integrations/oauth/linear/callback`
- `GET /integrations/oauth/slack/init`
- `GET /integrations/oauth/slack/callback`
- `POST /integrations/webhooks/linear`
- Slack events are received via Bolt at `POST /integrations/webhooks/slack`

### IntegrationOAuthService (`integration.oauth.service.ts`)

Provider-specific OAuth logic:

- Builds provider authorization URLs
- Exchanges authorization codes for tokens
- Stores Integration records
- Publishes `IntegrationConnectedEvent`

### IntegrationWebhookService (`integration.webhook.service.ts`)

Webhook/event ingestion:

- Verifies Linear signatures
- Resolves the workspace by external org/team ID
- Publishes `IntegrationWebhookReceivedEvent`

### LinearService (`linear.service.ts`)

Linear SDK helpers:

- Fetch viewer/org data
- Verify webhook signatures
- List/create/delete webhooks (manual use for now)

### SlackBoltService (`slack-bolt.service.ts`)

Slack Bolt receiver:

- Mounts an ExpressReceiver at `/integrations/webhooks/slack`
- Handles Slack event callbacks
- Forwards payloads into `IntegrationWebhookService`

### SlackService (`slack.service.ts`)

Slack Web API wrapper:

- List channels and users
- Fetch recent channel messages
- Post messages

### IntegrationService (`integration.service.ts`)

- Token encryption (AES-256-GCM)
- Integration CRUD
- Access token retrieval

### IntegrationFacade (`integration.facade.ts`)

Public API for other domains to query integration status or tokens.

## Data Model

### Integration table

| Field | Type | Description |
|------|------|-------------|
| id | UUID | Primary key |
| workspaceId | UUID | Launchline workspace |
| type | Enum | linear, slack, github, etc. |
| status | Enum | pending, active, error, expired, revoked |
| externalAccountId | String | User ID in external system |
| externalAccountName | String | Display name in external system |
| externalOrganizationId | String | Org/team ID in external system |
| externalOrganizationName | String | Org/team name |
| scopes | String[] | OAuth scopes |
| accessToken | String | Encrypted access token |
| refreshToken | String | Encrypted refresh token |
| tokenExpiresAt | Date | Token expiration |
| lastSyncAt | Date | Last sync timestamp |

## OAuth Flows

### Linear OAuth

```
User -> /integrations/oauth/linear/init
  -> Linear authorize URL
  -> /integrations/oauth/linear/callback
  -> Exchange code for token
  -> Store Integration
  -> Publish IntegrationConnectedEvent
```

### Slack OAuth

```
User -> /integrations/oauth/slack/init
  -> Slack authorize URL (OAuth v2)
  -> /integrations/oauth/slack/callback
  -> Exchange code for token
  -> Store Integration (teamId + teamName)
  -> Publish IntegrationConnectedEvent
```

## Webhook/Event Flow

### Linear Webhooks

Linear sends webhooks to:

```
POST /integrations/webhooks/linear
```

The service verifies the signature (if `LINEAR_WEBHOOK_SECRET` is set), resolves the Integration by `organizationId`, and publishes `IntegrationWebhookReceivedEvent`.

### Slack Events

Slack events are delivered to:

```
POST /integrations/webhooks/slack
```

Slack Bolt verifies the signature using `SLACK_SIGNING_SECRET`, then forwards the payload into `IntegrationWebhookService`, which publishes `IntegrationWebhookReceivedEvent`.

## Events

### IntegrationConnectedEvent

```typescript
{
  integrationId: string;
  workspaceId: string;
  userId: string;
  integrationType: 'linear' | 'slack' | 'github';
  externalAccountId?: string;
  externalAccountName?: string;
  externalOrganizationId?: string;
  externalOrganizationName?: string;
  emittedAt: string;
}
```

### IntegrationWebhookReceivedEvent

```typescript
{
  integrationId: string;
  workspaceId: string;
  integrationType: 'linear' | 'slack' | 'github';
  eventType: string;
  action?: string;
  externalEventId?: string;
  payload: string; // JSON string
  emittedAt: string;
}
```

## Configuration

Required environment variables:

```bash
# Integration encryption key (32 bytes hex-encoded)
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

## Notes

- Linear webhook creation is currently manual. Configure a webhook in Linear pointing to `/integrations/webhooks/linear`.
- Slack events must be enabled in the Slack app settings and point to `/integrations/webhooks/slack`.
