import { z } from 'zod';

export const dashboardSummary = z.object({
  productionThisMonth: z.number().int(),
  weightThisMonthKg: z.string(),
  reportsProcessed: z.number().int(),
  pendingReviews: z.number().int(),
  weightByMineral: z.array(z.object({ code: z.string(), name: z.string(), weightKg: z.string() })),
  recentActivity: z.array(
    z.object({
      productionId: z.number().int(),
      productionCode: z.string(),
      eventType: z.enum(['CREATE', 'UPDATE']),
      fields: z.array(z.string()),
      actorLabel: z.string(),
      occurredAt: z.string(),
    }),
  ),
  /** Null for roles without audit:verify. */
  chainHealth: z
    .object({ intact: z.number().int(), tampered: z.number().int(), checkedAt: z.string() })
    .nullable(),
});
export type DashboardSummary = z.infer<typeof dashboardSummary>;
