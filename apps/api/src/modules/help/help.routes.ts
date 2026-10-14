import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { and, asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { users } from '../../db/schema';

/** Who to ask for help: the longest-serving active administrator. */
export const helpRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/contact',
    {
      preHandler: app.authenticate,
      schema: { tags: ['help'], response: { 200: z.object({ email: z.string().nullable() }) } },
    },
    async () => {
      const [admin] = await app.db
        .select({ email: users.email })
        .from(users)
        .where(and(eq(users.role, 'admin'), eq(users.active, true)))
        .orderBy(asc(users.createdAt), asc(users.id))
        .limit(1);
      return { email: admin?.email ?? null };
    },
  );
};
