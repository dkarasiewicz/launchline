# Slack Integration Setup

This guide covers configuring a Slack app for Launchline.

## Step 1: Create a Slack app

1. Go to https://api.slack.com/apps
2. Create a new app "From scratch"
3. Choose a workspace

## Step 2: Configure OAuth

Under OAuth & Permissions:

- Add redirect URL:
  - Local: `http://localhost:3000/integrations/oauth/slack/callback`
  - Prod: `https://your-domain.com/integrations/oauth/slack/callback`

- Add bot token scopes:
  - `channels:read`
  - `channels:history`
  - `groups:read`
  - `groups:history`
  - `im:read`
  - `im:history`
  - `mpim:read`
  - `mpim:history`
  - `users:read`
  - `users:read.email`
  - `chat:write`

Install the app to your workspace after saving.

## Step 3: Enable event subscriptions

Under Event Subscriptions:

- Enable events
- Request URL:
  - Local: `http://localhost:3000/integrations/webhooks/slack`
  - Prod: `https://your-domain.com/integrations/webhooks/slack`

Subscribe to bot events:

- `message.channels`
- `message.groups`
- `message.im`
- `message.mpim`
- `app_mention`

## Step 4: Environment variables

```bash
SLACK_CLIENT_ID=your_slack_client_id
SLACK_CLIENT_SECRET=your_slack_client_secret
SLACK_SIGNING_SECRET=your_signing_secret
APP_URL=http://localhost:3000
FRONTEND_URL=http://localhost:4200
INTEGRATION_ENCRYPTION_KEY=your_64_char_hex_string
```

## Step 5: Connect Slack in Launchline

1. Start backend and frontend
2. Go to Inbox -> Settings -> Integrations
3. Click "Connect Slack"
4. Authorize the app

## Notes

- Slack messages to Linea are handled in DMs or when Linea is mentioned.
- Message replies are posted back in the same thread.
