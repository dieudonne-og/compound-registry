export type UserSeedPlan = { kind: 'demo' } | { kind: 'admin'; email: string; password: string };

const MIN_PASSWORD = 12;

/**
 * Demo accounts with a published password are only created outside production or when demo data
 * is explicitly requested. A production database starts with one administrator from the environment.
 */
export function userSeedPlan(input: {
  nodeEnv: string;
  demo: boolean;
  adminEmail?: string;
  adminPassword?: string;
}): UserSeedPlan {
  if (input.nodeEnv !== 'production' || input.demo) return { kind: 'demo' };
  if (!input.adminEmail || !input.adminPassword) {
    throw new Error(
      'No users exist yet. Set ADMIN_EMAIL and ADMIN_PASSWORD to create the first administrator.',
    );
  }
  if (input.adminPassword.length < MIN_PASSWORD) {
    throw new Error(`ADMIN_PASSWORD must be at least ${MIN_PASSWORD} characters.`);
  }
  return { kind: 'admin', email: input.adminEmail.trim().toLowerCase(), password: input.adminPassword };
}
