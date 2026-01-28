# Linear Integration Guide

This guide explains how the Linear integration works in Launchline, from OAuth connection to webhook processing.

## Overview

The Linear integration allows Launchline to:

1. **Connect** via OAuth to access your Linear workspace
2. **Import** existing issues, projects, teams, and cycles on first connection
3. **Receive** real-time updates via webhooks when issues change
4. **Analyze** Linear data to detect blockers, priority drift, and stale work
5. **Act** by creating/updating Linear issues through suggested actions

## Setup

### 1. Get Linear OAuth Credentials

1. Go to [Linear Settings > API](https://linear.app/settings/api)
2. Create a new OAuth application
3. Set the redirect URL to: `{YOUR_APP_URL}/api/integrations/oauth/linear/callback`
4. Copy the Client ID and Client Secret

### 2. Configure Environment Variables

Add to your `.env` file:

```bash
# Application URLs
APP_URL=https://your-app-domain.com  # or http://localhost:3000 for dev
FRONTEND_URL=https://your-frontend-domain.com  # or http://localhost:2211 for dev

# Integration Security
INTEGRATION_ENCRYPTION_KEY=your_32_byte_hex_key_here

# Linear OAuth
LINEAR_CLIENT_ID=your_linear_client_id
LINEAR_CLIENT_SECRET=your_linear_client_secret
```

**Important**: Generate a secure 32-byte hex encryption key:
```bash
openssl rand -hex 32
```

### 3. Run Database Migrations

The Linear integration requires the following tables:
- `Integration` - Stores connection info and encrypted tokens
- `IntegrationOAuthState` - Temporary OAuth state for CSRF protection

```bash
pnpm nx migrate-run core
```

## OAuth Flow

### User-Initiated Connection

1. User clicks "Connect Linear" in the UI
2. Frontend calls `GET /api/integrations/oauth/linear/init`
3. Backend:
   - Generates random state token (CSRF protection)
   - Stores state in `IntegrationOAuthState` table with 10-minute TTL
   - Builds Linear OAuth URL with client ID, scopes, and state
   - Redirects user to Linear

4. User approves in Linear
5. Linear redirects to `GET /api/integrations/oauth/linear/callback?code=xxx&state=yyy`
6. Backend:
   - Verifies state matches what's in database
   - Exchanges authorization code for access token
   - Fetches Linear user/workspace info
   - Encrypts and stores access token in `Integration` table
   - **Automatically registers webhook** with Linear
   - Publishes `IntegrationConnectedEvent` to RabbitMQ
   - Redirects user back to frontend with success

7. Linea domain receives `IntegrationConnectedEvent` and triggers onboarding

### OAuth Scopes

Launchline requests the following Linear scopes:

- `read` - Read issues, projects, teams, users
- `write` - Update issues, add comments
- `issues:create` - Create new issues
- `comments:create` - Add comments to issues

### Token Storage

Access tokens are encrypted using **AES-256-GCM** before storage:

```typescript
encrypt(token: string): string {
  // IV (16 bytes) + Auth Tag (16 bytes) + Ciphertext
  return `${iv}:${authTag}:${encrypted}`;
}
```

The encryption key must be:
- Exactly 32 bytes (256 bits)
- Stored securely in environment variable
- Never committed to version control
- Rotated periodically in production

## Webhook Registration

### Automatic Setup

When OAuth completes, Launchline automatically:

1. Calls Linear GraphQL API to create a webhook:
   ```graphql
   mutation CreateWebhook {
     webhookCreate(input: {
       url: "https://your-app.com/api/integrations/webhooks/linear"
       resourceTypes: ["Issue", "Comment", "Project", "Cycle", "IssueLabel"]
     }) {
       success
       webhook { id url enabled }
     }
   }
   ```

2. Stores webhook URL and secret in `Integration` table
3. Linear will send webhooks to this endpoint for all subscribed events

### Webhook Endpoint

- **URL**: `POST /api/integrations/webhooks/linear`
- **Headers**: 
  - `linear-signature`: HMAC-SHA256 signature of request body
  - `linear-delivery`: Unique delivery ID
- **Body**: JSON payload with event data

### Subscribed Events

Launchline receives webhooks for:

- **Issue** events: create, update, delete
- **Comment** events: create, update, delete
- **Project** events: create, update
- **Cycle** events: create, update
- **IssueLabel** events: create, update

## Webhook Processing

### 1. Reception

```
Linear sends webhook
  ↓
POST /api/integrations/webhooks/linear
  ↓
Controller verifies HMAC signature
  ↓
Publishes IntegrationWebhookReceivedEvent to RabbitMQ
  ↓
Returns 200 OK immediately (webhook is processed async)
```

### 2. Async Processing

```
IntegrationQueue consumes IntegrationWebhookReceivedEvent
  ↓
Routes to LineaFacade.processWebhook()
  ↓
Linea Ingestion Graph normalizes webhook
  ↓
Linea Classification Graph analyzes event
  ↓
Creates/updates memories in graph
  ↓
Linea Inbox Graph generates actionable items
  ↓
Creates inbox threads for detected blockers/drift
```

### 3. Signature Verification

Webhooks are verified using HMAC-SHA256:

```typescript
const expectedSignature = createHmac('sha256', webhookSecret)
  .update(rawBody)
  .digest('hex');

if (signature !== expectedSignature) {
  throw new BadRequestException('Invalid signature');
}
```

**Why this matters**:
- Prevents webhook spoofing
- Ensures webhooks actually come from Linear
- Protects against replay attacks

### 4. Webhook Payload Example

**Issue Created**:
```json
{
  "action": "create",
  "type": "Issue",
  "data": {
    "id": "ISS-123",
    "title": "Fix login bug",
    "description": "Users can't log in with Google",
    "state": {
      "id": "state-123",
      "name": "In Progress",
      "type": "started"
    },
    "team": {
      "id": "team-456",
      "name": "Engineering"
    },
    "assignee": {
      "id": "user-789",
      "name": "John Doe"
    },
    "priority": 1,
    "createdAt": "2024-01-28T12:00:00Z",
    "updatedAt": "2024-01-28T12:00:00Z"
  },
  "url": "https://linear.app/team/issue/ISS-123",
  "organizationId": "org-abc",
  "webhookTimestamp": 1706443200
}
```

**Issue Updated**:
```json
{
  "action": "update",
  "type": "Issue",
  "data": { /* same as above */ },
  "updatedFrom": {
    "state": {
      "id": "state-000",
      "name": "Todo"
    }
  }
}
```

## Onboarding

### Initial Data Import

When a Linear integration is connected, Launchline:

1. Receives `IntegrationConnectedEvent`
2. Triggers `OnboardingGraphsFactory.runLinearOnboarding()`
3. Fetches all Linear data using the SDK:
   - Teams
   - Projects
   - Active cycles
   - All issues (paginated)
   - Issue labels
   - Team members

4. Creates memories for each entity
5. Analyzes for blockers and stale work
6. Generates initial inbox items

### Onboarding Graph

The onboarding process:

```typescript
async runLinearOnboarding(
  ctx: GraphContext,
  accessToken: string,
  teamId?: string
): Promise<OnboardingResult> {
  // 1. Initialize Linear SDK client
  const client = new LinearClient({ accessToken });
  
  // 2. Fetch organization info
  const org = await client.organization();
  
  // 3. Fetch all teams (or specific team)
  const teams = teamId 
    ? [await client.team(teamId)]
    : await client.teams();
  
  // 4. For each team:
  for (const team of teams) {
    // Fetch projects
    const projects = await team.projects();
    
    // Fetch active cycle
    const cycle = await team.currentCycle();
    
    // Fetch all issues
    const issues = await team.issues();
    
    // Create memories
    await createTeamMemory(team);
    await createProjectMemories(projects);
    await createIssueMemories(issues);
    
    // Detect blockers
    const blockers = detectBlockedIssues(issues);
    
    // Detect stale work
    const stale = detectStaleIssues(issues);
  }
  
  // 5. Generate inbox candidates
  return {
    memoriesCreated: [...],
    inboxCandidates: [...],
    errors: [...]
  };
}
```

### What Gets Imported

**Team Memory**:
- Team ID, name, description
- Team members
- Current cycle
- Default workflow states

**Project Memory**:
- Project ID, name, description
- Target date
- Progress status
- Associated team

**Issue Memory**:
- Issue ID, title, description
- Current state and workflow
- Assignee
- Priority
- Labels
- Created/updated timestamps
- Related issues (parent, children, blocked by)

**Cycle Memory**:
- Cycle ID, name
- Start and end dates
- Scope (planned issues)
- Progress

## Using the Linear SDK

Launchline uses the official `@linear/sdk` for all Linear API interactions.

### SDK Initialization

```typescript
import { LinearClient } from '@linear/sdk';

const accessToken = await integrationFacade.getAccessToken(integrationId);
const client = new LinearClient({ accessToken });
```

### Common Operations

**Fetch Issues**:
```typescript
const issues = await client.issues({
  filter: {
    state: { type: { in: ['started', 'unstarted'] } }
  }
});
```

**Create Issue**:
```typescript
const issue = await client.createIssue({
  teamId: 'team-123',
  title: 'New issue from Launchline',
  description: 'Created via suggested action',
  priority: 1
});
```

**Add Comment**:
```typescript
const comment = await client.createComment({
  issueId: 'issue-456',
  body: 'Update from Launchline: ...'
});
```

**Update Issue**:
```typescript
await client.updateIssue('issue-456', {
  stateId: 'state-in-progress',
  priority: 2
});
```

## Blocker Detection

### What Qualifies as a Blocker?

An issue is considered blocked if:

1. **State is "Blocked"** (workflow state type)
2. **Has "blocked by" relationship** with unresolved issue
3. **Mentioned "blocker" in recent comment** (keyword detection)
4. **No updates for 5+ days** with assignee assigned

### Detection Logic

```typescript
function detectBlockers(issues: Issue[]): Blocker[] {
  const blockers = [];
  
  for (const issue of issues) {
    // Check workflow state
    if (issue.state.type === 'blocked') {
      blockers.push({
        issueId: issue.id,
        reason: `Issue is in "${issue.state.name}" state`,
        confidence: 1.0
      });
    }
    
    // Check relationships
    if (issue.relations.some(r => r.type === 'blocks')) {
      const blockingIssues = issue.relations
        .filter(r => r.type === 'blocks' && !r.relatedIssue.state.completed)
        .map(r => r.relatedIssue);
      
      blockers.push({
        issueId: issue.id,
        reason: `Blocked by ${blockingIssues.length} unresolved issues`,
        blockingIssues,
        confidence: 0.9
      });
    }
    
    // Check for staleness
    const daysSinceUpdate = daysBetween(issue.updatedAt, now());
    if (daysSinceUpdate > 5 && issue.assignee && !issue.state.completed) {
      blockers.push({
        issueId: issue.id,
        reason: `No updates for ${daysSinceUpdate} days`,
        confidence: 0.7
      });
    }
  }
  
  return blockers;
}
```

## Inbox Item Generation

### Blocker Inbox Item

```json
{
  "type": "blocker",
  "priority": "high",
  "title": "ISS-123: API design blocking 3 issues",
  "summary": "Issue ISS-123 'Design auth API' has been blocked for 8 days. It's blocking ISS-456, ISS-789, and ISS-101. The team discussed two approaches in #eng-api but no decision was made.",
  "suggestedActions": [
    "Schedule 30-min decision sync with eng team",
    "Comment on ISS-123 asking for decision by EOD Friday",
    "Create spike issue to prototype both approaches"
  ],
  "confidence": 0.95,
  "sourceMemoryIds": ["mem-iss-123", "mem-decision-234"],
  "entityRefs": {
    "ticketIds": ["ISS-123", "ISS-456", "ISS-789", "ISS-101"],
    "teamIds": ["team-eng"]
  }
}
```

### Priority Drift Inbox Item

```json
{
  "type": "priority_drift",
  "priority": "medium",
  "title": "3 P0 issues in backlog state",
  "summary": "Issues ISS-555, ISS-666, ISS-777 are marked priority 0 (urgent) but haven't been started. They've been in backlog for 4, 6, and 8 days respectively.",
  "suggestedActions": [
    "Lower priority to P1 or P2 if not actually urgent",
    "Assign to team members and move to 'Todo'",
    "Add to current sprint if capacity allows"
  ],
  "confidence": 0.85,
  "sourceMemoryIds": ["mem-iss-555", "mem-iss-666", "mem-iss-777"]
}
```

## Error Handling

### OAuth Errors

- **Invalid state**: User gets error message, OAuth is rejected
- **Token exchange failure**: User sees error, can retry connection
- **Webhook registration failure**: Logged but doesn't fail OAuth (can retry later)

### Webhook Errors

- **Invalid signature**: Webhook is rejected with 400 Bad Request
- **Processing error**: Webhook is acknowledged (200 OK) but message is requeued for retry
- **No integration found**: Webhook is acknowledged but logged as warning

### Onboarding Errors

- **API rate limit**: Onboarding pauses and retries with backoff
- **Partial failure**: Some teams/issues imported, errors logged
- **Complete failure**: Event is requeued, will retry

## Monitoring

### Logs to Watch

```
[IntegrationService] Started OAuth flow for linear integration
[IntegrationService] Created integration {id} for workspace {workspaceId}
[IntegrationService] Successfully registered Linear webhook
[IntegrationController] Received Linear webhook: {deliveryId}
[IntegrationQueue] Processing webhook for linear integration {integrationId}
[LineaFacade] Processing linear/Issue.update for workspace {workspaceId}
[LineaFacade] Normalized 1 events
[LineaFacade] Created 2 memories
[LineaFacade] Generated 1 inbox items
```

### Metrics to Track

- OAuth success rate
- Webhook delivery rate
- Webhook processing time
- Onboarding duration
- Inbox item accuracy (user feedback)

## Troubleshooting

### Webhooks Not Arriving

1. Check Linear webhook settings: https://linear.app/settings/api/webhooks
2. Verify webhook URL is publicly accessible
3. Check server logs for signature verification failures
4. Ensure RabbitMQ is running and accessible

### OAuth Fails

1. Verify `LINEAR_CLIENT_ID` and `LINEAR_CLIENT_SECRET` are correct
2. Check redirect URL matches what's configured in Linear
3. Ensure `APP_URL` is set correctly (must be HTTPS in production)
4. Check database connectivity for OAuth state storage

### Onboarding Takes Too Long

Linear onboarding can take several minutes for large workspaces:
- 100 issues: ~30 seconds
- 1,000 issues: ~5 minutes  
- 10,000 issues: ~30 minutes

Consider:
- Implementing pagination limits
- Running onboarding in background job
- Showing progress UI to user

### Missing Inbox Items

If blockers aren't being detected:
1. Check classification graph logs
2. Verify Linear webhook payloads include expected fields
3. Adjust blocker detection rules if needed
4. Ensure memory search is returning relevant context

## Future Improvements

### Planned Features

- [ ] Bidirectional sync (update Linear from Launchline)
- [ ] Custom blocker rules per team
- [ ] Linear project status tracking
- [ ] Cycle burndown analysis
- [ ] Estimate vs. actual tracking
- [ ] SLA violation detection
- [ ] Team capacity modeling

### SDK Enhancements

- [ ] Batch operations for performance
- [ ] Webhook replay for failed processing
- [ ] Delta sync (only fetch changes since last sync)
- [ ] Custom field support
- [ ] Attachment handling
