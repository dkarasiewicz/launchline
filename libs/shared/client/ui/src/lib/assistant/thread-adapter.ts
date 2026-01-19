'use client';

import type { unstable_RemoteThreadListAdapter as RemoteThreadListAdapter } from '@assistant-ui/react';
import { createAssistantStream } from 'assistant-stream';
import { graphqlRequest } from '../graphql';
import {
  THREADS_QUERY_STRING,
  INITIALIZE_THREAD_MUTATION_STRING,
  RENAME_THREAD_MUTATION_STRING,
  ARCHIVE_THREAD_MUTATION_STRING,
  UNARCHIVE_THREAD_MUTATION_STRING,
  DELETE_THREAD_MUTATION_STRING,
  GENERATE_TITLE_MUTATION_STRING,
  type ThreadsQueryResult,
  type InitializeThreadResult,
  type GenerateTitleResult,
} from '../apollo/operations/threads';

export function createThreadListAdapter(): RemoteThreadListAdapter {
  return {
    /**
     * List all threads for the current user
     */
    async list() {
      const data =
        await graphqlRequest<ThreadsQueryResult>(THREADS_QUERY_STRING);

      return {
        threads: data.threads.threads.map((t) => ({
          remoteId: t.remoteId,
          externalId: t.remoteId,
          status: t.status === 'ARCHIVED' ? 'archived' : 'regular',
          title: t.title,
        })),
      };
    },

    /**
     * Fetch a single thread's metadata
     */
    async fetch(remoteId: string) {
      const data =
        await graphqlRequest<ThreadsQueryResult>(THREADS_QUERY_STRING);

      const thread = data.threads.threads.find((t) => t.remoteId === remoteId);
      if (!thread) {
        throw new Error(`Thread ${remoteId} not found`);
      }

      return {
        remoteId: thread.remoteId,
        externalId: thread.remoteId,
        status:
          thread.status === 'ARCHIVED'
            ? ('archived' as const)
            : ('regular' as const),
        title: thread.title,
      };
    },

    /**
     * Initialize a new thread
     */
    async initialize(threadId: string) {
      const data = await graphqlRequest<InitializeThreadResult>(
        INITIALIZE_THREAD_MUTATION_STRING,
        { input: { threadId } },
      );

      if (!data?.initializeThread) {
        throw new Error('Failed to initialize thread');
      }

      return {
        remoteId: data.initializeThread.remoteId,
        externalId: data.initializeThread.remoteId,
      };
    },

    /**
     * Rename a thread
     */
    async rename(remoteId: string, newTitle: string) {
      await graphqlRequest(RENAME_THREAD_MUTATION_STRING, {
        input: { threadId: remoteId, newTitle },
      });
    },

    /**
     * Archive a thread
     */
    async archive(remoteId: string) {
      await graphqlRequest(ARCHIVE_THREAD_MUTATION_STRING, {
        threadId: remoteId,
      });
    },

    /**
     * Unarchive a thread
     */
    async unarchive(remoteId: string) {
      await graphqlRequest(UNARCHIVE_THREAD_MUTATION_STRING, {
        threadId: remoteId,
      });
    },

    /**
     * Delete a thread
     */
    async delete(remoteId: string) {
      await graphqlRequest(DELETE_THREAD_MUTATION_STRING, {
        threadId: remoteId,
      });
    },

    /**
     * Generate a title for a thread from messages
     */
    async generateTitle(remoteId: string, messages) {
      // Convert ThreadMessages to the format expected by the backend
      const messageInputs = messages.map((m) => ({
        id: m.id,
        role: m.role,
        content:
          m.content
            ?.filter((c) => c.type === 'text')
            .map((c) => ('text' in c ? c.text : ''))
            .join('\n') || '',
      }));

      const data = await graphqlRequest<GenerateTitleResult>(
        GENERATE_TITLE_MUTATION_STRING,
        { input: { threadId: remoteId, messages: messageInputs } },
      );

      const title = data?.generateThreadTitle || 'Untitled';

      // Return as AssistantStream
      return createAssistantStream(async (controller) => {
        controller.appendText(title);
      });
    },
  };
}
