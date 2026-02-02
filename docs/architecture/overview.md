# System Overview

Launchline is an AI-powered execution platform that surfaces hidden context from your tools.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Frontend (Next.js)                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐    │
│  │  Inbox   │  │ Settings │  │  Thread  │  │  Assistant UI        │    │
│  │  View    │  │  Page    │  │  View    │  │  (Chat Interface)    │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           Backend (NestJS)                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────────┐  │
│  │ Auth Module  │  │  Workspace   │  │     Integration Module       │  │
│  │ (OTP, JWT)   │  │   Module     │  │  (OAuth, Webhooks, Tokens)   │  │
│  └──────────────┘  └──────────────┘  └──────────────────────────────┘  │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                        Linea Module                                │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐   │  │
│  │  │  DeepAgent  │  │  Graphs     │  │  Memory Service         │   │  │
│  │  │  (Chat AI)  │  │  (Ingest)   │  │  (Vector + Structured)  │   │  │
│  │  └─────────────┘  └─────────────┘  └─────────────────────────┘   │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
             ┌───────────┐  ┌───────────┐  ┌───────────┐
             │PostgreSQL │  │  Redis    │  │ RabbitMQ  │
             │(Data)     │  │(Cache)    │  │(Events)   │
             └───────────┘  └───────────┘  └───────────┘
```

## Data Flow

### 1. Integration Connection
```
User → OAuth → Linear/Slack → Callback → Save Token → Publish Event → Onboarding
```

### 2. Signal Ingestion
```
Linear Webhook → Integration → RabbitMQ → Linea → Normalize → Classify → Inbox
```

### 3. User Conversation
```
User Message → Assistant → DeepAgent → Tools → Memory → Response
```

## Key Modules

| Module | Purpose |
|--------|---------|
| Auth | User authentication via OTP |
| Workspace | Team/org management |
| Integration | External tool connections |
| Linea | AI agent + signal processing |

## Events

| Event | Publisher | Subscriber |
|-------|-----------|------------|
| IntegrationConnected | Integration | Linea (onboarding) |
| IntegrationWebhookReceived | Integration | Linea (ingestion) |

See individual module docs for details.
