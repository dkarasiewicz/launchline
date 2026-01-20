import { z } from 'zod';

export interface GraphContext {
  workspaceId: string;
  userId: string;
  threadId?: string;
  correlationId: string; // For tracing
}

export type SourceType = 'github' | 'linear' | 'slack';

export type EntityType =
  | 'pr'
  | 'issue'
  | 'ticket'
  | 'message'
  | 'commit'
  | 'review'
  | 'comment'
  | 'thread';

export interface RawEvent {
  id: string;
  workspaceId: string;
  source: SourceType;
  eventType: string;
  payload: Record<string, unknown>;
  timestamp: Date;
  receivedAt: Date;
}

export interface NormalizedEvent {
  id: string;
  workspaceId: string;
  source: SourceType;
  eventType: string;
  entityId: string;
  entityType: EntityType;
  title: string;
  description: string;
  status?: string;
  assignee?: string;
  metadata: Record<string, unknown>;
  timestamp: Date;
  postgresId?: string;
}

export type MemoryNamespace =
  // Organization-level
  | 'workspace' // Workspace-wide settings, preferences
  | 'company' // Company info, goals, values
  | 'team' // Team structure, members, roles
  | 'user' // Individual user preferences, patterns
  // Product & Project
  | 'product' // Product areas, features, roadmap
  | 'project' // Projects, milestones, timelines
  | 'milestone' // Specific milestones, deadlines
  // Work Items
  | 'ticket' // Linear tickets, issues
  | 'epic' // Epics, large initiatives
  | 'blocker' // Blockers, dependencies
  | 'decision' // Decisions made, rationale
  // Code & Development
  | 'pr' // Pull requests, reviews
  | 'commit' // Significant commits, changes
  | 'codebase' // Code patterns, architecture
  | 'tech_debt' // Technical debt items
  | 'coding_insight' // Coding preferences, patterns per user
  // Communication
  | 'slack_thread' // Slack thread summaries
  | 'discussion' // General discussions
  | 'standup' // Standup notes
  | 'meeting' // Meeting notes, action items
  // Analytics & Patterns
  | 'pattern' // Detected patterns (e.g., recurring blockers)
  | 'metric' // Tracked metrics
  | 'retrospective' // Retro insights
  // Identity & Linking
  | 'identity'; // Cross-platform account linking (GitHub ↔ Slack ↔ Linear)

export type MemoryCategory =
  | 'blocker'
  | 'decision'
  | 'progress'
  | 'dependency'
  | 'discussion'
  | 'assignment'
  | 'insight'
  | 'risk'
  | 'achievement';

export interface MemoryItem {
  id: string;
  workspaceId: string;
  namespace: MemoryNamespace;
  category: MemoryCategory;

  // Content
  content: string;
  summary: string;
  embedding?: number[];

  // Relationships
  sourceEventIds: string[];
  relatedEntityIds: string[];
  relatedMemoryIds: string[];

  // Metadata
  importance: number; // 0-1 score
  confidence: number; // 0-1 confidence in classification

  // Entity references (for scoping searches)
  entityRefs: {
    teamIds?: string[];
    userIds?: string[];
    projectIds?: string[];
    ticketIds?: string[];
    prIds?: string[];
  };

  // Lifecycle
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
  archivedAt?: Date;
}

export interface MemorySearchQuery {
  workspaceId: string;
  namespaces?: MemoryNamespace[];
  categories?: MemoryCategory[];
  query?: string; // Semantic search
  entityRefs?: {
    teamIds?: string[];
    userIds?: string[];
    projectIds?: string[];
  };
  minImportance?: number;
  limit?: number;
  includeArchived?: boolean;
}

export interface LinkedIdentity {
  id: string;
  workspaceId: string;

  // Primary display info
  displayName: string;
  email?: string;
  avatarUrl?: string;

  // Platform-specific accounts
  accounts: {
    github?: {
      id: number;
      login: string;
      name?: string;
      email?: string;
    };
    linear?: {
      id: string;
      name: string;
      email?: string;
      displayName?: string;
    };
    slack?: {
      id: string;
      name: string;
      realName: string;
      displayName?: string;
      email?: string;
    };
  };

  // Metadata
  role?: string;
  title?: string;
  isAdmin?: boolean;

  // Linking confidence (auto-linked vs manually confirmed)
  linkingMethod: 'email' | 'name_match' | 'manual' | 'inferred';
  confidence: number; // 0-1

