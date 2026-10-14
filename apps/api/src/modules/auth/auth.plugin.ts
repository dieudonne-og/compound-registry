import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import { eq } from 'drizzle-orm';
import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';
import { can, userPreferences, type Action, type SessionUser, type UserPreferences } from '@cr/contracts';
import { users } from '../../db/schema';
import { AppError, forbidden } from '../../shared/errors';
import { csrfGuard } from './csrf';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: SessionUser;
    user: SessionUser;
  }
}
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: preHandlerHookHandler;
    authorize: (action: Action) => preHandlerHookHandler;
  }
  interface FastifyRequest {
    /** The signed-in account as stored now (set by `authenticate`). */
    account: { mustChangePassword: boolean; preferences: UserPreferences } | null;
  }
}

/** Routes a user who must change a temporary password can still reach. */
const MUST_CHANGE_ALLOWED = new Set([
  '/api/auth/me',
  '/api/auth/logout',
  '/api/auth/change-password',
  '/api/me/preferences',
]);

export const authPlugin = fp(async (app) => {
  await app.register(jwt, {
    secret: app.config.JWT_SECRET,
    cookie: { cookieName: 'access_token', signed: false },
    sign: { expiresIn: '15m' },
  });

  app.addHook('onRequest', csrfGuard);
  app.decorateRequest('account', null);

  const authenticate = async (request: FastifyRequest, _reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch {
      throw new AppError('UNAUTHENTICATED', 401, 'errors.UNAUTHENTICATED');
    }
    // The token proves who signed in; the account row decides what they may do now, so disabling an
    // account or changing a role takes effect on the very next request rather than when the token expires.
    const [account] = await app.db
      .select({
        name: users.name,
        role: users.role,
        active: users.active,
        mustChangePassword: users.mustChangePassword,
        preferences: users.preferences,
      })
      .from(users)
      .where(eq(users.id, request.user.id))
      .limit(1);
    if (!account?.active) throw new AppError('ACCOUNT_DISABLED', 401, 'errors.ACCOUNT_DISABLED');
    request.user = { ...request.user, name: account.name, role: account.role };
    request.account = {
      mustChangePassword: account.mustChangePassword,
      preferences: userPreferences.parse(account.preferences),
    };
    if (account.mustChangePassword && !MUST_CHANGE_ALLOWED.has(request.routeOptions.url ?? '')) {
      throw new AppError('PASSWORD_CHANGE_REQUIRED', 403, 'errors.PASSWORD_CHANGE_REQUIRED');
    }
  };
  app.decorate('authenticate', authenticate);
  app.decorate('authorize', (action: Action) => async (request: FastifyRequest, reply: FastifyReply) => {
    await authenticate(request, reply);
    if (!can(request.user, action)) throw forbidden();
  });
});
