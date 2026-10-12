import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  can,
  errorBody,
  REFERENCE_KINDS,
  referenceInput,
  referenceItem,
  referencePatch,
} from '@cr/contracts';
import { createReferenceService } from './reference.service';

const kindParams = z.object({ kind: z.enum(REFERENCE_KINDS) });

export const referenceRoutes: FastifyPluginAsyncZod = async (app) => {
  const service = createReferenceService(app.db);

  app.get(
    '/:kind',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['reference'],
        summary: 'List companies, locations, agents or mineral types',
        params: kindParams,
        querystring: z.object({ includeInactive: z.enum(['true', 'false']).optional() }),
        response: { 200: z.array(referenceItem) },
      },
    },
    async (request) =>
      service.list(
        request.params.kind,
        request.query.includeInactive === 'true' && can(request.user, 'reference:manage'),
      ),
  );

  app.post(
    '/:kind',
    {
      preHandler: app.authorize('reference:manage'),
      schema: {
        tags: ['reference'],
        params: kindParams,
        body: referenceInput,
        response: { 201: referenceItem, 409: errorBody },
      },
    },
    async (request, reply) =>
      reply.status(201).send(await service.create(request.params.kind, request.body, request.user)),
  );

  app.patch(
    '/:kind/:id',
    {
      preHandler: app.authorize('reference:manage'),
      schema: {
        tags: ['reference'],
        params: kindParams.extend({ id: z.coerce.number().int().positive() }),
        body: referencePatch,
        response: { 200: referenceItem, 404: errorBody, 409: errorBody },
      },
    },
    async (request) => service.update(request.params.kind, request.params.id, request.body, request.user),
  );
};
