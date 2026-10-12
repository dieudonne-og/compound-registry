import { and, asc, desc, eq, gte, like, lte, or, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/mysql-core';
import type { ProductionListQuery, ProductionRecord } from '@cr/contracts';
import type { Database, Tx } from '../../db/client';
import {
  businessLocations,
  companies,
  mineralTypes,
  production,
  traceabilityAgents,
  users,
} from '../../db/schema';

const creator = alias(users, 'creator');
const updater = alias(users, 'updater');

export function selectProduction(conn: Database | Tx) {
  return conn
    .select({
      p: production,
      mineral: { id: mineralTypes.id, code: mineralTypes.code, name: mineralTypes.name },
      location: { id: businessLocations.id, name: businessLocations.name },
      agent: { id: traceabilityAgents.id, name: traceabilityAgents.name },
      company: { id: companies.id, name: companies.name },
      creator: { id: creator.id, name: creator.name },
      updater: { id: updater.id, name: updater.name },
    })
    .from(production)
    .innerJoin(mineralTypes, eq(mineralTypes.id, production.mineralTypeId))
    .innerJoin(businessLocations, eq(businessLocations.id, production.businessLocationId))
    .innerJoin(traceabilityAgents, eq(traceabilityAgents.id, production.traceabilityAgentId))
    .innerJoin(companies, eq(companies.id, production.companyId))
    .innerJoin(creator, eq(creator.id, production.createdBy))
    .leftJoin(updater, eq(updater.id, production.updatedBy));
}

type Row = Awaited<ReturnType<ReturnType<typeof selectProduction>['execute']>>[number];

export const toRecord = (r: Row): ProductionRecord => ({
  id: r.p.id,
  productionCode: r.p.productionCode,
  tagNumber: r.p.tagNumber,
  productionDate: r.p.productionDate,
  weightKg: r.p.weightKg,
  mineralType: r.mineral,
  businessLocation: r.location,
  traceabilityAgent: r.agent,
  company: r.company,
  operatorRepresentative: r.p.operatorRepresentative,
  version: r.p.version,
  createdBy: r.creator,
  createdAt: r.p.createdAt.toISOString(),
  updatedBy: r.updater?.id ? { id: r.updater.id, name: r.updater.name! } : null,
  updatedAt: r.p.updatedAt.toISOString(),
});

const escapeLike = (s: string) => s.replace(/[\\%_]/g, '\\$&');

export function filtersFor(q: Omit<ProductionListQuery, 'page' | 'pageSize' | 'sort'>): SQL | undefined {
  const term = q.q ? `%${escapeLike(q.q.toUpperCase())}%` : null;
  return and(
    term ? or(like(production.productionCode, term), like(production.tagNumber, term)) : undefined,
    q.mineralTypeId ? eq(production.mineralTypeId, q.mineralTypeId) : undefined,
    q.companyId ? eq(production.companyId, q.companyId) : undefined,
    q.locationId ? eq(production.businessLocationId, q.locationId) : undefined,
    q.from ? gte(production.productionDate, q.from) : undefined,
    q.to ? lte(production.productionDate, q.to) : undefined,
  );
}

const SORTABLE = {
  createdAt: production.createdAt,
  productionDate: production.productionDate,
  weightKg: production.weightKg,
  tagNumber: production.tagNumber,
} as const;

export function orderFor(sort: ProductionListQuery['sort']) {
  const descending = sort.startsWith('-');
  const column = SORTABLE[sort.replace('-', '') as keyof typeof SORTABLE];
  return [descending ? desc(column) : asc(column), desc(production.id)];
}
