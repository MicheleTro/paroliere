import type { FastifyReply, FastifyRequest } from 'fastify';

import { loginUrl } from '../config.js';
import { readCookie, SESSION_COOKIE, verifySession, type PlayerSession } from './session.js';

declare module 'fastify' {
  interface FastifyRequest {
    userId?: string;
    session?: PlayerSession;
  }
}

export const ADMIN_GROUP = 'admin';

export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const token = readCookie(request.headers.cookie, SESSION_COOKIE);
  const session = token ? await verifySession(token) : null;
  if (!session) {
    return reply.code(401).send({ error: 'Accesso richiesto', loginUrl });
  }
  request.session = session;
  request.userId = session.sub;
}

/** Admin = gruppo `admin` di whoru (decisione whoru #24), letto dalla sessione. */
export async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await requireAuth(request, reply);
  if (reply.sent) return;
  if (!request.session?.groups.includes(ADMIN_GROUP)) {
    return reply.code(403).send({ error: 'Accesso negato' });
  }
}
