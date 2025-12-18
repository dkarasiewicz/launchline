import {
  pgTable,
  uniqueIndex,
  index,
  foreignKey,
  text,
  timestamp,
  boolean,
  integer,
  pgEnum,
} from 'drizzle-orm/pg-core';

export const userRole = pgEnum('UserRole', [
  'ADMIN',
  'WORKSPACE_MEMBER',
  'WORKSPACE_ADMIN',
]);
export const workspaceMembershipRole = pgEnum('WorkspaceMembershipRole', [
  'MEMBER',
  'ADMIN',
]);
export const workspaceMembershipStatus = pgEnum('WorkspaceMembershipStatus', [
  'INVITED',
  'ACTIVE',
  'INACTIVE',
  'EXPIRED',
  'REVOKED',
]);
export const notificationEntityType = pgEnum('NotificationEntityType', [
  'USER',
  'SYSTEM',
]);
export const notificationPriority = pgEnum('NotificationPriority', [
  'LOW',
  'MEDIUM',
  'HIGH',
  'URGENT',
]);

export const user = pgTable(
  'User',
  {
    id: text().primaryKey().notNull(),
    createdAt: timestamp({ precision: 3 }).defaultNow().notNull(),
    updatedAt: timestamp({ precision: 3 }).notNull(),
    email: text(),
    isEmailVerified: boolean().default(false).notNull(),
    isOnboardingComplete: boolean().default(false).notNull(),
    role: userRole().default('WORKSPACE_ADMIN').notNull(),
    fullName: text(),
  },
  (table) => [index('User_email_idx').using('btree', table.email.nullsLast())],
);

export const otp = pgTable(
  'Otp',
  {
    id: text().primaryKey().notNull(),
    createdAt: timestamp({ precision: 3 }).defaultNow().notNull(),
    updatedAt: timestamp({ precision: 3 }).notNull(),
    code: text().notNull(),
    identifier: text().notNull(),
    expiresAt: timestamp({ precision: 3 }).notNull(),
    isVerified: boolean().default(false).notNull(),
    userId: text(),
    attemptCount: integer().default(0).notNull(),
  },
  (table) => [
    index('Otp_identifier_isVerified_expiresAt_idx').using(
      'btree',
      table.identifier.asc().op('text_ops'),
      table.isVerified,
      table.expiresAt.asc().op('timestamp_ops'),
    ),
    index('Otp_expiresAt_idx').using(
      'btree',
      table.expiresAt.asc().nullsLast().op('timestamp_ops'),
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: 'Otp_userId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('set null'),
  ],
);

export const notification = pgTable(
  'Notification',
  {
    id: text().primaryKey().notNull(),
    createdAt: timestamp({ precision: 3 }).defaultNow().notNull(),
    updatedAt: timestamp({ precision: 3 }).notNull(),

    subject: text().notNull(),
    message: text().notNull(),
    entityId: text(),
    entityType: notificationEntityType().notNull(),
    priority: notificationPriority().default('MEDIUM').notNull(),

    userId: text().notNull(),
    readAt: timestamp({ precision: 3 }),

    actionUrl: text(),
    actionLabel: text(),
    icon: text(),
  },
  (table) => [
    index('Notification_userId_idx').using('btree', table.userId),
    index('Notification_entityType_idx').using('btree', table.entityType),
    index('Notification_entityId_idx').using('btree', table.entityId),
    index('Notification_readAt_idx').using('btree', table.readAt),
    index('Notification_createdAt_idx').using('btree', table.createdAt),
  ],
);

export const workspace = pgTable('Workspace', {
  id: text().primaryKey().notNull(),
  createdAt: timestamp({ precision: 3 }).defaultNow().notNull(),
  updatedAt: timestamp({ precision: 3 }).notNull(),

  name: text().notNull(),
  deactivatedAt: timestamp({ precision: 3 }),
});

export const workspaceMembership = pgTable(
  'WorkspaceMembership',
  {
    id: text().primaryKey().notNull(),
    createdAt: timestamp({ precision: 3 }).defaultNow().notNull(),
    updatedAt: timestamp({ precision: 3 }).notNull(),

    workspaceId: text().notNull(),
    userId: text().notNull(),
    role: workspaceMembershipRole().default('MEMBER').notNull(),
    status: workspaceMembershipStatus().default('INVITED').notNull(),
    email: text(),
    fullName: text(),
    deactivatedAt: timestamp({ precision: 3 }),
  },
  (table) => [
    uniqueIndex('WorkspaceMembership_workspace_user_unique').using(
      'btree',
      table.workspaceId.asc().nullsLast().op('text_ops'),
      table.userId.asc().nullsLast().op('text_ops'),
    ),
    foreignKey({
      columns: [table.workspaceId],
      foreignColumns: [workspace.id],
      name: 'WorkspaceMembership_workspaceId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('cascade'),
  ],
);

export const workspaceInvite = pgTable(
  'WorkspaceInvite',
  {
    id: text().primaryKey().notNull(),
    createdAt: timestamp({ precision: 3 }).defaultNow().notNull(),
    updatedAt: timestamp({ precision: 3 }).notNull(),
    createdByUserId: text().notNull(),

    token: text().notNull(),
    workspaceMembershipId: text().notNull(),

    expiresAt: timestamp({ precision: 3 }).notNull(),
    disabledAt: timestamp({ precision: 3 }),
    consumedAt: timestamp({ precision: 3 }),
  },
  (table) => [
    uniqueIndex('WorkspaceInvite_token_key').using(
      'btree',
      table.token.asc().nullsLast().op('text_ops'),
    ),
    index('WorkspaceInvite_expiresAt_idx').using(
      'btree',
      table.expiresAt.asc().nullsLast().op('timestamp_ops'),
    ),
    index('WorkspaceInvite_consumedAt_idx').using(
      'btree',
      table.consumedAt.asc().nullsLast().op('timestamp_ops'),
    ),
    foreignKey({
      columns: [table.workspaceMembershipId],
      foreignColumns: [workspaceMembership.id],
      name: 'WorkspaceInvite_workspaceMembershipId_fkey',
    })
      .onUpdate('cascade')
      .onDelete('cascade'),
  ],
);
