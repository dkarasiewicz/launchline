import '@as-integrations/express5';

import { NestFactory } from '@nestjs/core';
import { VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { RedisStore } from 'connect-redis';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import passport from 'passport';

import { AppModule } from './app/app.module';
import { getSessionMiddleware } from './app/session.helper';
import { REDIS_CLIENT } from '@launchline/core-common';

declare const module: {
  hot: {
    accept: () => void;
    dispose: (callback: () => void) => void;
  };
};

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });

  const logger = app.get(Logger);
  const redisClient = app.get(REDIS_CLIENT);
  const redisStore = new RedisStore({
    client: redisClient,
    prefix: 'core-session:',
  });
  const configService = app.get(ConfigService);
  const port = configService.get('port');
  const trustProxy = configService.get('trustProxy');

  if (trustProxy) {
    app.set('trust proxy', 1);
  }

  if (configService.get('cors.enabled')) {
    app.enableCors({
      origin: configService.get('cors.origin'),
      credentials: true,
    });
  }

  app.use(helmet());
  app.enableVersioning({
    type: VersioningType.HEADER,
    header: 'X-API-Version',
    defaultVersion: '1.0',
  });
  app.useLogger(logger);
  app.enableShutdownHooks();
  app.use(getSessionMiddleware(redisStore, configService));
  app.use(passport.session());

  await app.listen(port);

  logger.log(`🚀 Application is running on: http://localhost:${port}/graphql`);

  if (module.hot) {
    module.hot.accept();
    module.hot.dispose(() => app.close());
  }
}

bootstrap();
