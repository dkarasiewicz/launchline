import { z } from 'zod';

const configSchema = z.object({
  port: z.number(),
  logLevel: z.string(),
  logPretty: z.boolean(),
  enableApolloLandingPage: z.boolean(),
  gracefulShutdownTimeoutMs: z.number(),
  trustProxy: z.boolean(),
  cors: z.object({
    enabled: z.boolean(),
    origin: z.array(z.string()),
  }),
  session: z.object({
    secret: z.string(),
    secure: z.boolean(),
    domain: z.optional(z.string()),
    maxAge: z.optional(z.number()),
    name: z.optional(z.string()),
    sameSite: z.optional(z.string()),
  }),
  marketing: z.object({
    cookieName: z.string(),
  }),
  database: z.object({
    user: z.string(),
    password: z.string(),
    database: z.string(),
    host: z.string(),
    port: z.number(),
    max: z.number(),
    idleTimeoutMillis: z.number(),
    connectionTimeoutMillis: z.number(),
    keepAlive: z.boolean(),
    queryTimeout: z.number(),
    statementTimeout: z.number(),
    applicationName: z.string(),
    ssl: z.boolean(),
    idleInTransactionSessionTimeout: z.number(),
  }),
  eventBus: z.object({
    rabbitMqUrl: z.string(),
  }),
  cache: z.object({
    host: z.string(),
    port: z.number(),
    username: z.optional(z.string()),
    password: z.optional(z.string()),
    clusterMode: z.boolean(),
    sslEnabled: z.boolean(),
  }),
  ai: z.object({
    hf: z.object({
      apiKey: z.optional(z.string()),
      modelUrl: z.optional(z.string()),
      modelName: z.optional(z.string()),
      maxRetries: z.number(),
    }),
  }),
  postHog: z.object({
    apiKey: z.optional(z.string()),
    host: z.optional(z.string()),
    disabled: z.optional(z.boolean()),
  }),
});

export const config = () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  logLevel: process.env.LOG_LEVEL || 'info',
  logPretty: process.env.LOG_PRETTY === 'true',
  enableApolloLandingPage: process.env.ENABLE_APOLLO_LANDING_PAGE === 'true',
  gracefulShutdownTimeoutMs: parseInt(
    process.env.GRACEFUL_SHUTDOWN_TIMEOUT_MS || '0',
    10,
  ),
  trustProxy: process.env.TRUST_PROXY === 'true',
  cors: {
    enabled: process.env.CORS_ENABLED === 'true',
    origin: process.env.CORS_ORIGIN?.split(','),
  },
  session: {
    secret: process.env.SESSION_SECRET,
    secure: process.env.SESSION_SECURE === 'true',
    domain: process.env.SESSION_DOMAIN,
    maxAge: process.env.SESSION_MAX_AGE
      ? parseInt(process.env.SESSION_MAX_AGE, 10)
      : undefined,
    name: process.env.SESSION_NAME || 'core.sid',
    sameSite: process.env.SESSION_SAME_SITE || 'strict',
  },
  marketing: {
    cookieName: process.env.MARKETING_COOKIE_NAME || 'core.marketingsid',
  },
  database: {
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASS,
    database: process.env.DB_DATABASE,
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    max: parseInt(process.env.DATABASE_MAX || '40', 10),
    idleTimeoutMillis: parseInt(
      process.env.DATABASE_IDLE_TIMEOUT_MILLIS || '30000',
      10,
    ),
    connectionTimeoutMillis: parseInt(
      process.env.DATABASE_CONNECTION_TIMEOUT_MILLIS || '20000',
      10,
    ),
    keepAlive: process.env.DATABASE_KEEP_ALIVE === 'true',
    queryTimeout: parseInt(process.env.DATABASE_QUERY_TIMEOUT || '60000', 10),
    statementTimeout: parseInt(
      process.env.DATABASE_STATEMENT_TIMEOUT || '60000',
      10,
    ),
    applicationName: process.env.DATABASE_APPLICATION_NAME || 'core',
    ssl: process.env.DATABASE_SSL === 'true',
    idleInTransactionSessionTimeout: parseInt(
      process.env.DATABASE_IDLE_IN_TRANSACTION_SESSION_TIMEOUT || '60000',
      10,
    ),
  },
  eventBus: {
    rabbitMqUrl: process.env.EVENT_BUS_RABBIT_MQ_URL || 'amqp://localhost:5672',
  },
  cache: {
    host: process.env.CACHE_HOST,
    port: process.env.CACHE_PORT ? parseInt(process.env.CACHE_PORT, 10) : 6379,
    username: process.env.CACHE_USERNAME,
    password: process.env.CACHE_PASSWORD,
    clusterMode: process.env.CACHE_CLUSTER_MODE === 'true',
    sslEnabled: process.env.CACHE_SSL_ENABLED === 'true',
  },
  ai: {
    hf: {
      apiKey: process.env.AI_HF_API_KEY,
      modelUrl: process.env.AI_HF_MODEL_URL,
      modelName: process.env.AI_HF_MODEL_NAME,
      maxRetries: parseInt(process.env.AI_HF_MAX_RETRIES || '2', 10),
    },
  },
  postHog: {
    apiKey: process.env.POSTHOG_API_KEY,
    host: process.env.POSTHOG_HOST,
    disabled: process.env.POSTHOG_DISABLED === 'true',
  },
});

export function validate() {
  const result = configSchema.safeParse(config());

  if (!result.success) {
    throw new Error(result.error.message);
  }

  return result.data;
}
