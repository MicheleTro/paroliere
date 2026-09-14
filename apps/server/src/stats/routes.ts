import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { requireAuth } from '../auth/require-auth.js';
import { db } from '../db/client.js';
import * as schema from '../db/schema.js';

const wordStatsQuerySchema = z.object({
  gridSize: z.coerce.number().int(),
  durationMs: z.coerce.number().int(),
});

export interface WordStatsResponse {
  gridSize: number;
  durationMs: number;
  gamesPlayed: number;
  longestWord: string | null;
  longestWordLength: number;
  averageWordLength: number;
  averageWordsPerGame: number;
  maxWordsInGame: number;
  lastPlayedAt: Date | null;
}

function toResponse(gridSize: number, durationMs: number, row?: typeof schema.playerWordStats.$inferSelect): WordStatsResponse {
  if (!row) {
    return {
      gridSize,
      durationMs,
      gamesPlayed: 0,
      longestWord: null,
      longestWordLength: 0,
      averageWordLength: 0,
      averageWordsPerGame: 0,
      maxWordsInGame: 0,
      lastPlayedAt: null,
    };
  }
  return {
    gridSize: row.gridSize,
    durationMs: row.durationMs,
    gamesPlayed: row.gamesPlayed,
    longestWord: row.longestWord,
    longestWordLength: row.longestWordLength,
    averageWordLength: row.totalWords > 0 ? row.totalWordLengthSum / row.totalWords : 0,
    averageWordsPerGame: row.gamesPlayed > 0 ? row.totalWords / row.gamesPlayed : 0,
    maxWordsInGame: row.maxWordsInGame,
    lastPlayedAt: row.lastPlayedAt,
  };
}

export function registerStatsRoutes(app: FastifyInstance): void {
  app.get('/users/me/word-stats', { preHandler: requireAuth }, async (request, reply) => {
    const query = wordStatsQuerySchema.safeParse(request.query);
    if (!query.success) return reply.code(400).send({ error: query.error.flatten() });

    const [row] = await db
      .select()
      .from(schema.playerWordStats)
      .where(
        and(
          eq(schema.playerWordStats.userId, request.userId!),
          eq(schema.playerWordStats.gridSize, query.data.gridSize),
          eq(schema.playerWordStats.durationMs, query.data.durationMs),
        ),
      )
      .limit(1);

    return reply.send(toResponse(query.data.gridSize, query.data.durationMs, row));
  });
}
