import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  compoundDetail,
  compoundListQuery,
  compoundSummary,
  confirmCompoundInput,
  errorBody,
  extractionResult,
  pageOf,
  purchaseId,
} from '@cr/contracts';
import { validationError } from '../../shared/errors';
import { createCompoundService } from './compounds.service';

const idParams = z.object({ id: z.coerce.number().int().positive() });

export const compoundRoutes: FastifyPluginAsyncZod = async (app) => {
  const service = createCompoundService({ db: app.db, storage: app.storage, config: app.config });

  app.post(
    '/extract',
    {
      preHandler: app.authorize('compound:extract'),
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
      schema: {
        tags: ['compounds'],
        summary: 'Upload a laboratory report and extract compound values for review',
        consumes: ['multipart/form-data'],
        response: { 200: extractionResult, 413: errorBody, 415: errorBody, 422: errorBody },
      },
    },
    async (request) => {
      const file = await request.file();
      if (!file) throw validationError({ file: 'Choose a laboratory report to upload.' });
      const field = file.fields.purchaseId;
      const raw = field && !Array.isArray(field) && 'value' in field ? String(field.value) : '';
      const parsed = purchaseId.safeParse(raw);
      if (!parsed.success) throw validationError({ purchaseId: parsed.error.issues[0]!.message });
      const buffer = await file.toBuffer();
      return service.extract({
        buffer,
        filename: file.filename,
        purchaseId: parsed.data,
        user: request.user,
      });
    },
  );

  app.post(
    '',
    {
      preHandler: app.authorize('compound:create'),
      schema: {
        tags: ['compounds'],
        summary: 'Save reviewed values',
        body: confirmCompoundInput,
        response: { 201: z.object({ id: z.number() }), 409: errorBody, 410: errorBody },
      },
    },
    async (request, reply) => reply.status(201).send(await service.confirm(request.body, request.user)),
  );

  app.get(
    '',
    {
      preHandler: app.authorize('compound:read'),
      schema: {
        tags: ['compounds'],
        querystring: compoundListQuery,
        response: { 200: pageOf(compoundSummary) },
      },
    },
    async (request) => service.list(request.query),
  );

  app.get(
    '/:id',
    {
      preHandler: app.authorize('compound:read'),
      schema: { tags: ['compounds'], params: idParams, response: { 200: compoundDetail, 404: errorBody } },
    },
    async (request) => service.get(request.params.id),
  );

  app.get(
    '/:id/file',
    {
      preHandler: app.authorize('compound:file'),
      schema: { tags: ['compounds'], summary: 'Download the original report', params: idParams },
    },
    async (request, reply) => {
      const f = await service.file(request.params.id);
      const ascii = f.name.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '');
      return reply
        .header('content-type', f.mime)
        .header(
          'content-disposition',
          `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(f.name)}`,
        )
        .header('x-content-type-options', 'nosniff')
        .header('cache-control', 'private, no-store')
        .send(f.stream);
    },
  );
};
