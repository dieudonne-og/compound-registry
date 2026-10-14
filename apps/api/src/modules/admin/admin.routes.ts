import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  activityEntry,
  activityQuery,
  createUserInput,
  errorBody,
  pageOf,
  temporaryPasswordResponse,
  updateUserInput,
  userAdminView,
} from '@cr/contracts';
import { listActivity } from './activity.service';
import { createUsersService } from './users.service';

const idParams = z.object({ id: z.coerce.number().int().positive() });

/** User administration and the administration log; administrators only. */
export const adminRoutes: FastifyPluginAsyncZod = async (app) => {
  const users = createUsersService(app.db);
  const guard = app.authorize('admin:manage');

  app.get(
    '/users',
    { preHandler: guard, schema: { tags: ['admin'], response: { 200: z.array(userAdminView) } } },
    async () => users.list(),
  );

  app.post(
    '/users',
    {
      preHandler: guard,
      schema: {
        tags: ['admin'],
        summary: 'Create a user with a temporary password (shown once)',
        body: createUserInput,
        response: { 201: temporaryPasswordResponse, 409: errorBody },
      },
    },
    async (request, reply) => reply.status(201).send(await users.create(request.body, request.user)),
  );

  app.patch(
    '/users/:id',
    {
      preHandler: guard,
      schema: {
        tags: ['admin'],
        params: idParams,
        body: updateUserInput,
        response: { 200: userAdminView, 404: errorBody, 409: errorBody, 422: errorBody },
      },
    },
    async (request) => users.update(request.params.id, request.body, request.user),
  );

  app.post(
    '/users/:id/reset-password',
    {
      preHandler: guard,
      schema: {
        tags: ['admin'],
        summary: 'Issue a new temporary password and sign the user out everywhere',
        params: idParams,
        response: { 200: temporaryPasswordResponse, 404: errorBody },
      },
    },
    async (request) => users.resetPassword(request.params.id, request.user),
  );

  app.get(
    '/admin/activity',
    {
      preHandler: guard,
      schema: { tags: ['admin'], querystring: activityQuery, response: { 200: pageOf(activityEntry) } },
    },
    async (request) => listActivity(app.db, request.query),
  );
};