  createdAt: Date;
  updatedAt: Date;
}

export const InboxItemTypeSchema = z.enum([
  'blocker',
  'drift',
  'update',
  'coverage',
  'risk',
  'action_required',
]);

export const InboxPrioritySchema = z.enum([
  'critical',
  'high',
  'medium',
  'low',
]);

export const InboxStatusSchema = z.enum([
  'pending',
  'in_progress',
  'actioned',
  'dismissed',
  'auto_resolved',
]);

export type InboxItemType = z.infer<typeof InboxItemTypeSchema>;
export type InboxPriority = z.infer<typeof InboxPrioritySchema>;
export type InboxStatus = z.infer<typeof InboxStatusSchema>;

export interface InboxItemCandidate {
  id: string;
  workspaceId: string;
  type: InboxItemType;
  priority: InboxPriority;
  title: string;
  summary: string;
  confidence: number;
  sourceMemoryIds: string[];
  suggestedActions: string[];
  requiresApproval: boolean;

  // Context
  entityRefs: {
    ticketIds?: string[];
    prIds?: string[];
    userIds?: string[];
    teamIds?: string[];
  };

  // Lifecycle
  createdAt: Date;
  expiresAt?: Date;
}

export interface InboxItem extends InboxItemCandidate {
  status: InboxStatus;
  assignedTo?: string;
  actionedBy?: string;
  actionedAt?: Date;
  actionNotes?: string;
}

export interface SignalContext {
  signalId: string;
  workspaceId: string;
  source: SourceType;
  eventType: string;
  timestamp: Date;

  entity: {
    id: string;
    type: EntityType;
    title: string;
    description: string;
    status: string;
    url?: string;
  };

  teamContext: {
    teamId?: string;
    teamName?: string;
    productArea?: string;
    projectId?: string;
  };

  prContext?: {
    filesChanged: number;
    additions: number;
    deletions: number;
    reviewers: string[];
    labels: string[];
    isMerged: boolean;
    isDraft: boolean;
    ciStatus?: 'passing' | 'failing' | 'pending' | 'unknown';
    patterns: {
      hasTests: boolean;
      touchesConfig: boolean;
      touchesInfra: boolean;
      touchesApi: boolean;
      hasBreakingChange: boolean;
      hasSecurityRelevant: boolean;
      hasDependencyUpdate: boolean;
    };
  };

  ticketContext?: {
    priority: number;
    labels: string[];
    estimate?: number;
    cycleId?: string;
    parentId?: string;
  };

  references: {
    mentionedUsers: string[];
    linkedIssues: string[];
    linkedPRs: string[];
    blockerMentions: string[];
    decisionMentions: string[];
  };

  rawText: {
    title: string;
    body: string;
    comments?: string[];
  };
}

export interface RelatedItems {
  sameEntity: MemoryItem[];
  linkedEntities: MemoryItem[];
  sameContext: MemoryItem[];
  recentBlockers: MemoryItem[];
  recentDecisions: MemoryItem[];
}

export type ThreadStatusType = 'regular' | 'archived';

export type MessageRoleType = 'user' | 'assistant' | 'system';

export interface MessageDto {
  id: string;
  role: MessageRoleType;
  content: string;
  createdAt?: Date;
}

export interface ThreadDto {
  remoteId: string;
  status: ThreadStatusType;
  title?: string;
}

export interface ThreadListResponseDto {
  threads: ThreadDto[];
}

export interface StoredThread {
  id: string;
  workspaceId: string;
  userId: string;
  title?: string;
  archived: boolean;
  createdAt: string; // ISO string for serialization
  updatedAt: string;
  [key: string]: unknown; // Index signature for store compatibility
}

// Store item type for BaseStore results
export interface StoreItem {
  key?: string;
  value?: Record<string, unknown>;
}

export interface ProcessWebhookInput {
  workspaceId: string;
  userId: string;
  source: SourceType;
  eventType: string;
  payload: Record<string, unknown>;
}

export interface ProcessWebhookResult {
  normalizedEvents: NormalizedEvent[];
  memoriesCreated: MemoryItem[];
  inboxItems: InboxItemCandidate[];
}

export const ToolMemoryNamespaceSchema = z.enum([
  'blocker',
  'decision',
  'progress',
  'ticket',
  'pr',
  'team',
  'project',
  'milestone',
  'epic',
  'slack_thread',
  'coding_insight',
  'discussion',
  'pattern',
  'codebase',
  'identity',
]);

