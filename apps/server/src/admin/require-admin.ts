import type { FastifyReply, FastifyRequest } from 'fastify';

import { verifyAdminToken } from '../auth/jwt.js';

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const header = request.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
  if (!token) {
    return reply.code(401).send({ error: 'Token di accesso mancante' });
  }

  try {
    const isAdmin = await verifyAdminToken(token);
    if (!isAdmin) {
      return reply.code(403).send({ error: 'Accesso negato' });
    }
  } catch {
    return reply.code(401).send({ error: 'Token di accesso non valido o scaduto' });
  }
}
