import type { Database } from '../../db/client';
import { users } from '../../db/schema';
import { hashPassword } from './password';

export const DEMO_USERS = [
  { name: 'Alice Uwase', email: 'admin@example.com', role: 'admin' },
  { name: 'Eric Habimana', email: 'supervisor@example.com', role: 'supervisor' },
  { name: 'Grace Mukamana', email: 'operator@example.com', role: 'operator' },
  { name: 'Patrick Niyonzima', email: 'auditor@example.com', role: 'auditor' },
] as const;

export async function seedUsers(db: Database, password: string) {
  const existing = await db.select({ id: users.id }).from(users).limit(1);
  if (existing.length) return;
  const passwordHash = await hashPassword(password);
  await db.insert(users).values(DEMO_USERS.map((u) => ({ ...u, passwordHash, createdAt: new Date() })));
}
