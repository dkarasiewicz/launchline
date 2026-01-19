// Use this file to export React server components

// Apollo Client for server components (SSR-safe with cookie forwarding)
export { getClient, query, PreloadQuery } from './lib/apollo/client';

// GraphQL operations for server components
export {
  THREADS_QUERY,
  THREAD_MESSAGES_QUERY,
  type ThreadsQueryResult,
  type ThreadMessagesQueryResult,
} from './lib/apollo/operations/threads';

// Legacy chat API
export * from './lib/chatApi';
