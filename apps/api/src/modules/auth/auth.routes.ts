import type { FastifyReply } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import {
  changePasswordInput,
  errorBody,
  loginInput,
  meResponse,
  sessionUser,
  type SessionUser,
} from '@cr/contracts';
import { AppError } from '../../shared/errors';
import { createAuthService, sha256 } from './auth.service';
import { newCsrfToken } from './csrf';

export const authRoutes: FastifyPluginAsyncZod = async (app) => {
  const auth = createAuthService(app.db);
  const secure = app.config.COOKIE_SECURE;
  const base = { httpOnly: true, sameSite: 'strict' as const, secure };

  const startSession = async (reply: FastifyReply, user: SessionUser, refreshToken: string) => {
    const access = await reply.jwtSign({ id: user.id, name: user.name, email: user.email, role: user.role });
    reply
      .setCookie('access_token', access, { ...base, path: '/', maxAge: 15 * 60 })
      .setCookie('refresh_token', refreshToken, { ...base, path: '/api/auth', maxAge: 7 * 24 * 3600 })
      .setCookie('csrf_token', newCsrfToken(), {
        ...base,
        httpOnly: false,
        path: '/',
        maxAge: 7 * 24 * 3600,
      });
  };
  const clearSession = (reply: FastifyReply) =>
    reply
      .clearCookie('access_token', { path: '/' })
      .clearCookie('refresh_token', { path: '/api/auth' })
      .clearCookie('csrf_token', { path: '/' });

  app.post(
    '/login',
    {
      config: {
        // preHandler hook: the body (and so the email) is parsed by then.
        rateLimit: {
          hook: 'preHandler',
          max: 5,
          timeWindow: '1 minute',
          keyGenerator: (r) => `${r.ip}:${String((r.body as { email?: string })?.email ?? '').toLowerCase()}`,
        },
      },
      schema: {
        tags: ['auth'],
        body: loginInput,
        response: { 200: z.object({ user: sessionUser }), 401: errorBody },
      },
    },
    async (request, reply) => {
      const result = await auth.login(request.body.email, request.body.password);
      if (!result) throw new AppError('INVALID_CREDENTIALS', 401, 'errors.INVALID_CREDENTIALS');
      if ('disabled' in result) throw new AppError('ACCOUNT_DISABLED', 401, 'errors.ACCOUNT_DISABLED');
      const { user } = result;
      const { token } = await auth.issueRefreshToken(user.id);
      await startSession(reply, user, token);
      return { user };
    },
  );

  app.post(
    '/refresh',
    { schema: { tags: ['auth'], response: { 200: z.object({ user: sessionUser }) } } },
    async (request, reply) => {
      const rotated = request.cookies.refresh_token ? await auth.rotate(request.cookies.refresh_token) : null;
      if (!rotated) {
        clearSession(reply);
        throw new AppError('UNAUTHENTICATED', 401, 'errors.sessionEnded');
      }
      await startSession(reply, rotated.user, rotated.token);
      return { user: rotated.user };
    },
  );

  app.post('/logout', { schema: { tags: ['auth'] } }, async (request, reply) => {
    if (request.cookies.refresh_token) await auth.revoke(request.cookies.refresh_token);
    clearSession(reply).status(204).send();
  });

  app.get(
    '/me',
    {
      preHandler: app.authenticate,
      schema: { tags: ['auth'], response: { 200: meResponse } },
    },
    async (request) => ({
      user: request.user,
      mustChangePassword: request.account!.mustChangePassword,
      preferences: request.account!.preferences,
    }),
  );

  app.post(
    '/change-password',
    {
      preHandler: app.authenticate,
      schema: { tags: ['auth'], body: changePasswordInput },
    },
    async (request, reply) => {
      const keep = request.cookies.refresh_token ? sha256(request.cookies.refresh_token) : undefined;
      await auth.changePassword(
        request.user.id,
        request.body.currentPassword,
        request.body.newPassword,
        keep,
      );
      return reply.status(204).send();
    },
  );
};
