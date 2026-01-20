import { ApolloLink, HttpLink } from '@apollo/client';
import { SetContextLink } from '@apollo/client/link/context';
import {
  ApolloClient,
  InMemoryCache,
  registerApolloClient,
} from '@apollo/client-integration-nextjs';
import { headers } from 'next/headers';

// ============================================================================
// Configuration
// ============================================================================

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
const GRAPHQL_ENDPOINT =
  process.env.CORE_API_HOST_GRAPHQL || `${API_BASE}/graphql`;

// ============================================================================
// Server-side Apollo Client (SSR-safe with cookie forwarding)
// ============================================================================

const asyncAuthLink = new SetContextLink(async ({ headers: localHeaders }) => {
  const requestHeaders = await headers();
  const cookie = requestHeaders.get('Cookie');

  return {
    headers: {
      ...localHeaders,
      cookie,
    },
  };
});

const urlLink = new HttpLink({
  uri: GRAPHQL_ENDPOINT,
});

export const { getClient, query, PreloadQuery } = registerApolloClient(() => {
  return new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.from([asyncAuthLink, urlLink]),
  });
});

// ============================================================================
// Exports
// ============================================================================

export { GRAPHQL_ENDPOINT, API_BASE };
