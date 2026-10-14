import Fastify from 'fastify';
import { randomUUID } from 'node:crypto';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Config } from './shared/config';
import type { Database, Pool } from './db/client';
import { AppError, errorHandler } from './shared/errors';
import { languagePlugin, tr } from './shared/i18n';
import { authPlugin } from './modules/auth/auth.plugin';
import { authRoutes } from './modules/auth/auth.routes';
import { compoundRoutes } from './modules/compounds/compounds.routes';
import { referenceRoutes } from './modules/reference/reference.routes';
import { productionRoutes } from './modules/production/production.routes';
import { dashboardRoutes } from './modules/dashboard/dashboard.routes';
import { meRoutes } from './modules/me/me.routes';
import { adminRoutes } from './modules/admin/admin.routes';
import { helpRoutes } from './modules/help/help.routes';
import { createStorage, type Storage } from './shared/storage';

declare module 'fastify' {
  interface FastifyInstance {
    config: Config;
    db: Database;
    pool: Pool;
    storage: Storage;
  }
}

export async function buildApp(deps: { config: Config; db: Database; pool: Pool }) {
  const { config } = deps;
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      redact: ['req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]'],
      ...(config.NODE_ENV === 'development' ? { transport: { target: 'pino-pretty' } } : {}),
    },
    genReqId: () => randomUUID(),
    // Only this many proxy hops may set the client address via X-Forwarded-For; 0 trusts none.
    trustProxy: (_address: string, hop: number) => hop < config.TRUST_PROXY,
    bodyLimit: 1024 * 1024,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.decorate('config', config);
  app.decorate('db', deps.db);
  app.decorate('pool', deps.pool);
  app.decorate('storage', createStorage(config.STORAGE_DIR));
  await app.register(languagePlugin);
  app.setErrorHandler(errorHandler);
  app.setNotFoundHandler((request, reply) =>
    reply.status(404).send({
      error: {
        code: 'NOT_FOUND',
        message: tr(request.language, 'errors.routeNotFound'),
        requestId: request.id,
      },
    }),
  );
  app.addHook('onSend', async (request, reply) => {
    reply.header('x-request-id', request.id);
  });

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, { origin: config.WEB_ORIGIN, credentials: true });
  await app.register(cookie);
  await app.register(rateLimit, {
    global: false,
    errorResponseBuilder: () => new AppError('RATE_LIMITED', 429, 'errors.RATE_LIMITED'),
  });
  await app.register(multipart, {
    limits: { fileSize: config.MAX_UPLOAD_MB * 1024 * 1024, files: 1, fields: 5 },
  });
  await app.register(authPlugin);
  await app.register(swagger, {
    openapi: {
      info: { title: 'Compound Registry API', version: '1.0.0' },
      components: { securitySchemes: { cookieAuth: { type: 'apiKey', in: 'cookie', name: 'access_token' } } },
      security: [{ cookieAuth: [] }],
    },
    transform: jsonSchemaTransform,
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });

  await app.register(
    async (api) => {
      api.get(
        '/health',
        {
          schema: {
            tags: ['system'],
            response: { 200: z.object({ status: z.literal('ok'), db: z.literal('ok') }) },
          },
        },
        async () => {
          await deps.db.execute(sql`SELECT 1`);
          return { status: 'ok' as const, db: 'ok' as const };
        },
      );
      await api.register(authRoutes, { prefix: '/auth' });
      await api.register(compoundRoutes, { prefix: '/compounds' });
      await api.register(referenceRoutes, { prefix: '/reference' });
      await api.register(productionRoutes, { prefix: '/production' });
      await api.register(dashboardRoutes, { prefix: '/dashboard' });
      await api.register(meRoutes, { prefix: '/me' });
      await api.register(adminRoutes);
      await api.register(helpRoutes, { prefix: '/help' });
    },
    { prefix: '/api' },
  );

  return app;
}

export type App = Awaited<ReturnType<typeof buildApp>>;
