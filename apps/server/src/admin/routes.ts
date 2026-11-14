import type { FastifyInstance } from 'fastify';
import { levelFromXp } from '@paroliere/core';
import { z } from 'zod';

import { isUniqueViolation } from '../db/errors.js';
import { count, desc, eq, sql } from 'drizzle-orm';

import { db } from '../db/client.js';
import { getInventory } from '../items/service.js';
import * as schema from '../db/schema.js';
import { users } from '../db/schema.js';
import { requireAdmin } from '../auth/require-auth.js';

const RECENT_GAMES_LIMIT = 20;

const presetFields = {
  name: z.string().min(1).max(64),
  description: z.string().max(400),
  size: z.union([z.literal(4), z.literal(5), z.literal(6)]),
  durationMs: z.number().int().min(10_000).max(10 * 60_000),
  minWordLength: z.number().int().min(1).max(10),
  minWords: z.number().int().min(1).max(500),
  bonusCells: z.array(z.number().int().min(2).max(10)).max(8),
  combo: z.boolean(),
  pointMode: z.enum(['standard', 'speciale']),
  positionBonus: z.boolean(),
  active: z.boolean(),
};
const presetCreateSchema = z.object({ slug: z.string().regex(/^[a-z0-9-]{2,32}$/), ...presetFields });
const presetUpdateSchema = z.object(presetFields).partial();
const planSchema = z.array(z.object({ dayIndex: z.number().int().min(0).max(6), presetId: z.string().uuid() })).length(7);

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

    const [profile] = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, id));
    const [{ n: wordCount = 0 } = {}] = await db.select({ n: count() }).from(schema.foundWords).where(eq(schema.foundWords.userId, id));
    const medalRows = await db.select({ id: schema.medals.medalId }).from(schema.medals).where(eq(schema.medals.userId, id));

    const recent = await db
      .select({
        id: schema.plays.id,
        mode: schema.plays.mode,
        status: schema.plays.status,
        size: sql<number>`(${schema.plays.config}->>'size')::int`,
        durationMs: schema.plays.durationMs,
        score: schema.plays.score,
        wordCount: schema.plays.wordCount,
        startedAt: schema.plays.startedAt,
      })
      .from(schema.plays)
      .where(eq(schema.plays.userId, id))
      .orderBy(desc(schema.plays.startedAt))
      .limit(RECENT_GAMES_LIMIT);

    const totalXp = profile?.totalXp ?? 0;
    return reply.send({
      profile: {
        totalXp,
        level: levelFromXp(totalXp).level,
        words: Number(wordCount),
        gamesPlayed: profile?.gamesPlayed ?? 0,
        streakDays: profile?.streakDays ?? 0,
        streakCycles: profile?.streakCycles ?? 0,
        items: await getInventory(id, db),
        longestWord: profile?.longestWord ?? null,
        medals: medalRows.map((m) => m.id),
      },
      recentPlays: recent.map((g) => ({
        id: g.id,
        mode: g.mode,
        status: g.status,
        size: g.size,
        durationMs: g.durationMs,
        score: g.score,
        wordCount: g.wordCount,
        startedAt: g.startedAt,
      })),
    });
  });

  // --- Preset di partita e piano della Settimana (decisione whoru #29): modificabili senza rilasciare ---
  app.get('/admin/presets', { preHandler: requireAdmin }, async (_request, reply) => {
    const rows = await db.select().from(schema.gamePresets).orderBy(schema.gamePresets.createdAt);
    return reply.send(rows);
  });

  app.post('/admin/presets', { preHandler: requireAdmin }, async (request, reply) => {
    const body = presetCreateSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    try {
      const [row] = await db.insert(schema.gamePresets).values(body.data).returning();
      return reply.code(201).send(row);
    } catch (error) {
      if (isUniqueViolation(error)) return reply.code(409).send({ error: 'Esiste già un preset con questo identificativo' });
      throw error;
    }
  });

  app.put('/admin/presets/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = presetUpdateSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    const [current] = await db.select().from(schema.gamePresets).where(eq(schema.gamePresets.id, id));
    if (!current) return reply.code(404).send({ error: 'Preset non trovato' });
    if (current.slug === 'gioca' && body.data.active === false) {
      return reply.code(400).send({ error: 'Il preset della partita libera non si può disattivare' });
    }
    const [row] = await db.update(schema.gamePresets).set(body.data).where(eq(schema.gamePresets.id, id)).returning();
    return reply.send(row);
  });

  app.get('/admin/week-plan', { preHandler: requireAdmin }, async (_request, reply) => {
    const rows = await db
      .select({ dayIndex: schema.weekPlan.dayIndex, presetId: schema.weekPlan.presetId, name: schema.gamePresets.name })
      .from(schema.weekPlan)
      .innerJoin(schema.gamePresets, eq(schema.gamePresets.id, schema.weekPlan.presetId))
      .orderBy(schema.weekPlan.dayIndex);
    return reply.send(rows);
  });

  // Vale per le griglie non ancora create: quelle già create restano come sono
  app.put('/admin/week-plan', { preHandler: requireAdmin }, async (request, reply) => {
    const body = planSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    const days = new Set(body.data.map((d) => d.dayIndex));
    if (days.size !== 7) return reply.code(400).send({ error: 'Servono esattamente 7 giorni, da 0 a 6' });
    const presets = await db.select({ id: schema.gamePresets.id, active: schema.gamePresets.active }).from(schema.gamePresets);
    const active = new Set(presets.filter((p) => p.active).map((p) => p.id));
    if (body.data.some((d) => !active.has(d.presetId))) return reply.code(400).send({ error: 'Preset inesistente o disattivato' });

    await db.transaction(async (tx) => {
      for (const day of body.data) {
        await tx
          .insert(schema.weekPlan)
          .values(day)
          .onConflictDoUpdate({ target: schema.weekPlan.dayIndex, set: { presetId: day.presetId } });
      }
    });
    return reply.code(204).send();
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
