import fp from 'fastify-plugin';
import { pickLanguage, SHARED_CATALOGS, translate, type Language, type Params } from '@cr/contracts';

declare module 'fastify' {
  interface FastifyRequest {
    language: Language;
  }
}

/** Sets `request.language` from Accept-Language; unsupported languages fall back to English. */
export const languagePlugin = fp(async (app) => {
  app.decorateRequest('language', 'en');
  app.addHook('onRequest', async (request) => {
    request.language = pickLanguage(request.headers['accept-language']);
  });
});

export const tr = (language: Language, key: string, params?: Params) =>
  translate(SHARED_CATALOGS, language, key, params);
