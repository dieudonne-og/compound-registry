import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  auditEventView,
  createProductionInput,
  type ProductionRecord,
  errorBody,
  pageOf,
  productionListQuery,
  productionRecord,
  updateProductionInput,
  verifyResult,
} from '@cr/contracts';
import { validationError } from '../../shared/errors';
import { withIdempotency } from './idempotency';
import { createProductionService } from './production.service';

const idParams = z.object({ id: z.coerce.number().int().positive() });
const KEY = /^[A-Za-z0-9-]{8,64}$/;

export const productionRoutes: FastifyPluginAsyncZod = async (app) => {
  const service = createProductionService({ db: app.db, config: app.config });

  app.post(
    '/',
    {
      preHandler: app.authorize('production:create'),
      schema: {
        tags: ['production'],
        summary: 'Register a production record',
        headers: z.object({ 'idempotency-key': z.string().optional() }).passthrough(),
        body: createProductionInput,
        response: { 201: productionRecord, 409: errorBody, 422: errorBody },
      },
    },
    async (request, reply) => {
      const key = request.headers['idempotency-key'];
      const run = async () => ({ status: 201, body: await service.create(request.body, request.user) });
      if (!key) return reply.status(201).send((await run()).body);
      if (!KEY.test(key)) throw validationError({ 'idempotency-key': 'Use 8–64 letters, digits or dashes.' });
      const result = await withIdempotency(app.db, { key, userId: request.user.id, body: request.body }, run);
      if (result.replayed) reply.header('idempotent-replayed', 'true');
      // Only successful creations are stored for replay, so the stored status is always 201.
      return reply.status(201).send(result.body as ProductionRecord);
    },
  );

  app.get(
    '/',
    {
      preHandler: app.authorize('production:read'),
      schema: {
        tags: ['production'],
        querystring: productionListQuery,
        response: { 200: pageOf(productionRecord) },
      },
    },
    async (request) => service.list(request.query),
  );

  app.get(
    '/export.csv',
    {
      preHandler: app.authorize('production:read'),
      schema: {
        tags: ['production'],
        summary: 'Export filtered records as CSV',
        querystring: productionListQuery,
      },
    },
    async (request, reply) => {
      const date = new Date().toISOString().slice(0, 10);
      return reply
        .header('content-type', 'text/csv; charset=utf-8')
        .header('content-disposition', `attachment; filename="production-${date}.csv"`)
        .send(await service.exportCsv(request.query));
    },
  );

  app.get(
    '/:id',
    {
      preHandler: app.authorize('production:read'),
      schema: { tags: ['production'], params: idParams, response: { 200: productionRecord, 404: errorBody } },
    },
    async (request) => service.get(request.params.id),
  );

  app.put(
    '/:id',
    {
      preHandler: app.authorize('production:update'),
      schema: {
        tags: ['production'],
        summary: 'Update a record; critical-field changes need a reason and are added to the audit chain',
        params: idParams,
        body: updateProductionInput,
        response: { 200: productionRecord, 403: errorBody, 409: errorBody, 422: errorBody },
      },
    },
    async (request) => service.update(request.params.id, request.body, request.user),
  );

  app.get(
    '/:id/history',
    {
      preHandler: app.authorize('audit:read'),
      schema: { tags: ['audit'], params: idParams, response: { 200: z.array(auditEventView) } },
    },
    async (request) => service.history(request.params.id),
  );

  app.get(
    '/:id/verify',
    {
      preHandler: app.authorize('audit:verify'),
      schema: { tags: ['audit'], params: idParams, response: { 200: verifyResult, 404: errorBody } },
    },
    async (request) => service.verify(request.params.id),
  );
};
