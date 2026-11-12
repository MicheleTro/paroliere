import { existsSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance } from 'fastify';

import { registerAdminRoutes } from './admin/routes.js';
import { registerAuthRoutes } from './auth/routes.js';
import { registerChallengeRoutes } from './challenges/routes.js';
import { registerHistoryRoutes } from './history/routes.js';
import { registerReportRoutes } from './reports/routes.js';
import { registerStatsRoutes } from './stats/routes.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const here = dirname(fileURLToPath(import.meta.url));
const webDir = process.env.STATIC_DIR ?? join(here, '..', '..', 'web', 'dist');

/**
 * In produzione il server serve anche il frontend già compilato (un'unica immagine, una sola origine).
 * In sviluppo la cartella non esiste e ci pensa Vite. Il service worker e la pagina iniziale non si
 * mettono in cache (così gli aggiornamenti arrivano); gli altri file hanno il nome con l'impronta.
 */
function registerFrontend(app: FastifyInstance): void {
  if (!existsSync(join(webDir, 'index.html'))) return;

  void app.register(fastifyStatic, {
    root: webDir,
    wildcard: false,
    setHeaders(res, path) {
      const name = basename(path);
      const revalidate = name === 'index.html' || name === 'sw.js' || name === 'manifest.webmanifest' || name === 'manifest.json';
      res.header('Cache-Control', revalidate ? 'no-cache' : 'public, max-age=31536000, immutable');
    },
  });

  // Percorsi dell'app (nessun router lato server): pagina iniziale. Gli /api sconosciuti restano 404.
  app.setNotFoundHandler((request, reply) => {
    if (request.method === 'GET' && !request.url.startsWith('/api/')) {
      return reply.header('Cache-Control', 'no-cache').type('text/html').sendFile('index.html');
    }
    return reply.code(404).send({ error: 'Non trovato' });
  });
}

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

  registerFrontend(app);

  return app;
}
