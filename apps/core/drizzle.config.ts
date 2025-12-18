import { defineConfig } from 'drizzle-kit';

const dbUsername = process.env.DB_USERNAME || 'postgres';
const dbPass = process.env.DB_PASS || 'password';
const dbHost = process.env.DB_HOST || 'localhost';
const dbPort = process.env.DB_PORT || '5432';
const dbDatabase = process.env.DB_DATABASE || 'local';

export default defineConfig({
  out: './migrations',
  schema: '../../libs/core/common/src/lib/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: `postgres://${dbUsername}:${dbPass}@${dbHost}:${dbPort}/${dbDatabase}`,
  },
});
