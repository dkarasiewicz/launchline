// Use this file to export React client components (e.g. those with 'use client' directive) or other non-server utilities

export {
  graphqlRequest,
  GraphQLError,
  GRAPHQL_ENDPOINT,
  API_BASE,
} from './lib/graphql';
export type { GraphQLResponse } from './lib/graphql';

export { ApolloClientProvider } from './lib/apollo';

// GraphQL operations (can be used with Apollo hooks)
export {
  THREADS_QUERY,
  THREAD_MESSAGES_QUERY,
  INITIALIZE_THREAD_MUTATION,
  RENAME_THREAD_MUTATION,
  ARCHIVE_THREAD_MUTATION,
  UNARCHIVE_THREAD_MUTATION,
  DELETE_THREAD_MUTATION,
  GENERATE_TITLE_MUTATION,
  APPEND_MESSAGE_MUTATION,
  type ThreadData,
  type ThreadsQueryResult,
  type ThreadMessage,
  type ThreadMessagesQueryResult,
  type InitializeThreadResult,
  type GenerateTitleResult,
} from './lib/apollo/operations/threads';

// Assistant utilities
export * from './lib/assistant';

export * from './lib/posthog';

// Runtime provider
export * from './components/providers/LaunchlineRuntimeProvider';
