import cors from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';

import { registerAuthRoutes } from './auth/routes.js';
import { config } from './config.js';

export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: true });

  void app.register(cors, { origin: config.CORS_ORIGIN });

  app.get('/health', async () => ({ status: 'ok' }));

  registerAuthRoutes(app);

  return app;
}
