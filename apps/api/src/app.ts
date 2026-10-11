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
import { authPlugin } from './modules/auth/auth.plugin';
import { authRoutes } from './modules/auth/auth.routes';

declare module 'fastify' {
  interface FastifyInstance {
    config: Config;
    db: Database;
    pool: Pool;
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
    trustProxy: true,
    bodyLimit: 1024 * 1024,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.decorate('config', config);
  app.decorate('db', deps.db);
  app.decorate('pool', deps.pool);
  app.setErrorHandler(errorHandler);
  app.setNotFoundHandler((request, reply) =>
    reply
      .status(404)
      .send({ error: { code: 'NOT_FOUND', message: 'Route not found.', requestId: request.id } }),
  );
  app.addHook('onSend', async (request, reply) => {
    reply.header('x-request-id', request.id);
  });

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, { origin: config.WEB_ORIGIN, credentials: true });
  await app.register(cookie);
  await app.register(rateLimit, {
    global: false,
    errorResponseBuilder: () => new AppError('RATE_LIMITED', 429, 'Too many requests. Please wait a moment.'),
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
    },
    { prefix: '/api' },
  );

  return app;
}

export type App = Awaited<ReturnType<typeof buildApp>>;
