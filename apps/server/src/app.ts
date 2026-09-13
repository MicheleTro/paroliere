import cors from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';

import { registerAdminRoutes } from './admin/routes.js';
import { registerAuthRoutes } from './auth/routes.js';
import { registerChallengeRoutes } from './challenges/routes.js';
import { config } from './config.js';
import { registerHistoryRoutes } from './history/routes.js';

export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: true });

  void app.register(cors, { origin: config.CORS_ORIGIN, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] });

  app.get('/health', async () => ({ status: 'ok' }));

  registerAuthRoutes(app);
  registerChallengeRoutes(app);
  registerHistoryRoutes(app);
  registerAdminRoutes(app);

  return app;
}
