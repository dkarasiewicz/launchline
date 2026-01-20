import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { PostgresStore } from '@langchain/langgraph-checkpoint-postgres/store';
import { LINEA_CHECKPOINTER, LINEA_STORE, LINEA_EMBEDDINGS } from '../tokens';
import type { OpenAIEmbeddings } from '@langchain/openai';

function buildDatabaseUrl(config: ConfigService): string {
  const user = config.get<string>('database.user') || 'postgres';
  const password = config.get<string>('database.password') || 'password';
  const host = config.get<string>('database.host') || 'localhost';
  const port = config.get<number>('database.port') || 5432;
  const database = config.get<string>('database.database') || 'launchline';
  const ssl = config.get<boolean>('database.ssl') ? '?sslmode=require' : '';

  return `postgresql://${user}:${password}@${host}:${port}/${database}${ssl}`;
}

export const checkpointerProvider: Provider = {
  provide: LINEA_CHECKPOINTER,
  useFactory: (config: ConfigService) => {
    const dbUrl = buildDatabaseUrl(config);
    return PostgresSaver.fromConnString(dbUrl);
  },
  inject: [ConfigService],
};

export const storeProvider: Provider = {
  provide: LINEA_STORE,
  useFactory: (config: ConfigService, embeddings: OpenAIEmbeddings) => {
    const dbUrl = buildDatabaseUrl(config);
    return new PostgresStore({
      connectionOptions: dbUrl,
      ensureTables: true,
      index: {
        dims: config.get<number>('ai.memory.embeddingDims') || 1536,
        embed: embeddings,
      },
    });
  },
  inject: [ConfigService, LINEA_EMBEDDINGS],
};

export const persistenceProviders: Provider[] = [
  checkpointerProvider,
  storeProvider,
];
