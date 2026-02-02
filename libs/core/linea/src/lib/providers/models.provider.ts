import { Provider } from '@nestjs/common';
import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import {
  LINEA_MODEL,
  LINEA_MODEL_FAST,
  LINEA_MODEL_ANALYSIS,
  LINEA_MODEL_REASONING,
  LINEA_EMBEDDINGS,
} from '../tokens';
import { ConfigService } from '@nestjs/config';

/**
 * Primary model provider - complex reasoning tasks
 */
export const modelProvider: Provider = {
  provide: LINEA_MODEL,
  useFactory: (config: ConfigService) =>
    new ChatOpenAI({
      model: config.get<string>('ai.models.primary.modelName'),
      configuration: {
        apiKey: config.get<string>('ai.models.primary.apiKey'),
        baseURL: config.get<string>('ai.models.primary.modelUrl'),
      },
      //      temperature: 0,
    }),
  inject: [ConfigService],
};

/**
 * Fast model provider - quick classification tasks
 */
export const modelFastProvider: Provider = {
  provide: LINEA_MODEL_FAST,
  useFactory: (config: ConfigService) =>
    new ChatOpenAI({
      model: config.get<string>('ai.models.fast.modelName'),
      configuration: {
        apiKey: config.get<string>('ai.models.fast.apiKey'),
        baseURL: config.get<string>('ai.models.fast.modelUrl'),
      },
      //      temperature: 0,
    }),
  inject: [ConfigService],
};

/**
 * Analysis model provider - pattern analysis, summarization
 */
export const modelAnalysisProvider: Provider = {
  provide: LINEA_MODEL_ANALYSIS,
  useFactory: (config: ConfigService) =>
    new ChatOpenAI({
      apiKey: config.get<string>('ai.models.analysis.apiKey'),
      model: config.get<string>('ai.models.analysis.modelName'),
      configuration: {
        apiKey: config.get<string>('ai.models.analysis.apiKey'),
        baseURL: config.get<string>('ai.models.analysis.modelUrl'),
      },
      //      temperature: 0,
    }),
  inject: [ConfigService],
};

/**
 * Reasoning model provider - complex multistep reasoning (Anthropic)
 */
export const modelReasoningProvider: Provider = {
  provide: LINEA_MODEL_REASONING,
  useFactory: (config: ConfigService) =>
    new ChatAnthropic({
      apiKey: config.get<string>('ai.models.analysis.apiKey'),
      model: config.get<string>('ai.models.reasoning.modelName'),
      clientOptions: {
        apiKey: config.get<string>('ai.models.reasoning.apiKey'),
        baseURL: config.get<string>('ai.models.reasoning.modelUrl'),
      },
      //      temperature: 0,
    }),
  inject: [ConfigService],
};

/**
 * Embeddings model provider - semantic search
 */
export const embeddingsProvider: Provider = {
  provide: LINEA_EMBEDDINGS,
  useFactory: (config: ConfigService) =>
    new OpenAIEmbeddings({
      apiKey: config.get<string>('ai.models.fast.apiKey'),
      model: config.get<string>('ai.memory.embeddingType'),
      configuration: {
        apiKey: config.get<string>('ai.models.fast.apiKey'),
        baseURL: config.get<string>('ai.models.fast.modelUrl'),
      },
    }),
  inject: [ConfigService],
};

export const modelProviders: Provider[] = [
  modelProvider,
  modelFastProvider,
  modelAnalysisProvider,
  modelReasoningProvider,
  embeddingsProvider,
];
