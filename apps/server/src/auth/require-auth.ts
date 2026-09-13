import type { FastifyReply, FastifyRequest } from 'fastify';

import { verifyAccessToken } from './jwt.js';

declare module 'fastify' {
  interface FastifyRequest {
    userId?: string;
  }
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const header = request.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
  if (!token) {
    return reply.code(401).send({ error: 'Token di accesso mancante' });
  }

  try {
    request.userId = await verifyAccessToken(token);
  } catch {
    return reply.code(401).send({ error: 'Token di accesso non valido o scaduto' });
  }
}
