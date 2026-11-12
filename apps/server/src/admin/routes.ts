import type { FastifyInstance } from 'fastify';
import { desc, eq } from 'drizzle-orm';

import { db } from '../db/client.js';
import * as schema from '../db/schema.js';
import { users } from '../db/schema.js';
import { requireAdmin } from '../auth/require-auth.js';

const RECENT_GAMES_LIMIT = 20;

export function registerAdminRoutes(app: FastifyInstance): void {
  app.get('/admin/users', { preHandler: requireAdmin }, async (_request, reply) => {
    const rows = await db
      .select({ id: users.id, username: users.username, createdAt: users.createdAt, lastSeenAt: users.lastSeenAt })
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
