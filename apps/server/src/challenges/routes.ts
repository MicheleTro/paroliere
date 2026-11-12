import { randomInt } from 'node:crypto';

import {
  computeVersusScores,
  countsTowardStats,
  versusWordValue,
  wordGroupCounts,
  type GameConfig,
  type VersusEntry,
  type WordIndex,
} from '@paroliere/core';
import { and, desc, eq, inArray, or } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { requireAuth } from '../auth/require-auth.js';
import { db } from '../db/client.js';
import { isUniqueViolation } from '../db/errors.js';
import * as schema from '../db/schema.js';
import { loadDictionary } from '../dictionary.js';
import { checkFriend, listFriends, PortalUnavailableError } from '../portal/friends.js';
import { updatePlayerWordStats } from '../stats/word-stats.js';
import { gradeSubmission } from './grading.js';

// Sfide 1 contro 1 su invito (decisione whoru #28): un solo match, lanciate solo contro un amico del portale.

const MAX_SEED = 2 ** 31 - 1;
const MATCH_TIMEOUT_MARGIN_MS = 15_000;
const DUEL_TTL_MS = 7 * 24 * 60 * 60 * 1000; // senza risposta o senza partite entro 7 giorni la sfida scade
const MAX_ACTIVE_AS_CHALLENGER = 10;

const gameConfigInputSchema = z.object({
  size: z.union([z.literal(4), z.literal(5), z.literal(6)]),
  durationMs: z.number().int().positive().max(10 * 60_000),
  minWordLength: z.number().int().min(1).max(10),
  minWords: z.number().int().min(1).max(500),
  scoring: z.enum(['classic', 'versus']),
  pointMode: z.enum(['standard', 'speciale']).default('standard'),
  positionBonus: z.boolean().default(false),
});

const createSchema = z.object({
  opponentId: z.string().min(1).max(64),
  config: gameConfigInputSchema,
});
const respondSchema = z.object({ accept: z.boolean() });
const submitSchema = z.object({ paths: z.array(z.array(z.number().int().nonnegative())) });
const idParams = z.object({ id: z.string().uuid() });

type DuelRow = typeof schema.duels.$inferSelect;
type ConfigRow = typeof schema.gameConfigs.$inferSelect;

function toGameConfig(row: ConfigRow, seed: number): GameConfig {
  return {
    seed,
    size: row.size as 4 | 5 | 6,
    durationMs: row.durationMs,
    minWordLength: row.minWordLength,
    minWords: row.minWords,
    scoring: row.scoring,
    pointMode: row.pointMode,
    positionBonus: row.positionBonus,
    generatorVersion: 1,
    dictionaryVersion: row.dictionaryVersion,
  };
}

const isParticipant = (duel: DuelRow, userId: string) => duel.challengerId === userId || duel.opponentId === userId;

async function getDuel(id: string): Promise<DuelRow | undefined> {
  const [row] = await db.select().from(schema.duels).where(eq(schema.duels.id, id)).limit(1);
  return row;
}

async function getConfig(id: string): Promise<ConfigRow> {
  const [row] = await db.select().from(schema.gameConfigs).where(eq(schema.gameConfigs.id, id)).limit(1);
  if (!row) throw new Error('Configurazione della sfida mancante');
  return row;
}

/** Punteggi dei due giocatori dalle parole valide di ciascuno (versus: la parola in comune vale la base, quella unica il doppio). */
function scoreResults(
  configRow: ConfigRow,
  index: WordIndex,
  seed: number,
  results: (typeof schema.duelResults.$inferSelect)[],
) {
  const gameConfig = toGameConfig(configRow, seed);
  const gradedByUser = new Map(results.map((r) => [r.userId, gradeSubmission(gameConfig, index, r.paths)]));
  const entries: VersusEntry[] = [...gradedByUser.entries()].map(([userId, graded]) => ({
    participantId: userId,
    groupId: userId,
    words: new Map(graded.map((g) => [g.word, g.points])),
  }));
  const counts = configRow.scoring === 'versus' ? wordGroupCounts(entries) : undefined;
  const scoreByUser =
    configRow.scoring === 'versus'
      ? new Map(Object.entries(computeVersusScores(entries)))
      : new Map([...gradedByUser.entries()].map(([userId, graded]) => [userId, graded.reduce((sum, g) => sum + g.points, 0)]));
  return { gradedByUser, scoreByUser, counts };
}

