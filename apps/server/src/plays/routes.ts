import { randomInt } from 'node:crypto';

import { calendarDay, effectiveStreakDays, levelFromXp } from '@paroliere/core';
import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { requireAuth } from '../auth/require-auth.js';
import { db } from '../db/client.js';
import * as schema from '../db/schema.js';
import { loadDictionary } from '../dictionary.js';
import { AIUTO_10S, getInventory, itemQuantity } from '../items/service.js';
import { awardPlay, duelsAvailable, recordPlayStarted, savePlayResult, type PlayRow, type SettleResult, type Tx } from '../progress/service.js';
import { frozenGrid } from '../week/service.js';
import { gradeOnGrid, gradeSubmission } from './grading.js';
import { getPresetBySlug, GIOCA_SLUG, presetToConfig } from './presets.js';

const MAX_SEED = 2 ** 31 - 1;
/** Margine oltre la durata concessa, per i ritardi di rete e dell'avvio. */
export const SUBMIT_MARGIN_MS = 15_000;

const startSchema = z.object({ mode: z.literal('gioca') });
const finishSchema = z.object({
  words: z.array(z.object({ path: z.array(z.number().int().nonnegative()).max(64), atMs: z.number().min(0).max(3_600_000) })).max(2_000),
});
const idParams = z.object({ id: z.string().uuid() });

export const isExpired = (play: Pick<PlayRow, 'startedAt' | 'durationMs'>, now = Date.now()): boolean =>
  now - play.startedAt.getTime() > play.durationMs + SUBMIT_MARGIN_MS;

const remainingMs = (play: Pick<PlayRow, 'startedAt' | 'durationMs'>, now = Date.now()): number =>
  Math.max(0, play.durationMs - (now - play.startedAt.getTime()));

/**
 * Una partita lasciata a metà (uscita volontaria o tempo scaduto senza invio): si perdono punteggio, parole e XP.
 * Non conta come partita giocata nei contatori; la serie però l'ha già registrata all'avvio.
 */
export async function abandonPlay(tx: Tx, play: PlayRow): Promise<void> {
  await savePlayResult(tx, play, { status: 'abandoned', words: [], submission: null, score: 0 });
}

function publicPlay(play: PlayRow) {
  return {
    id: play.id,
    mode: play.mode,
    seed: play.seed,
    config: play.config,
    startedAt: play.startedAt,
    durationMs: play.durationMs,
    remainingMs: remainingMs(play),
    helpUsed: play.usedItemId !== null,
  };
}

export async function progressSummary(userId: string) {
  const [profile] = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, userId));
  const totalXp = profile?.totalXp ?? 0;
  return { totalXp, ...levelFromXp(totalXp), helps: await itemQuantity(userId, AIUTO_10S, db), streakDays: profile?.streakDays ?? 0 };
}

export function describeSettle(settle: SettleResult) {
  const before = levelFromXp(Math.max(0, settle.totalXp - settle.xpAwarded));
  const after = levelFromXp(settle.totalXp);
  return {
    xp: settle.xpAwarded,
    starBonus: settle.starBonus,
    newWords: settle.newWords,
    totalXp: settle.totalXp,
    levelBefore: before.level,
    level: after,
    leveledUp: after.level > before.level,
    newMedals: settle.newMedals.map((m) => ({ id: m.id, name: m.name, description: m.description })),
  };
}

