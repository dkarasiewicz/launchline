'use client';

import { HttpLink, ApolloLink } from '@apollo/client';
import {
  ApolloNextAppProvider,
  ApolloClient,
  InMemoryCache,
} from '@apollo/client-integration-nextjs';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { getMainDefinition } from '@apollo/client/utilities';
import { createClient } from 'graphql-ws';

const makeClient = (gqlApiUrl?: string) => {
  const httpLink = new HttpLink({
    uri: gqlApiUrl,
    credentials: 'include',
  });

  const wsUrl = gqlApiUrl?.replace(/^http/, 'ws');

  const wsLink = new GraphQLWsLink(
    createClient({
      url: wsUrl || 'ws://localhost:3000/graphql',
    }),
  );

  const splitLink = ApolloLink.split(
    ({ query }) => {
      const definition = getMainDefinition(query);

      return (
        definition.kind === 'OperationDefinition' &&
        definition.operation === 'subscription'
      );
    },
    wsLink,
    httpLink,
  );

  return new ApolloClient({
    cache: new InMemoryCache(),
    link: splitLink,
  });
};

export const ApolloClientProvider = ({
  children,
  gqlApiUrl,
}: React.PropsWithChildren & { gqlApiUrl?: string }) => (
  <ApolloNextAppProvider makeClient={() => makeClient(gqlApiUrl)}>
    {children}
  </ApolloNextAppProvider>
);
