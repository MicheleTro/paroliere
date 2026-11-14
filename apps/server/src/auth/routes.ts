import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { config, loginUrl, portalUrl } from '../config.js';
import { db } from '../db/client.js';
import { profiles, users } from '../db/schema.js';
import { verifyPortalToken } from './portal-token.js';
import { ADMIN_GROUP, requireAuth } from './require-auth.js';
import { clearedSessionCookie, sessionCookie, signSession, type PlayerSession } from './session.js';

/** Registra (o aggiorna) la riga sottile dell'utente: chiave `sub`, il nome serve solo per mostrarlo. */
async function rememberUser(session: PlayerSession): Promise<void> {
  await db
    .insert(users)
    .values({ id: session.sub, username: session.username })
    .onConflictDoUpdate({ target: users.id, set: { username: session.username, lastSeenAt: new Date() } });
}

export function registerAuthRoutes(app: FastifyInstance): void {
  // Ritorno dal portale: scambia il token breve con la sessione del gioco e toglie il token dall'indirizzo.
  app.get('/auth/callback', async (request, reply) => {
    const query = z.object({ token: z.string().min(20).max(4096) }).safeParse(request.query);
    const session = query.success ? await verifyPortalToken(query.data.token) : null;
    if (!session) {
      // Token scaduto, già usato o non valido: si riparte dal portale
      return reply.header('Cache-Control', 'no-store').redirect(loginUrl);
    }
    await rememberUser(session);
    return reply
      .header('Set-Cookie', sessionCookie(await signSession(session)))
      .header('Cache-Control', 'no-store')
      .header('Referrer-Policy', 'no-referrer')
      .redirect('/');
  });

  app.get('/auth/me', { preHandler: requireAuth }, async (request, reply) => {
    const session = request.session!;
    return reply.header('Cache-Control', 'no-store').send({
      id: session.sub,
      username: session.username,
      isAdmin: session.groups.includes(ADMIN_GROUP),
      loginUrl,
      portalUrl,
    });
  });

  // Esce dal gioco (la sessione del portale resta: si esce da lì).
  app.post('/auth/logout', async (_request, reply) => {
    return reply.header('Set-Cookie', clearedSessionCookie()).code(204).send();
  });

  // Solo sviluppo (DEV_LOGIN=true, mai in produzione): entra senza portale. /api/auth/dev?user=mario&admin=1
  if (config.DEV_LOGIN) {
    app.get('/auth/dev', async (request, reply) => {
      const q = z
        .object({
          user: z.string().min(1).max(32).default('dev'),
          admin: z.string().optional(),
          /** Solo sviluppo: porta l'utente a quel totale di XP (es. xp=2000 per sbloccare le sfide). */
          xp: z.coerce.number().int().min(0).max(10_000_000).optional(),
          /** Solo sviluppo: salta il benvenuto e la prima partita guidata (onboarded=1). */
          onboarded: z.string().optional(),
        })
        .parse(request.query);
      const session: PlayerSession = {
        sub: `dev-${q.user}`,
        username: q.user,
        groups: q.admin ? [ADMIN_GROUP, 'membri'] : ['membri'],
      };
      await rememberUser(session);
      if (q.xp !== undefined || q.onboarded) {
        const changes = {
          ...(q.xp !== undefined ? { totalXp: q.xp } : {}),
          ...(q.onboarded ? { onboardedAt: new Date() } : {}),
        };
        await db
          .insert(profiles)
          .values({ userId: session.sub, ...changes })
          .onConflictDoUpdate({ target: profiles.userId, set: changes });
      }
      return reply.header('Set-Cookie', sessionCookie(await signSession(session))).redirect('/');
    });
  }
}
