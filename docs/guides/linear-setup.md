# Linear Integration Setup

This guide walks through connecting Linear to Launchline.

## Prerequisites

- Linear admin access
- Launchline backend running
- Environment variables configured

## Step 1: Create a Linear OAuth app

1. Go to Linear Settings -> API
2. Create a new OAuth application
3. Set redirect URLs:
   - Local: `http://localhost:3000/integrations/oauth/linear/callback`
   - Prod: `https://your-domain.com/integrations/oauth/linear/callback`
4. Copy the Client ID and Client Secret

## Step 2: Configure environment variables

```bash
LINEAR_CLIENT_ID=your_linear_client_id
LINEAR_CLIENT_SECRET=your_linear_client_secret

# Token encryption
INTEGRATION_ENCRYPTION_KEY=your_64_char_hex_string

# App URLs (must match OAuth config)
APP_URL=http://localhost:3000
FRONTEND_URL=http://localhost:4200
```

Generate an encryption key:

```bash
openssl rand -hex 32
```

## Step 3: Run database migrations

```bash
pnpm nx migrate-run core
```

## Step 4: Connect Linear

1. Start the backend: `pnpm nx serve-hmr core`
2. Start the frontend: `pnpm nx dev customer-ui`
3. Log in to Launchline
4. Go to Inbox -> Settings -> Integrations
5. Click "Connect Linear" and authorize

## Optional: Configure webhooks

To receive live updates (beyond onboarding), create a Linear webhook:

- URL: `http://localhost:3000/integrations/webhooks/linear`
- Secret: set `LINEAR_WEBHOOK_SECRET` in your environment (optional but recommended)

## What happens after connection

- OAuth tokens are stored (encrypted)
- `IntegrationConnectedEvent` triggers Linea onboarding
- Inbox items are created from Linear data

## Troubleshooting

### "Linear integration is not configured"

Missing `LINEAR_CLIENT_ID` or `LINEAR_CLIENT_SECRET`.

### "Invalid OAuth state"

Your browser session expired or the flow took too long. Retry connect.

### Webhook signature verification failed

`LINEAR_WEBHOOK_SECRET` does not match the secret configured in Linear.

## Next steps

- Watch the inbox populate
- Ask Linea for sprint status, blockers, or updates
- See `docs/guides/demo.md` for a short demo flow