/** Chiude la sfida quando hanno giocato entrambi: punteggi, partite nello storico, statistiche. */
async function trySettle(duel: DuelRow, configRow: ConfigRow, index: WordIndex): Promise<boolean> {
  if (duel.status !== 'in_progress') return false;
  const results = await db.select().from(schema.duelResults).where(eq(schema.duelResults.duelId, duel.id));
  const submitted = new Set(results.map((r) => r.userId));
  if (!submitted.has(duel.challengerId) || !submitted.has(duel.opponentId)) return false;

  const { gradedByUser, scoreByUser } = scoreResults(configRow, index, duel.seed, results);

  await db.transaction(async (tx) => {
    // Condizione sullo stato: se due invii arrivano insieme, chiude solo il primo
    const closed = await tx
      .update(schema.duels)
      .set({ status: 'completed', settledAt: new Date() })
      .where(and(eq(schema.duels.id, duel.id), eq(schema.duels.status, 'in_progress')))
      .returning({ id: schema.duels.id });
    if (closed.length === 0) return;

    for (const result of results) {
      const score = scoreByUser.get(result.userId) ?? 0;
      const graded = gradedByUser.get(result.userId) ?? [];
      await tx.update(schema.duelResults).set({ score }).where(eq(schema.duelResults.id, result.id));
      await tx.insert(schema.games).values({
        userId: result.userId,
        configId: duel.configId,
        seed: duel.seed,
        startedAt: result.submittedAt,
        score,
        words: graded,
        source: 'challenge',
      });
      if (countsTowardStats(configRow)) {
        await updatePlayerWordStats(tx, result.userId, configRow.size, configRow.durationMs, graded, result.submittedAt);
      }
    }
  });
  return true;
}

/**
 * Controlli "pigri" (nessun job in background), eseguiti quando una sfida viene letta o aggiornata:
 *  - chi ha iniziato ma non ha inviato entro la durata + margine prende zero punti (come chi ricarica la pagina per riavviare il timer);
 *  - una sfida senza risposta o senza partite da più di 7 giorni scade.
 */
