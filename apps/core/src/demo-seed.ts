import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { randomUUID } from 'crypto';
import { AppModule } from './app/app.module';
import { AssistantService } from '@launchline/core-linea';
import { MemoryService } from '@launchline/core-linea';
import { LineaJobsService } from '@launchline/core-linea';
import { AgentPromptService } from '@launchline/core-linea';
import type { InboxItemCandidate } from '@launchline/core-linea';

async function seed() {
  const workspaceId = process.env.DEMO_WORKSPACE_ID;
  const userId = process.env.DEMO_USER_ID;

  if (!workspaceId || !userId) {
    throw new Error(
      'DEMO_WORKSPACE_ID and DEMO_USER_ID must be set to seed demo data.',
    );
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const assistantService = app.get(AssistantService);
  const memoryService = app.get(MemoryService);
  const jobsService = app.get(LineaJobsService);
  const promptService = app.get(AgentPromptService);

  const ctx = {
    workspaceId,
    userId,
    correlationId: `demo-seed-${Date.now()}`,
  };

  await promptService.upsertWorkspacePrompt(
    workspaceId,
    `You are Linea, the always-on product copilot.
- Favor crisp, actionable updates.
- Keep status updates to 5 bullets max.
- Ask before sending external messages.`,
    userId,
  );

  await memoryService.saveMemory(ctx, {
    namespace: 'workspace',
    category: 'skill',
    summary: 'Launchline demo flow',
    content:
      'When presenting the demo, highlight the inbox triage, team graph, and autopilot jobs.',
    importance: 0.7,
    confidence: 0.9,
    sourceEventIds: [],
    relatedEntityIds: [],
    relatedMemoryIds: [],
    entityRefs: {},
  });

  await memoryService.saveMemory(ctx, {
    namespace: 'team',
    category: 'identity',
    summary: 'PM owner',
    content: JSON.stringify({ id: 'user:dawid', displayName: 'Dawid K.' }),
    importance: 0.8,
    confidence: 0.9,
    sourceEventIds: [],
    relatedEntityIds: [],
    relatedMemoryIds: [],
    entityRefs: { userIds: ['user:dawid'] },
  });

  await memoryService.saveMemory(ctx, {
    namespace: 'team',
    category: 'identity',
    summary: 'Eng lead',
    content: JSON.stringify({ id: 'user:alex', displayName: 'Alex M.' }),
    importance: 0.8,
    confidence: 0.9,
    sourceEventIds: [],
    relatedEntityIds: [],
    relatedMemoryIds: [],
    entityRefs: { userIds: ['user:alex'] },
  });

  const now = new Date();
  const candidates: InboxItemCandidate[] = [
    {
      id: `demo-${randomUUID()}`,
      workspaceId,
      type: 'blocker',
      priority: 'high',
      title: 'API spec review blocked by auth changes',
      summary:
        'Checkout changes need security sign-off before the new endpoint can be shipped.',
      confidence: 0.88,
      sourceMemoryIds: [],
      suggestedActions: [
        'Ping security owner for approval',
        'Create a contingency plan for release',
      ],
      requiresApproval: false,
      entityRefs: { ticketIds: ['LAU-42'], userIds: ['user:alex'] },
      createdAt: now,
    },
    {
      id: `demo-${randomUUID()}`,
      workspaceId,
      type: 'drift',
      priority: 'medium',
      title: 'Mobile onboarding scope expanded',
      summary:
        'Two extra flows were added mid-sprint. Recommend updating success criteria.',
      confidence: 0.74,
      sourceMemoryIds: [],
      suggestedActions: [
        'Confirm scope changes with design',
        'Update launch checklist',
      ],
      requiresApproval: false,
      entityRefs: { ticketIds: ['LAU-39'], userIds: ['user:dawid'] },
      createdAt: now,
    },
    {
      id: `demo-${randomUUID()}`,
      workspaceId,
      type: 'update',
      priority: 'low',
      title: 'Linear integration shipped',
      summary:
        'Webhook ingestion is live. Next: add auto-triage for priority issues.',
      confidence: 0.62,
      sourceMemoryIds: [],
      suggestedActions: ['Draft release note', 'Queue follow-up ticket'],
      requiresApproval: false,
      entityRefs: { ticketIds: ['LAU-34'] },
      createdAt: now,
    },
  ];

  for (const candidate of candidates) {
    await assistantService.createInboxThread(
      workspaceId,
      userId,
      candidate,
    );
  }

  await jobsService.ensureHeartbeat(workspaceId, userId);

  await app.close();
}

seed().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('[demo-seed] Failed to seed demo data:', error);
  process.exitCode = 1;
});
