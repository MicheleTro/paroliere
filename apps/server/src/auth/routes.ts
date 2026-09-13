import type { FastifyInstance } from 'fastify';
import { eq, or } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '../db/client.js';
import { isUniqueViolation } from '../db/errors.js';
import { users } from '../db/schema.js';
import { signAccessToken } from './jwt.js';
import { hashPassword, verifyPassword } from './password.js';
import { requireAuth } from './require-auth.js';

const registerSchema = z.object({
  username: z.string().min(3).max(32),
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
});

const loginSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
});

export function registerAuthRoutes(app: FastifyInstance): void {
  app.post('/auth/register', async (request, reply) => {
    const body = registerSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: body.error.flatten() });
    }

    const { username, email, password } = body.data;
    const passwordHash = await hashPassword(password);

    try {
      const [user] = await db.insert(users).values({ username, email, passwordHash }).returning();
      if (!user) {
        throw new Error('Inserimento utente senza risultato');
      }
      const token = await signAccessToken(user.id);
      return reply.code(201).send({ token });
    } catch (error) {
      if (isUniqueViolation(error)) {
        return reply.code(409).send({ error: 'Username o email già registrati' });
      }
      throw error;
    }
  });

  app.post('/auth/login', async (request, reply) => {
    const body = loginSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: body.error.flatten() });
    }

    const { identifier, password } = body.data;
    const [user] = await db
      .select()
      .from(users)
      .where(or(eq(users.username, identifier), eq(users.email, identifier)))
      .limit(1);

    const invalidCredentials = () => reply.code(401).send({ error: 'Credenziali non valide' });

    if (!user) {
      return invalidCredentials();
    }

    const passwordValid = await verifyPassword(user.passwordHash, password);
    if (!passwordValid) {
      return invalidCredentials();
    }

    const token = await signAccessToken(user.id);
    return reply.send({ token });
  });

  app.get('/auth/me', { preHandler: requireAuth }, async (request, reply) => {
    const [user] = await db.select().from(users).where(eq(users.id, request.userId!)).limit(1);
    if (!user) {
      return reply.code(401).send({ error: 'Utente non trovato' });
    }
    return reply.send({ id: user.id, username: user.username, email: user.email, createdAt: user.createdAt });
  });
}