export const ToolMemoryCategorySchema = z.enum([
  'blocker',
  'decision',
  'progress',
  'dependency',
  'discussion',
  'assignment',
  'insight',
  'risk',
  'achievement',
]);

export const SearchMemoriesInputSchema = z.object({
  query: z.string().min(1).describe('Search query to find relevant memories'),
  namespace: ToolMemoryNamespaceSchema.optional().describe(
    'Filter by memory namespace',
  ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .default(10)
    .describe('Maximum results to return'),
});

export const SaveMemoryInputSchema = z.object({
  content: z.string().min(1).describe('Full content of the memory'),
  summary: z.string().min(1).describe('Brief summary for quick reference'),
  namespace: ToolMemoryNamespaceSchema.describe('Memory namespace'),
  category: ToolMemoryCategorySchema.describe('Memory category'),
  importance: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .default(0.5)
    .describe('Importance score 0-1'),
  entityId: z.string().optional().describe('Related entity ID'),
});

export const GetBlockersInputSchema = z.object({
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .default(10)
    .describe('Maximum blockers to return'),
  includeResolved: z
    .boolean()
    .optional()
    .default(false)
    .describe('Include resolved blockers'),
});

export const GetDecisionsInputSchema = z.object({
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .default(10)
    .describe('Maximum decisions to return'),
});

export const ResolveIdentityInputSchema = z.object({
  name: z.string().min(1).describe('Name or username to search for'),
  platform: z
    .enum(['github', 'linear', 'slack', 'any'])
    .optional()
    .default('any')
    .describe('Filter by platform'),
});

export const GetInboxItemsInputSchema = z.object({
  type: z
    .enum(['blocker', 'drift', 'update', 'coverage', 'risk', 'action_required'])
    .optional()
    .describe('Filter by inbox item type'),
  priority: z
    .enum(['critical', 'high', 'medium', 'low'])
    .optional()
    .describe('Filter by priority'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .default(10)
    .describe('Maximum items to return'),
});

export const GetWorkspaceStatusInputSchema = z.object({
  includeMetrics: z
    .boolean()
    .optional()
    .default(false)
    .describe('Include detailed metrics breakdown'),
});

export const UpdateLinearTicketInputSchema = z.object({
  ticketId: z.string().min(1).describe('Linear ticket ID'),
  status: z
    .enum(['backlog', 'todo', 'in_progress', 'done', 'cancelled'])
    .optional()
    .describe('New status'),
  priority: z.number().int().min(0).max(4).optional().describe('Priority 0-4'),
  assigneeId: z.string().optional().describe('Assignee user ID'),
  comment: z.string().optional().describe('Comment to add'),
});

export const SendSlackMessageInputSchema = z.object({
  channel: z.string().min(1).describe('Slack channel ID or name'),
  message: z.string().min(1).describe('Message content'),
  threadTs: z.string().optional().describe('Thread timestamp for replies'),
});

export const CreateGitHubIssueInputSchema = z.object({
  repo: z.string().min(1).describe('Repository name (owner/repo)'),
  title: z.string().min(1).describe('Issue title'),
  body: z.string().optional().describe('Issue body/description'),
  labels: z.array(z.string()).optional().describe('Labels to apply'),
});

export const InternetSearchInputSchema = z.object({
  query: z.string().min(1).describe('Search query'),
  maxResults: z
    .number()
    .int()
    .min(1)
    .max(10)
    .optional()
    .default(5)
    .describe('Maximum results'),
});

export const ThinkInputSchema = z.object({
  thought: z
    .string()
    .min(1)
    .describe('The thought or reasoning to record (not shown to user)'),
});

export type SearchMemoriesInput = z.infer<typeof SearchMemoriesInputSchema>;
export type SaveMemoryInput = z.infer<typeof SaveMemoryInputSchema>;
export type GetBlockersInput = z.infer<typeof GetBlockersInputSchema>;
export type GetDecisionsInput = z.infer<typeof GetDecisionsInputSchema>;
export type ResolveIdentityInput = z.infer<typeof ResolveIdentityInputSchema>;
export type GetInboxItemsInput = z.infer<typeof GetInboxItemsInputSchema>;
export type GetWorkspaceStatusInput = z.infer<
  typeof GetWorkspaceStatusInputSchema
>;
export type UpdateLinearTicketInput = z.infer<
  typeof UpdateLinearTicketInputSchema
>;
export type SendSlackMessageInput = z.infer<typeof SendSlackMessageInputSchema>;
export type CreateGitHubIssueInput = z.infer<
  typeof CreateGitHubIssueInputSchema
>;
export type InternetSearchInput = z.infer<typeof InternetSearchInputSchema>;
export type ThinkInput = z.infer<typeof ThinkInputSchema>;

export const LLMObservationSchema = z.object({
  type: z
    .enum([
      'team_dynamic',
      'workflow_insight',
      'risk',
      'recommendation',
      'pattern',
    ])
    .describe('Type of observation'),
  title: z.string().describe('Short title for the observation'),
  observation: z.string().describe('Detailed observation content'),
  importance: z.number().min(0).max(1).describe('Importance score 0-1'),
  relatedEntities: z
    .array(z.string())
    .optional()
    .describe('Related entity IDs'),
});

/**
 * Schema for multiple LLM observations
 */
export const LLMObservationsSchema = z.object({
  observations: z
    .array(LLMObservationSchema)
    .describe('List of observations from analysis'),
});

export const BlockerAnalysisSchema = z.object({
  isBlocker: z.boolean().describe('Whether this signal indicates a blocker'),
  blockerType: z
    .enum([
      'external_dependency',
      'internal_dependency',
      'technical',
      'resource',
      'unclear_requirements',
    ])
    .nullable()
    .describe('Type of blocker if isBlocker is true'),
  confidence: z.number().min(0).max(1).describe('Confidence score 0-1'),
  evidence: z
    .array(z.string())
    .describe('Direct quotes or references supporting the classification'),
  affectedEntities: z
    .array(z.string())
    .describe('IDs of affected tickets, PRs, or other entities'),
});

export const DriftAnalysisSchema = z.object({
  hasDrift: z.boolean().describe('Whether priority or scope drift is detected'),
  driftType: z
    .enum(['scope_creep', 'priority_change', 'reassignment', 'stale'])
    .nullable()
    .describe('Type of drift if detected'),
  previousState: z.string().nullable().describe('Previous state before drift'),
  currentState: z.string().nullable().describe('Current state after drift'),
  evidence: z.array(z.string()).describe('Evidence of drift'),
});

export const UpdateAnalysisSchema = z.object({
  isSignificant: z
    .boolean()
    .describe('Whether this update is significant enough to notify'),
  category: z
    .enum(['progress', 'decision', 'milestone', 'risk', 'routine'])
    .describe('Category of update'),
  shouldNotify: z.boolean().describe('Whether to send notifications'),
  suggestedRecipients: z
    .array(z.string())
    .describe('User IDs who should be notified'),
});

export const QualityConcernSchema = z.object({
  type: z
    .enum([
      'no_tests',
      'breaking_change',
      'security',
      'performance',
      'architecture',
      'style',
    ])
    .describe('Type of quality concern'),
  severity: z.enum(['low', 'medium', 'high']).describe('Severity level'),
  evidence: z.string().describe('Evidence supporting the concern'),
});

export const QualityAnalysisSchema = z.object({
  concerns: z.array(QualityConcernSchema).describe('List of quality concerns'),
  techDebtIndicators: z
    .array(z.string())
    .describe('Technical debt indicators found'),
});

export const MemoryCategorySchema = z.enum([
  'blocker',
  'decision',
  'progress',
  'dependency',
  'discussion',
  'assignment',
  'insight',
  'risk',
  'achievement',
]);

export const SuggestedActionSchema = z.object({
  action: z.string().describe('Description of suggested action'),
  priority: z
    .enum(['immediate', 'soon', 'later'])
    .describe('Priority of action'),
  requiresApproval: z.boolean().describe('Whether PM approval is needed'),
});

export const ClassificationSchema = z.object({
  primaryCategory: MemoryCategorySchema.describe(
    'Primary classification category',
  ),
  secondaryCategories: z
    .array(MemoryCategorySchema)
    .describe('Additional applicable categories'),
  importance: z.number().min(0).max(1).describe('Importance score 0-1'),
  suggestedActions: z
    .array(SuggestedActionSchema)
    .describe('Suggested follow-up actions'),
});

export const MemoryNamespaceSchema = z.enum([
  'workspace', // Workspace-wide settings, preferences
  'company', // Company info, goals, values
  'team', // Team structure, members, roles
  'user', // Individual user preferences, patterns
  // Product & Project
  'product', // Product areas, features, roadmap
  'project', // Projects, milestones, timelines
  'milestone', // Specific milestones, deadlines
  // Work Items
  'ticket', // Linear tickets, issues
  'epic', // Epics, large initiatives
  'blocker', // Blockers, dependencies
  'decision', // Decisions made, rationale
  // Code & Development
  'pr', // Pull requests, reviews
  'commit', // Significant commits, changes
  'codebase', // Code patterns, architecture
  'tech_debt', // Technical debt items
  'coding_insight', // Coding preferences, patterns per user
  // Communication
  'slack_thread', // Slack thread summaries
  'discussion', // General discussions
  'standup', // Standup notes
  'meeting', // Meeting notes, action items
  // Analytics & Patterns
  'pattern', // Detected patterns (e.g., recurring blockers)
  'metric', // Tracked metrics
  'retrospective', // Retro insights
  // Identity & Linking
  'identity', // Cross-platform account linking (GitHub ↔ Slack ↔ Linear)
]);

export const EntityRefsSchema = z.object({
  teamIds: z.array(z.string()).optional().describe('Related team IDs'),
  userIds: z.array(z.string()).optional().describe('Related user IDs'),
  projectIds: z.array(z.string()).optional().describe('Related project IDs'),
  ticketIds: z.array(z.string()).optional().describe('Related ticket IDs'),
  prIds: z.array(z.string()).optional().describe('Related PR IDs'),
});

export const MemoryItemInputSchema = z.object({
  namespace: MemoryNamespaceSchema.describe('Memory namespace'),
  category: MemoryCategorySchema.describe('Memory category'),
  content: z.string().min(1).describe('Memory content'),
  summary: z.string().min(1).describe('Short summary'),
  importance: z.number().min(0).max(1).describe('Importance score 0-1'),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe('Classification confidence 0-1'),
  sourceEventIds: z.array(z.string()).describe('Source event IDs'),
  relatedEntityIds: z.array(z.string()).describe('Related entity IDs'),
  relatedMemoryIds: z.array(z.string()).describe('Related memory IDs'),
  entityRefs: EntityRefsSchema.describe('Entity references for scoping'),
  expiresAt: z.date().optional().describe('Optional expiration date'),
});

export const MemorySuggestionSchema = z.object({
  type: z.enum(['save', 'update', 'archive']).describe('Memory operation type'),
  namespace: MemoryNamespaceSchema.describe('Target namespace for memory'),
  category: MemoryCategorySchema.describe('Memory category'),
  content: z.string().describe('Content to store'),
  importance: z.number().min(0).max(1).describe('Importance score'),
});

export const ClassificationReasoningSchema = z.object({
  blockerAnalysis: BlockerAnalysisSchema,
  driftAnalysis: DriftAnalysisSchema,
  updateAnalysis: UpdateAnalysisSchema,
  qualityAnalysis: QualityAnalysisSchema.nullable().describe(
    'Quality analysis for PRs, null for non-PR signals',
  ),
  classification: ClassificationSchema,
  memorySuggestions: z
    .array(MemorySuggestionSchema)
    .describe('Suggested memory operations'),
});

export type LLMObservation = z.infer<typeof LLMObservationSchema>;
export type LLMObservations = z.infer<typeof LLMObservationsSchema>;
export type BlockerAnalysis = z.infer<typeof BlockerAnalysisSchema>;
export type DriftAnalysis = z.infer<typeof DriftAnalysisSchema>;
export type UpdateAnalysis = z.infer<typeof UpdateAnalysisSchema>;
export type QualityConcern = z.infer<typeof QualityConcernSchema>;
export type QualityAnalysis = z.infer<typeof QualityAnalysisSchema>;
export type SuggestedAction = z.infer<typeof SuggestedActionSchema>;
export type Classification = z.infer<typeof ClassificationSchema>;
export type MemorySuggestion = z.infer<typeof MemorySuggestionSchema>;
export type EntityRefs = z.infer<typeof EntityRefsSchema>;
export type MemoryItemInput = z.infer<typeof MemoryItemInputSchema>;

export type ClassificationReasoning = z.infer<
  typeof ClassificationReasoningSchema
>;
