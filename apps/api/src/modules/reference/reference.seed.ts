import type { Database } from '../../db/client';
import { businessLocations, companies, mineralTypes, traceabilityAgents } from '../../db/schema';

const now = () => new Date();

export async function seedReference(db: Database) {
  const existing = await db.select({ id: companies.id }).from(companies).limit(1);
  if (existing.length) return;

  await db
    .insert(companies)
    .values(
      [
        'Akagera Minerals Ltd',
        'Virunga Tin Company',
        'Nyabarongo Mining Cooperative',
        'Kivu Ores Trading',
      ].map((name) => ({ name, createdAt: now() })),
    );
  await db
    .insert(businessLocations)
    .values(
      ['Gikondo Warehouse', 'Rutongo Mine Site', 'Musanze Collection Point', 'Rubavu Processing Plant'].map(
        (name) => ({ name, createdAt: now() }),
      ),
    );
  await db
    .insert(traceabilityAgents)
    .values(
      [
        'Northern Region Traceability Desk',
        'Western Region Traceability Desk',
        'Kigali Export Verification Unit',
      ].map((name) => ({ name, createdAt: now() })),
    );
  await db.insert(mineralTypes).values(
    [
      ['SN', 'Cassiterite (Tin)'],
      ['TA', 'Coltan (Tantalum)'],
      ['W', 'Wolframite (Tungsten)'],
      ['AU', 'Gold'],
      ['BE', 'Beryl'],
    ].map(([code, name]) => ({ code: code!, name: name!, createdAt: now() })),
  );
}
