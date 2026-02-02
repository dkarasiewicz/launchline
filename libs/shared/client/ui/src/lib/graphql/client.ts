const API_BASE = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
const GRAPHQL_ENDPOINT = `${API_BASE}/graphql`;

export interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: Array<string | number>;
    extensions?: Record<string, unknown>;
  }>;
}

export class GraphQLError extends Error {
  constructor(
    message: string,
    public readonly errors: GraphQLResponse<unknown>['errors'],
  ) {
    super(message);
    this.name = 'GraphQLError';
  }
}

/**
 * Execute a GraphQL query or mutation.
 *
 * @param query - GraphQL query/mutation string
 * @param variables - Optional variables object
 * @returns The data from the response
 * @throws GraphQLError if the response contains errors
 *
 * @example
 * ```ts
 * const data = await graphqlRequest<{ users: User[] }>(
 *   `query { users { id name } }`
 * );
 * ```
 */
export async function graphqlRequest<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
  }

  const result: GraphQLResponse<T> = await response.json();

  if (result.errors && result.errors.length > 0) {
    const message = result.errors.map((e) => e.message).join(', ');
    throw new GraphQLError(message, result.errors);
  }

  if (!result.data) {
    throw new Error('No data returned from GraphQL');
  }

  return result.data;
}

// ============================================================================
// Exports
// ============================================================================

export { GRAPHQL_ENDPOINT, API_BASE };
