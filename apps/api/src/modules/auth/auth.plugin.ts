import fp from 'fastify-plugin';
import jwt from '@fastify/jwt';
import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';
import { can, type Action, type SessionUser } from '@cr/contracts';
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
}

export const authPlugin = fp(async (app) => {
  await app.register(jwt, {
    secret: app.config.JWT_SECRET,
    cookie: { cookieName: 'access_token', signed: false },
    sign: { expiresIn: '15m' },
  });

  app.addHook('onRequest', csrfGuard);

  const authenticate = async (request: FastifyRequest, _reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch {
      throw new AppError('UNAUTHENTICATED', 401, 'Please sign in to continue.');
    }
  };
  app.decorate('authenticate', authenticate);
  app.decorate('authorize', (action: Action) => async (request: FastifyRequest, reply: FastifyReply) => {
    await authenticate(request, reply);
    if (!can(request.user, action)) throw forbidden();
  });
});
