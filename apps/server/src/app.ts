import Fastify, { type FastifyInstance } from 'fastify';

import { registerAuthRoutes } from './auth/routes.js';

export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: true });

  app.get('/health', async () => ({ status: 'ok' }));

  registerAuthRoutes(app);

  return app;
}