export function registerPlayRoutes(app: FastifyInstance): void {
  // Inizia (o riprende) una partita libera. Il seed e l'ora di inizio li decide il server.
  app.post('/plays', { preHandler: requireAuth }, async (request, reply) => {
    if (!startSchema.safeParse(request.body).success) return reply.code(400).send({ error: 'Richiesta non valida' });
    const me = request.userId!;

    const open = await db
      .select()
      .from(schema.plays)
      .where(and(eq(schema.plays.userId, me), eq(schema.plays.mode, 'gioca'), eq(schema.plays.status, 'started')));
    for (const play of open) {
      if (isExpired(play)) {
        await db.transaction((tx) => abandonPlay(tx, play));
      } else {
        return reply.send(publicPlay(play)); // la partita in corso si riprende, non se ne apre un'altra
      }
    }

    const preset = await getPresetBySlug(GIOCA_SLUG);
    const { dictionaryVersion } = loadDictionary();
    const config = presetToConfig(preset, randomInt(0, MAX_SEED), dictionaryVersion);

    const { play, streak } = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(schema.plays)
        .values({
          userId: me,
          mode: 'gioca',
          presetId: preset.id,
          seed: config.seed,
          config,
          durationMs: config.durationMs,
        })
        .returning();
      const streak = await recordPlayStarted(tx, me, row!.startedAt);
      return { play: row!, streak };
    });
    // Se questa partita chiude un ciclo da 10 giorni, il riepilogo mostra il regalo (l'aiuto è già nell'inventario)
    return reply.code(201).send({ ...publicPlay(play), streakCycleCompleted: streak.cycleCompleted });
  });

  // Chiude la partita: il server rivaluta i percorsi, assegna XP, parole nuove e medaglie
  app.post('/plays/:id/finish', { preHandler: requireAuth }, async (request, reply) => {
    const params = idParams.safeParse(request.params);
    const body = finishSchema.safeParse(request.body);
    if (!params.success || !body.success) return reply.code(400).send({ error: 'Richiesta non valida' });
    const me = request.userId!;

    const [play] = await db
      .select()
      .from(schema.plays)
      .where(and(eq(schema.plays.id, params.data.id), eq(schema.plays.userId, me)))
      .limit(1);
    if (!play) return reply.code(404).send({ error: 'Partita non trovata' });
    if (play.status !== 'started') return reply.code(409).send({ error: 'Partita già chiusa' });

    if (isExpired(play)) {
      await db.transaction((tx) => abandonPlay(tx, play));
      return reply.code(409).send({ error: 'Tempo scaduto' });
    }

    // Griglia della Settimana: si rivaluta sulla griglia congelata, non su una rigenerata con il dizionario di oggi
    let words;
    if (play.gridId) {
      const [gridRow] = await db.select().from(schema.weeklyGrids).where(eq(schema.weeklyGrids.id, play.gridId));
      if (!gridRow) return reply.code(500).send({ error: 'Griglia della partita mancante' });
      const { grid, solutions } = frozenGrid(gridRow);
      words = gradeOnGrid(play.config, grid, new Set(solutions.map((s) => s.word)), body.data.words, play.durationMs);
    } else {
      words = gradeSubmission(play.config, loadDictionary().index, body.data.words, play.durationMs);
    }
    const score = words.reduce((sum, w) => sum + w.points, 0);

    const settle = await db.transaction(async (tx) => {
      // Condizione sullo stato: se due invii arrivano insieme, chiude solo il primo
      const claimed = await tx
        .update(schema.plays)
        .set({ status: 'finished' })
        .where(and(eq(schema.plays.id, play.id), eq(schema.plays.status, 'started')))
        .returning({ id: schema.plays.id });
      if (claimed.length === 0) return undefined;
      await savePlayResult(tx, play, {
        status: 'finished',
        words,
        submission: body.data.words,
        score,
      });
      return awardPlay(tx, play.id);
    });
    if (!settle) return reply.code(409).send({ error: 'Partita già chiusa' });

    const saved = await db.select().from(schema.playWords).where(eq(schema.playWords.playId, play.id));
    const newWords = new Set(settle.newWords);
    const progress = await progressSummary(me);
    return reply.send({
      playId: play.id,
      score,
      words: saved
        .sort((a, b) => a.atMs - b.atMs)
        .map((w) => ({ word: w.word, path: w.path, points: w.points, atMs: w.atMs, combo: w.combo, isNew: newWords.has(w.word) })),
      ...describeSettle(settle),
      streakDays: progress.streakDays,
      helps: progress.helps,
    });
  });

  // Uscita volontaria dalla partita (con conferma lato client): si perde tutto
  app.post('/plays/:id/abandon', { preHandler: requireAuth }, async (request, reply) => {
    const params = idParams.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: 'id non valido' });
    const [play] = await db
      .select()
      .from(schema.plays)
      .where(and(eq(schema.plays.id, params.data.id), eq(schema.plays.userId, request.userId!)))
      .limit(1);
    if (!play) return reply.code(404).send({ error: 'Partita non trovata' });
    if (play.status !== 'started') return reply.code(409).send({ error: 'Partita già chiusa' });
    await db.transaction(async (tx) => {
      const claimed = await tx
        .update(schema.plays)
        .set({ status: 'abandoned' })
        .where(and(eq(schema.plays.id, play.id), eq(schema.plays.status, 'started')))
        .returning({ id: schema.plays.id });
      if (claimed.length > 0) await abandonPlay(tx, play);
    });
    return reply.code(204).send();
  });

  // Profilo di chi gioca: livello, XP, serie, aiuti, parole, medaglie
  app.get('/me', { preHandler: requireAuth }, async (request, reply) => {
    const me = request.userId!;
    const progress = await progressSummary(me);
    const [profile] = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, me));
    const wordRows = await db.select({ word: schema.foundWords.word }).from(schema.foundWords).where(eq(schema.foundWords.userId, me));
    const owned = await db
      .select({ id: schema.medals.medalId, earnedAt: schema.medals.earnedAt })
      .from(schema.medals)
      .where(eq(schema.medals.userId, me));
    return reply.header('Cache-Control', 'no-store').send({
      ...progress,
      duelsUnlocked: await duelsAvailable(me),
      items: await getInventory(me, db),
      words: wordRows.length,
      longestWord: profile?.longestWord ?? null,
      gamesPlayed: profile?.gamesPlayed ?? 0,
      streakCycles: profile?.streakCycles ?? 0,
      streak: {
        days: profile ? effectiveStreakDays({ days: profile.streakDays, lastDay: profile.streakLastDay, cycles: profile.streakCycles, helps: 0 }, calendarDay(new Date())) : 0,
        playedToday: profile?.streakLastDay === calendarDay(new Date()),
        cycleLength: 10,
      },
      onboarded: profile?.onboardedAt != null,
      medals: owned,
    });
  });
}
