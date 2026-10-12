import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { eq } from 'drizzle-orm';
import { preferencesPatch, userPreferences } from '@cr/contracts';
import { users } from '../../db/schema';

/** The signed-in user's own preferences (stored as JSON on their account). */
export const meRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/preferences',
    { preHandler: app.authenticate, schema: { tags: ['me'], response: { 200: userPreferences } } },
    async (request) => request.account!.preferences,
  );

  app.put(
    '/preferences',
    {
      preHandler: app.authenticate,
      schema: { tags: ['me'], body: preferencesPatch, response: { 200: userPreferences } },
    },
    async (request) => {
      const merged = userPreferences.parse({ ...request.account!.preferences, ...request.body });
      await app.db.update(users).set({ preferences: merged }).where(eq(users.id, request.user.id));
      return merged;
    },
  );
};
