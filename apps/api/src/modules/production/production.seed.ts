import { count, eq } from 'drizzle-orm';
import type { Database } from '../../db/client';
import {
  businessLocations,
  companies,
  mineralTypes,
  production,
  traceabilityAgents,
  users,
} from '../../db/schema';
import type { Config } from '../../shared/config';
import { createProductionService } from './production.service';

export async function seedProduction(db: Database, config: Config) {
  const [{ n }] = (await db.select({ n: count() }).from(production)) as [{ n: number }];
  if (n > 0) return;

  const service = createProductionService({ db, config });
  const [admin] = await db.select().from(users).where(eq(users.role, 'admin'));
  const [operator] = await db.select().from(users).where(eq(users.role, 'operator'));
  if (!admin || !operator) return;
  const session = (u: typeof admin) => ({ id: u.id, name: u.name, email: u.email, role: u.role });

  const [minerals, locations, agents, firms] = await Promise.all([
    db.select().from(mineralTypes),
    db.select().from(businessLocations),
    db.select().from(traceabilityAgents),
    db.select().from(companies),
  ]);
  const pick = <T>(list: T[], i: number) => list[i % list.length]!;
  const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString().slice(0, 10);
  const weights = [
    '1250.500',
    '980.000',
    '2310.750',
    '640.250',
    '1875.000',
    '455.125',
    '3020.400',
    '760.800',
  ];
  const reps = ['Jean Mugabo', 'Claudine Ingabire', 'Samuel Nshimiyimana', 'Aline Umutoni'];

  const created = [];
  for (let i = 0; i < weights.length; i++) {
    created.push(
      await service.create(
        {
          tagNumber: `TAG-${String(4501 + i)}`,
          productionDate: daysAgo(40 - i * 5),
          mineralTypeId: pick(minerals, i).id,
          weightKg: weights[i]!,
          businessLocationId: pick(locations, i).id,
          traceabilityAgentId: pick(agents, i).id,
          companyId: pick(firms, i).id,
          operatorRepresentative: pick(reps, i),
        },
        session(i % 2 ? operator : admin),
      ),
    );
  }

  const [first, second] = created;
  await service.update(
    first!.id,
    {
      productionCode: first!.productionCode,
      tagNumber: first!.tagNumber,
      productionDate: first!.productionDate,
      mineralTypeId: first!.mineralType.id,
      weightKg: '1248.900',
      businessLocationId: first!.businessLocation.id,
      traceabilityAgentId: first!.traceabilityAgent.id,
      companyId: first!.company.id,
      operatorRepresentative: first!.operatorRepresentative,
      version: first!.version,
      reason: 'Re-weighed on the certified warehouse scale',
    },
    session(admin),
  );
  await service.update(
    second!.id,
    {
      productionCode: second!.productionCode,
      tagNumber: `${second!.tagNumber}-R`,
      productionDate: second!.productionDate,
      mineralTypeId: second!.mineralType.id,
      weightKg: second!.weightKg,
      businessLocationId: second!.businessLocation.id,
      traceabilityAgentId: second!.traceabilityAgent.id,
      companyId: second!.company.id,
      operatorRepresentative: second!.operatorRepresentative,
      version: second!.version,
      reason: 'Original tag damaged during transport; replacement tag fitted',
    },
    session(admin),
  );
}
