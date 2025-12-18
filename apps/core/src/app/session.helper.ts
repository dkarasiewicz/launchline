import session from 'express-session';
import { Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { RedisStore } from 'connect-redis';
import passport from 'passport';
import type { Response, Request } from 'express';
import { AuthenticatedUser } from '@launchline/core-common';

export function getSessionMiddleware(
  redisStore: session.Store,
  configService: ConfigService,
) {
  return session({
    store: redisStore,
    secret: configService.get('session.secret', 'core-session-secret'),
    resave: false,
    saveUninitialized: false,
    name: configService.get('session.name'),
    cookie: {
      secure: configService.get('session.secure'),
      domain: configService.get('session.domain'),
      maxAge: configService.get('session.maxAge'),
      sameSite: configService.get('session.sameSite'),
    },
  });
}

export function decorateGQLSubscriptionRequest(
  redisClient: Redis,
  configService: ConfigService,
  request: Request,
): Promise<{
  user?: AuthenticatedUser;
}> {
  return new Promise((resolve) => {
    getSessionMiddleware(
      new RedisStore({
        client: redisClient,
        prefix: 'core-session:',
      }),
      configService,
    )(request, {} as never, () => {
      passport.session()(request, {} as never, () => {
        if (request.user) {
          resolve({ user: request.user as AuthenticatedUser });
        } else {
          resolve({});
        }
      });
    });
  });
}

export function getOrCreateMarketingSessionId(
  res: Response,
  configService: ConfigService,
  logger: Logger,
  req?: Request,
): string {
  const cookieName = configService.getOrThrow('marketing.cookieName');

  if (!req?.headers?.cookie) {
    return setMarketingCookie(res, configService);
  }

  const cookies = req.headers.cookie.split(';');
  const marketingIdCookie = cookies.find((cookie) =>
    cookie.trim().startsWith(`${cookieName}=`),
  );

  if (!marketingIdCookie) {
    return setMarketingCookie(res, configService);
  }

  try {
    const base64Value = marketingIdCookie.split('=')[1].trim();

    return atob(base64Value);
  } catch (error) {
    logger.warn(
      { error },
      'Marketing ID cookie parsing failed, generating new ID',
    );

    return setMarketingCookie(res, configService);
  }
}

export function setMarketingCookie(
  res: Response,
  configService: ConfigService,
): string {
  const marketingId = randomUUID();

  res.cookie(
    configService.getOrThrow('marketing.cookieName'),
    btoa(marketingId),
    {
      httpOnly: false,
      secure: configService.get('session.secure'),
      domain: configService.get('session.domain'),
      sameSite: configService.get('session.sameSite'),
    },
  );

  return marketingId;
}
