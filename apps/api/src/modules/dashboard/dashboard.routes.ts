import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { and, count, desc, eq, gte, sql, sum } from 'drizzle-orm';
import { can, dashboardSummary, type FieldChange } from '@cr/contracts';
import {
  compound,
  compoundExtraction,
  mineralTypes,
  production,
  productionAuditEvent,
} from '../../db/schema';
import { todayIn } from '../../shared/time';
import { createProductionService } from '../production/production.service';

export const dashboardRoutes: FastifyPluginAsyncZod = async (app) => {
  const productionService = createProductionService({ db: app.db, config: app.config });

  app.get(
    '/summary',
    {
      preHandler: app.authorize('production:read'),
      schema: { tags: ['dashboard'], response: { 200: dashboardSummary } },
    },
    async (request) => {
      const showChainHealth = can(request.user, 'audit:verify');
      const db = app.db;
      const monthStart = `${todayIn(app.config.APP_TIMEZONE).slice(0, 7)}-01`;
      const thisMonth = gte(production.productionDate, monthStart);

      const [[month], [reports], [pending], byMineral, recent, health] = await Promise.all([
        db
          .select({ n: count(), kg: sum(production.weightKg) })
          .from(production)
          .where(thisMonth),
        db.select({ n: count() }).from(compound),
        db
          .select({ n: count() })
          .from(compoundExtraction)
          .where(
            and(eq(compoundExtraction.status, 'pending'), gte(compoundExtraction.expiresAt, sql`NOW(3)`)),
          ),
        db
          .select({ code: mineralTypes.code, name: mineralTypes.name, kg: sum(production.weightKg) })
          .from(production)
          .innerJoin(mineralTypes, eq(mineralTypes.id, production.mineralTypeId))
          .groupBy(mineralTypes.id, mineralTypes.code, mineralTypes.name)
          .orderBy(desc(sum(production.weightKg))),
        db
          .select({ e: productionAuditEvent, code: production.productionCode })
          .from(productionAuditEvent)
          .innerJoin(production, eq(production.id, productionAuditEvent.productionId))
          .orderBy(desc(productionAuditEvent.occurredAt), desc(productionAuditEvent.id))
          .limit(8),
        showChainHealth ? productionService.verifyAll() : Promise.resolve(null),
      ]);

      return {
        productionThisMonth: month?.n ?? 0,
        weightThisMonthKg: month?.kg ?? '0.000',
        reportsProcessed: reports?.n ?? 0,
        pendingReviews: pending?.n ?? 0,
        weightByMineral: byMineral.map((m) => ({ code: m.code, name: m.name, weightKg: m.kg ?? '0.000' })),
        recentActivity: recent.map(({ e, code }) => ({
          productionId: e.productionId,
          productionCode: code,
          eventType: e.eventType,
          fields: (e.changes as FieldChange[]).map((c) => c.field),
          actorLabel: e.actorLabel,
          occurredAt: e.occurredAt.toISOString(),
        })),
        chainHealth: health ? { ...health, checkedAt: new Date().toISOString() } : null,
      };
    },
  );
};
