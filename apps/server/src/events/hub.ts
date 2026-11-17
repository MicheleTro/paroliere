import type { ServerResponse } from 'node:http';

import type { FastifyInstance } from 'fastify';

import { requireAuth } from '../auth/require-auth.js';

/**
 * Aggiornamenti in tempo reale verso il browser (Server-Sent Events): quando una sfida cambia stato il server
 * avvisa i due giocatori, e le schermate si ricaricano da sole. Solo in memoria: un'istanza del server, e chi
 * non è collegato in quel momento vede lo stato aggiornato alla prossima lettura.
 */

export interface ServerEvent {
  type: 'duel';
  duelId: string;
  /** Testo per la notifica del browser; assente quando basta aggiornare la schermata. */
  notify?: { title: string; body: string };
}

const HEARTBEAT_MS = 25_000;
const streams = new Map<string, Set<ServerResponse>>();

export function publish(userId: string, event: ServerEvent): void {
  const targets = streams.get(userId);
  if (!targets) return;
  const frame = `data: ${JSON.stringify(event)}\n\n`;
  for (const res of targets) res.write(frame);
}

export function registerEventRoutes(app: FastifyInstance): void {
  app.get('/events', { preHandler: requireAuth }, (request, reply) => {
    const userId = request.userId!;
    reply.hijack();
    const res = reply.raw;
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
      // proxy davanti al server (Traefik/nginx): niente buffer, gli eventi devono passare subito
      'X-Accel-Buffering': 'no',
    });
    res.write('retry: 5000\n: ok\n\n');

    const set = streams.get(userId) ?? new Set();
    set.add(res);
    streams.set(userId, set);

    const heartbeat = setInterval(() => res.write(': ping\n\n'), HEARTBEAT_MS);
    request.raw.on('close', () => {
      clearInterval(heartbeat);
      set.delete(res);
      if (set.size === 0) streams.delete(userId);
    });
  });
}
