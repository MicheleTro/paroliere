import { desc, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { requireAuth } from '../auth/require-auth.js';
import { db } from '../db/client.js';
import * as schema from '../db/schema.js';

const foundWordSchema = z.object({
  word: z.string().min(1),
  path: z.array(z.number().int()),
  points: z.number().int(),
});

const gameConfigSchema = z.object({
  seed: z.number().int(),
  size: z.union([z.literal(3), z.literal(4), z.literal(5), z.literal(6)]),
  durationMs: z.number().int().positive(),
  minWordLength: z.number().int().min(1),
  minWords: z.number().int().min(1),
  scoring: z.enum(['classic', 'versus']),
  generatorVersion: z.literal(1),
  dictionaryVersion: z.string().min(1),
});

const gameRecordSchema = z.object({
  id: z.string().uuid(),
  config: gameConfigSchema,
  score: z.number().int(),
  foundWords: z.array(foundWordSchema),
  playedAt: z.number().int(),
});

const syncSchema = z.object({ games: z.array(gameRecordSchema) });

export function registerHistoryRoutes(app: FastifyInstance): void {
  app.get('/users/me/history', { preHandler: requireAuth }, async (request, reply) => {
    const rows = await db
      .select()
      .from(schema.games)
      .where(eq(schema.games.userId, request.userId!))
      .orderBy(desc(schema.games.startedAt));
    return reply.send(rows);
  });

  app.post('/users/me/history/sync', { preHandler: requireAuth }, async (request, reply) => {
    const body = syncSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });

    for (const game of body.data.games) {
      await db.transaction(async (tx) => {
        const [configRow] = await tx.insert(schema.gameConfigs).values(game.config).returning();
        await tx
          .insert(schema.games)
          .values({
            id: game.id,
            userId: request.userId!,
            configId: configRow!.id,
            seed: game.config.seed,
            startedAt: new Date(game.playedAt),
            score: game.score,
            words: game.foundWords,
            source: 'local',
          })
          .onConflictDoNothing({ target: schema.games.id });
      });
    }

    return reply.code(204).send();
  });
}
