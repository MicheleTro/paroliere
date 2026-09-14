import type { FastifyInstance } from 'fastify';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';

import { signAdminToken } from '../auth/jwt.js';
import { db } from '../db/client.js';
import * as schema from '../db/schema.js';
import { users } from '../db/schema.js';
import { verifyPassword } from '../auth/password.js';
import { requireAdmin } from './require-admin.js';

const RECENT_GAMES_LIMIT = 20;

const ADMIN_USERNAME = 'admin';
// argon2 di "qweqweqwe!" — mai la password in chiaro nel codice/commit.
const ADMIN_PASSWORD_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$Se9DJ7fRgm+/9n0vuLfccQ$7AlyQTOfV/xfIiTRU/RUzb7lBMpIWH+m9geAVh7CrS8';

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export function registerAdminRoutes(app: FastifyInstance): void {
  app.post('/admin/login', async (request, reply) => {
    const body = loginSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: body.error.flatten() });
    }

    const invalidCredentials = () => reply.code(401).send({ error: 'Credenziali non valide' });

    const { username, password } = body.data;
    if (username !== ADMIN_USERNAME) {
      return invalidCredentials();
    }
    if (!(await verifyPassword(ADMIN_PASSWORD_HASH, password))) {
      return invalidCredentials();
    }

    const token = await signAdminToken();
    return reply.send({ token });
  });

  app.get('/admin/users', { preHandler: requireAdmin }, async (_request, reply) => {
    const rows = await db
      .select({ id: users.id, username: users.username, email: users.email, createdAt: users.createdAt })
      .from(users)
      .orderBy(users.createdAt);
    return reply.send(rows);
  });

  app.get('/admin/users/:id/stats', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const wordStatsRows = await db
      .select()
      .from(schema.playerWordStats)
      .where(eq(schema.playerWordStats.userId, id))
      .orderBy(schema.playerWordStats.gridSize, schema.playerWordStats.durationMs);
    const wordStats = wordStatsRows.map((row) => ({
      gridSize: row.gridSize,
      durationMs: row.durationMs,
      gamesPlayed: row.gamesPlayed,
      longestWord: row.longestWord,
      longestWordLength: row.longestWordLength,
      averageWordLength: row.totalWords > 0 ? row.totalWordLengthSum / row.totalWords : 0,
      averageWordsPerGame: row.gamesPlayed > 0 ? row.totalWords / row.gamesPlayed : 0,
      lastPlayedAt: row.lastPlayedAt,
    }));

    const recentGames = await db
      .select({
        id: schema.games.id,
        size: schema.gameConfigs.size,
        durationMs: schema.gameConfigs.durationMs,
        score: schema.games.score,
        words: schema.games.words,
        source: schema.games.source,
        startedAt: schema.games.startedAt,
      })
      .from(schema.games)
      .innerJoin(schema.gameConfigs, eq(schema.gameConfigs.id, schema.games.configId))
      .where(eq(schema.games.userId, id))
      .orderBy(desc(schema.games.startedAt))
      .limit(RECENT_GAMES_LIMIT);

    return reply.send({
      wordStats,
      recentGames: recentGames.map((g) => ({
        id: g.id,
        size: g.size,
        durationMs: g.durationMs,
        score: g.score,
        wordCount: g.words.length,
        source: g.source,
        startedAt: g.startedAt,
      })),
    });
  });

  app.delete('/admin/users/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const deleted = await db.delete(users).where(eq(users.id, id)).returning({ id: users.id });
    if (deleted.length === 0) {
      return reply.code(404).send({ error: 'Utente non trovato' });
    }
    return reply.code(204).send();
  });
}