async function refreshDuel(duel: DuelRow): Promise<DuelRow> {
  if (duel.status !== 'invited' && duel.status !== 'in_progress') return duel;

  const reference = duel.status === 'invited' ? duel.createdAt : (duel.respondedAt ?? duel.createdAt);
  if (Date.now() - reference.getTime() > DUEL_TTL_MS) {
    await db
      .update(schema.duels)
      .set({ status: 'expired' })
      .where(and(eq(schema.duels.id, duel.id), eq(schema.duels.status, duel.status)));
    return { ...duel, status: 'expired' };
  }
  if (duel.status !== 'in_progress') return duel;

  const configRow = await getConfig(duel.configId);
  const starts = await db.select().from(schema.duelStarts).where(eq(schema.duelStarts.duelId, duel.id));
  const results = await db.select().from(schema.duelResults).where(eq(schema.duelResults.duelId, duel.id));
  const submitted = new Set(results.map((r) => r.userId));
  for (const start of starts) {
    if (submitted.has(start.userId)) continue;
    if (Date.now() - start.startedAt.getTime() < configRow.durationMs + MATCH_TIMEOUT_MARGIN_MS) continue;
    try {
      await db.insert(schema.duelResults).values({ duelId: duel.id, userId: start.userId, paths: [], score: 0 });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }
  await trySettle(duel, configRow, loadDictionary().index);
  return (await getDuel(duel.id)) ?? duel;
}

async function usernames(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const rows = await db.select().from(schema.users).where(inArray(schema.users.id, ids));
  return new Map(rows.map((u) => [u.id, u.username]));
}

export function registerChallengeRoutes(app: FastifyInstance): void {
  // Amici dell'utente (per scegliere l'avversario) e richieste di amicizia da leggere, dal portale
  app.get('/friends', { preHandler: requireAuth }, async (request, reply) => {
    try {
      return reply.header('Cache-Control', 'no-store').send(await listFriends(request.userId!));
    } catch (error) {
      if (error instanceof PortalUnavailableError) return reply.code(503).send({ error: 'Amici non disponibili al momento' });
      throw error;
    }
  });

  // Da fare per te: inviti ricevuti, partite da giocare, richieste di amicizia (best effort: dal portale)
  app.get('/notifications', { preHandler: requireAuth }, async (request, reply) => {
    const me = request.userId!;
    const rows = await db
      .select()
      .from(schema.duels)
      .where(and(or(eq(schema.duels.challengerId, me), eq(schema.duels.opponentId, me)), inArray(schema.duels.status, ['invited', 'in_progress'])));
    const mine = await Promise.all(rows.map(refreshDuel));
    const active = mine.filter((d) => d.status === 'invited' || d.status === 'in_progress');
    const invites = active.filter((d) => d.status === 'invited' && d.opponentId === me).length;

    let toPlay = 0;
    for (const duel of active.filter((d) => d.status === 'in_progress')) {
      const [done] = await db
        .select({ id: schema.duelResults.id })
        .from(schema.duelResults)
        .where(and(eq(schema.duelResults.duelId, duel.id), eq(schema.duelResults.userId, me)))
        .limit(1);
      if (!done) toPlay++;
    }

    let friendRequests: number | null = null;
    try {
      friendRequests = (await listFriends(me)).incomingRequests;
    } catch {
      // il portale non risponde: le notifiche di gioco restano valide
    }
    return reply.header('Cache-Control', 'no-store').send({ invites, toPlay, friendRequests });
  });

  app.post('/challenges', { preHandler: requireAuth }, async (request, reply) => {
    const body = createSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    const me = request.userId!;
    const { opponentId, config } = body.data;
    if (opponentId === me) return reply.code(400).send({ error: 'Non puoi sfidare te stesso' });

    // Solo gli amici (lo dice il portale, non il browser)
    let friend;
    try {
      friend = await checkFriend(me, opponentId);
    } catch (error) {
      if (error instanceof PortalUnavailableError) return reply.code(503).send({ error: 'Amici non disponibili al momento' });
      throw error;
    }
    if (!friend) return reply.code(403).send({ error: 'Puoi sfidare solo i tuoi amici' });

    // Anti-spam: una sola sfida in attesa di risposta per coppia, e un numero massimo di sfide attive lanciate
    const open = await db
      .select()
      .from(schema.duels)
      .where(and(eq(schema.duels.challengerId, me), inArray(schema.duels.status, ['invited', 'in_progress'])));
    if (open.length >= MAX_ACTIVE_AS_CHALLENGER) {
      return reply.code(409).send({ error: 'Hai già troppe sfide in corso: aspetta che si concludano' });
    }
    if (open.some((d) => d.opponentId === opponentId && d.status === 'invited')) {
      return reply.code(409).send({ error: 'Hai già invitato questo amico: aspetta la sua risposta' });
    }

    const { dictionaryVersion } = loadDictionary();
    const created = await db.transaction(async (tx) => {
      // L'amico può non aver mai aperto il gioco: il suo nome arriva dal portale
      await tx
        .insert(schema.users)
        .values({ id: friend.sub, username: friend.username })
        .onConflictDoUpdate({ target: schema.users.id, set: { username: friend.username } });
      const [configRow] = await tx
        .insert(schema.gameConfigs)
        .values({ ...config, generatorVersion: 1, dictionaryVersion })
        .returning();
      const [duel] = await tx
        .insert(schema.duels)
        .values({ challengerId: me, opponentId, configId: configRow!.id, seed: randomInt(0, MAX_SEED) })
        .returning();
      return duel!;
    });
    return reply.code(201).send({ id: created.id, status: created.status });
  });

  // L'amico sfidato accetta o rifiuta
  app.post('/challenges/:id/respond', { preHandler: requireAuth }, async (request, reply) => {
    const params = idParams.safeParse(request.params);
    const body = respondSchema.safeParse(request.body);
    if (!params.success || !body.success) return reply.code(400).send({ error: 'Richiesta non valida' });

    const duel = await getDuel(params.data.id);
    if (!duel || duel.opponentId !== request.userId) return reply.code(404).send({ error: 'Sfida non trovata' });
    const fresh = await refreshDuel(duel);
    if (fresh.status !== 'invited') return reply.code(409).send({ error: 'La sfida non è più in attesa di risposta' });

    const status = body.data.accept ? 'in_progress' : 'declined';
    const updated = await db
      .update(schema.duels)
      .set({ status, respondedAt: new Date() })
      .where(and(eq(schema.duels.id, duel.id), eq(schema.duels.status, 'invited')))
      .returning({ id: schema.duels.id });
    if (updated.length === 0) return reply.code(409).send({ error: 'La sfida non è più in attesa di risposta' });
    return reply.send({ status });
  });

  // Chi ha lanciato la sfida la ritira, ma solo finché l'avversario non ha risposto
  app.post('/challenges/:id/cancel', { preHandler: requireAuth }, async (request, reply) => {
    const params = idParams.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: 'id non valido' });
    const duel = await getDuel(params.data.id);
    if (!duel || duel.challengerId !== request.userId) return reply.code(404).send({ error: 'Sfida non trovata' });

    const updated = await db
      .update(schema.duels)
      .set({ status: 'cancelled' })
      .where(and(eq(schema.duels.id, duel.id), eq(schema.duels.status, 'invited')))
      .returning({ id: schema.duels.id });
    if (updated.length === 0) return reply.code(409).send({ error: 'Si può ritirare solo una sfida ancora senza risposta' });
    return reply.send({ status: 'cancelled' });
  });

  // Il tempo parte qui, deciso dal server: ricaricare la pagina non lo rimette a zero
  app.post('/challenges/:id/start', { preHandler: requireAuth }, async (request, reply) => {
    const params = idParams.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: 'id non valido' });
    const me = request.userId!;
    const found = await getDuel(params.data.id);
    if (!found || !isParticipant(found, me)) return reply.code(404).send({ error: 'Sfida non trovata' });
    const duel = await refreshDuel(found);
    if (duel.status !== 'in_progress') return reply.code(409).send({ error: 'La sfida non è giocabile' });

    const [existingResult] = await db
      .select({ id: schema.duelResults.id })
      .from(schema.duelResults)
      .where(and(eq(schema.duelResults.duelId, duel.id), eq(schema.duelResults.userId, me)))
      .limit(1);
    if (existingResult) return reply.code(409).send({ error: 'Hai già giocato questa sfida' });

    try {
      const [start] = await db.insert(schema.duelStarts).values({ duelId: duel.id, userId: me }).returning();
      return reply.code(201).send({ startedAt: start!.startedAt, seed: duel.seed });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const [existing] = await db
        .select()
        .from(schema.duelStarts)
        .where(and(eq(schema.duelStarts.duelId, duel.id), eq(schema.duelStarts.userId, me)))
        .limit(1);
      return reply.send({ startedAt: existing!.startedAt, seed: duel.seed });
    }
  });

  app.post('/challenges/:id/results', { preHandler: requireAuth }, async (request, reply) => {
    const params = idParams.safeParse(request.params);
    const body = submitSchema.safeParse(request.body);
    if (!params.success || !body.success) return reply.code(400).send({ error: 'Richiesta non valida' });
    const me = request.userId!;
    const found = await getDuel(params.data.id);
    if (!found || !isParticipant(found, me)) return reply.code(404).send({ error: 'Sfida non trovata' });
    const duel = await refreshDuel(found);
    if (duel.status !== 'in_progress') return reply.code(409).send({ error: 'La sfida non è giocabile' });

    const configRow = await getConfig(duel.configId);
    const [start] = await db
      .select()
      .from(schema.duelStarts)
      .where(and(eq(schema.duelStarts.duelId, duel.id), eq(schema.duelStarts.userId, me)))
      .limit(1);
    // Si può inviare solo dopo aver iniziato, ed entro la durata + margine
    if (!start) return reply.code(409).send({ error: 'Partita non iniziata' });
    if (Date.now() - start.startedAt.getTime() > configRow.durationMs + MATCH_TIMEOUT_MARGIN_MS) {
      return reply.code(409).send({ error: 'Tempo scaduto' });
    }

    const { index } = loadDictionary();
    const graded = gradeSubmission(toGameConfig(configRow, duel.seed), index, body.data.paths);
    try {
      await db.insert(schema.duelResults).values({ duelId: duel.id, userId: me, paths: body.data.paths });
    } catch (error) {
      if (isUniqueViolation(error)) return reply.code(409).send({ error: 'Hai già inviato il risultato' });
      throw error;
    }
    const settled = await trySettle(duel, configRow, index);
    return reply.send({ found: graded, settled });
  });

  app.get('/challenges/:id', { preHandler: requireAuth }, async (request, reply) => {
    const params = idParams.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: 'id non valido' });
    const me = request.userId!;
    const found = await getDuel(params.data.id);
    if (!found || !isParticipant(found, me)) return reply.code(404).send({ error: 'Sfida non trovata' });
    const duel = await refreshDuel(found);

    const configRow = await getConfig(duel.configId);
    const names = await usernames([duel.challengerId, duel.opponentId]);
    const results = await db.select().from(schema.duelResults).where(eq(schema.duelResults.duelId, duel.id));
    const starts = await db.select().from(schema.duelStarts).where(eq(schema.duelStarts.duelId, duel.id));
    const opponentOfMe = duel.challengerId === me ? duel.opponentId : duel.challengerId;

    let scores: { userId: string; username: string | undefined; score: number | null; words: { word: string; points: number }[] }[] | undefined;
    if (duel.status === 'completed') {
      const { gradedByUser, counts } = scoreResults(configRow, loadDictionary().index, duel.seed, results);
      scores = results.map((r) => ({
        userId: r.userId,
        username: names.get(r.userId),
        score: r.score,
        words: (gradedByUser.get(r.userId) ?? [])
          .map((g) => ({ word: g.word, points: counts ? versusWordValue(g.points, counts.get(g.word) ?? 1) : g.points }))
          .sort((a, b) => b.word.length - a.word.length || a.word.localeCompare(b.word)),
      }));
    }

    return reply.header('Cache-Control', 'no-store').send({
      id: duel.id,
      status: duel.status,
      createdAt: duel.createdAt,
      challenger: { id: duel.challengerId, username: names.get(duel.challengerId) },
      opponent: { id: duel.opponentId, username: names.get(duel.opponentId) },
      iAmChallenger: duel.challengerId === me,
      config: configRow,
      // Il seed si dà solo quando la sfida è giocabile (prima dell'accettazione nessuno può studiare la griglia)
      seed: duel.status === 'in_progress' ? duel.seed : undefined,
      startedByMe: starts.find((s) => s.userId === me)?.startedAt ?? null,
      submittedByMe: results.some((r) => r.userId === me),
      opponentSubmitted: results.some((r) => r.userId === opponentOfMe),
      scores,
    });
  });

  app.get('/challenges', { preHandler: requireAuth }, async (request, reply) => {
    const me = request.userId!;
    const rows = await db
      .select()
      .from(schema.duels)
      .where(or(eq(schema.duels.challengerId, me), eq(schema.duels.opponentId, me)))
      .orderBy(desc(schema.duels.createdAt))
      .limit(50);
    const duels = await Promise.all(rows.map(refreshDuel));
    const visible = duels.filter((d) => d.status !== 'cancelled');

    const names = await usernames([...new Set(visible.flatMap((d) => [d.challengerId, d.opponentId]))]);
    const ids = visible.map((d) => d.id);
    const results = ids.length ? await db.select().from(schema.duelResults).where(inArray(schema.duelResults.duelId, ids)) : [];
    const configs = visible.length
      ? await db.select().from(schema.gameConfigs).where(inArray(schema.gameConfigs.id, visible.map((d) => d.configId)))
      : [];
    const configById = new Map(configs.map((c) => [c.id, c]));

    return reply.header('Cache-Control', 'no-store').send(
      visible.map((d) => {
        const mine = results.find((r) => r.duelId === d.id && r.userId === me);
        const other = d.challengerId === me ? d.opponentId : d.challengerId;
        const theirs = results.find((r) => r.duelId === d.id && r.userId === other);
        const config = configById.get(d.configId);
        return {
          id: d.id,
          status: d.status,
          createdAt: d.createdAt,
          iAmChallenger: d.challengerId === me,
          opponent: { id: other, username: names.get(other) },
          config: config && {
            size: config.size,
            durationMs: config.durationMs,
            minWordLength: config.minWordLength,
            scoring: config.scoring,
            pointMode: config.pointMode,
            positionBonus: config.positionBonus,
          },
          submittedByMe: mine !== undefined,
          opponentSubmitted: theirs !== undefined,
          // Il punteggio si mostra solo a sfida conclusa
          myScore: d.status === 'completed' ? (mine?.score ?? null) : null,
          opponentScore: d.status === 'completed' ? (theirs?.score ?? null) : null,
        };
      }),
    );
  });
}
