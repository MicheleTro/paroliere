import Fastify, { type FastifyInstance } from 'fastify';

import { registerAdminRoutes } from './admin/routes.js';
import { registerAuthRoutes } from './auth/routes.js';
import { registerChallengeRoutes } from './challenges/routes.js';
import { registerHistoryRoutes } from './history/routes.js';
import { registerReportRoutes } from './reports/routes.js';
import { registerStatsRoutes } from './stats/routes.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: true, trustProxy: true });

  // Frontend e API stanno sulla stessa origine, quindi niente CORS. Difesa contro richieste da altri siti
  // (il cookie di sessione è SameSite=Lax): ogni richiesta che modifica deve venire dalla stessa origine.
  app.addHook('onRequest', async (request, reply) => {
    if (SAFE_METHODS.has(request.method)) return;
    const origin = request.headers.origin;
    if (!origin) return;
    const host = request.headers['x-forwarded-host'] ?? request.headers.host;
    let originHost = '';
    try {
      originHost = new URL(origin).host;
    } catch {
      // origine illeggibile: respinta sotto
    }
    if (originHost !== host) {
      return reply.code(403).send({ error: 'Origine non consentita' });
    }
  });

  app.get('/health', async () => ({ status: 'ok' }));

  void app.register(
    async (api) => {
      registerAuthRoutes(api);
      registerChallengeRoutes(api);
      registerHistoryRoutes(api);
      registerStatsRoutes(api);
      registerReportRoutes(api);
      registerAdminRoutes(api);
    },
    { prefix: '/api' },
  );

  return app;
}
