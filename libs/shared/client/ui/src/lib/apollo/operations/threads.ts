import { gql } from '@apollo/client';

// ============================================================================
// Thread Queries
// ============================================================================

/**
 * List all threads for the current user
 */
export const THREADS_QUERY = gql`
  query Threads {
    threads {
      threads {
        remoteId
        status
        title
        createdAt
        updatedAt
        isInboxThread
        inboxItemType
        inboxPriority
        inboxStatus
        summary
        projectId
        featureId
      }
    }
  }
`;

/**
 * Get messages for a specific thread
 */
export const THREAD_MESSAGES_QUERY = gql`
  query ThreadMessages($threadId: String!) {
    threadMessages(threadId: $threadId) {
      messages {
        id
        role
        content
        createdAt
      }
    }
  }
`;

// ============================================================================
// Thread Mutations
// ============================================================================

/**
 * Initialize a new thread
 */
export const INITIALIZE_THREAD_MUTATION = gql`
  mutation InitializeThread($input: InitializeThreadInput!) {
    initializeThread(input: $input) {
      remoteId
      externalId
    }
  }
`;

/**
 * Rename a thread
 */
export const RENAME_THREAD_MUTATION = gql`
  mutation RenameThread($input: RenameThreadInput!) {
    renameThread(input: $input)
  }
`;

/**
 * Archive a thread
 */
export const ARCHIVE_THREAD_MUTATION = gql`
  mutation ArchiveThread($threadId: String!) {
    archiveThread(threadId: $threadId)
  }
`;

/**
 * Unarchive a thread
 */
export const UNARCHIVE_THREAD_MUTATION = gql`
  mutation UnarchiveThread($threadId: String!) {
    unarchiveThread(threadId: $threadId)
  }
`;

/**
 * Delete a thread
 */
export const DELETE_THREAD_MUTATION = gql`
  mutation DeleteThread($threadId: String!) {
    deleteThread(threadId: $threadId)
  }
`;

/**
 * Generate a title for a thread
 */
export const GENERATE_TITLE_MUTATION = gql`
  mutation GenerateThreadTitle($input: GenerateTitleInput!) {
    generateThreadTitle(input: $input)
  }
`;

/**
 * Append a message to a thread
 */
export const APPEND_MESSAGE_MUTATION = gql`
  mutation AppendMessage($input: AppendMessageInput!) {
    appendMessage(input: $input)
  }
`;

// ============================================================================
// Thread Queries (as strings for fetch-based client)
// ============================================================================

export const THREADS_QUERY_STRING = `
  query Threads {
    threads {
      threads {
        remoteId
        status
        title
        createdAt
        updatedAt
        isInboxThread
        inboxItemType
        inboxPriority
        inboxStatus
        summary
        projectId
        featureId
      }
    }
  }
`;

export const THREAD_MESSAGES_QUERY_STRING = `
  query ThreadMessages($threadId: String!) {
    threadMessages(threadId: $threadId) {
      messages {
        id
        role
        content
        createdAt
      }
    }
  }
`;

export const INITIALIZE_THREAD_MUTATION_STRING = `
  mutation InitializeThread($input: InitializeThreadInput!) {
    initializeThread(input: $input) {
      remoteId
      externalId
    }
  }
`;

export const RENAME_THREAD_MUTATION_STRING = `
  mutation RenameThread($input: RenameThreadInput!) {
    renameThread(input: $input)
  }
`;

export const ARCHIVE_THREAD_MUTATION_STRING = `
  mutation ArchiveThread($threadId: String!) {
    archiveThread(threadId: $threadId)
  }
`;

export const UNARCHIVE_THREAD_MUTATION_STRING = `
  mutation UnarchiveThread($threadId: String!) {
    unarchiveThread(threadId: $threadId)
  }
`;

export const DELETE_THREAD_MUTATION_STRING = `
  mutation DeleteThread($threadId: String!) {
    deleteThread(threadId: $threadId)
  }
`;

export const GENERATE_TITLE_MUTATION_STRING = `
  mutation GenerateThreadTitle($input: GenerateTitleInput!) {
    generateThreadTitle(input: $input)
  }
`;

export const APPEND_MESSAGE_MUTATION_STRING = `
  mutation AppendMessage($input: AppendMessageInput!) {
    appendMessage(input: $input)
  }
`;

// ============================================================================
// Types
// ============================================================================

export interface ThreadData {
  remoteId: string;
  status: 'REGULAR' | 'ARCHIVED';
  title?: string;
  createdAt?: string;
  updatedAt?: string;
  isInboxThread?: boolean;
  inboxItemType?: string; // 'blocker' | 'drift' | 'update' | 'coverage'
  inboxPriority?: string; // 'critical' | 'high' | 'medium' | 'low'
  inboxStatus?: string; // 'new' | 'pending' | 'actioned' | 'auto-resolved' | 'closed' | 'dismissed'
  summary?: string;
  projectId?: string;
  featureId?: string;
}

export interface ThreadsQueryResult {
  threads: {
    threads: ThreadData[];
  };
}

export interface ThreadMessage {
  id: string;
  role: string;
  content: string;
  createdAt?: string;
}

export interface ThreadMessagesQueryResult {
  threadMessages: {
    messages: ThreadMessage[];
  };
}

export interface InitializeThreadResult {
  initializeThread: {
    remoteId: string;
    externalId?: string;
  };
}

export interface GenerateTitleResult {
  generateThreadTitle: string;
}
