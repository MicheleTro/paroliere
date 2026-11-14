import { randomInt } from 'node:crypto';

import {
  computeVersusScores,
  versusWordValue,
  wordGroupCounts,
  type GameConfig,
  type VersusEntry,
} from '@paroliere/core';
import { and, desc, eq, inArray, or } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { requireAuth } from '../auth/require-auth.js';
import { db } from '../db/client.js';
import { isUniqueViolation } from '../db/errors.js';
import * as schema from '../db/schema.js';
import { loadDictionary } from '../dictionary.js';
import { AIUTO_10S, extraTimeMs, getItemDefinition, NotEnoughItemsError, spendItem } from '../items/service.js';
import { gradeSubmission } from '../plays/grading.js';
import { describeSettle, SUBMIT_MARGIN_MS } from '../plays/routes.js';
import { checkFriend, listFriends, PortalUnavailableError } from '../portal/friends.js';
import {
  awardPlay,
  duelsAvailable,
  recordPlayStarted,
  savePlayResult,
  usernamesOf,
  type PlayRow,
  type SettleResult,
} from '../progress/service.js';

// Sfide 1 contro 1 su invito (decisione whoru #28): un solo match, lanciate solo contro un amico del portale.
// Ogni giocatore ha una riga in `plays` (mode 'sfida'): lì stanno tempi, aiuto, percorsi, parole, punteggio e XP.

const MAX_SEED = 2 ** 31 - 1;
const DUEL_TTL_MS = 7 * 24 * 60 * 60 * 1000; // senza risposta o senza partite entro 7 giorni la sfida scade
const MAX_ACTIVE_AS_CHALLENGER = 10;

const duelConfigInputSchema = z.object({
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
  config: duelConfigInputSchema,
});
const respondSchema = z.object({ accept: z.boolean() });
const startSchema = z.object({ help: z.boolean().optional() });
const submitSchema = z.object({
  words: z
    .array(z.object({ path: z.array(z.number().int().nonnegative()).max(64), atMs: z.number().min(0).max(3_600_000).default(0) }))
    .max(2_000),
});
const idParams = z.object({ id: z.string().uuid() });

type DuelRow = typeof schema.duels.$inferSelect;
type PlayWordRow = typeof schema.playWords.$inferSelect;

function toGameConfig(config: schema.DuelConfig, seed: number): GameConfig {
  return { ...config, seed, generatorVersion: 1 };
}

const isParticipant = (duel: DuelRow, userId: string) => duel.challengerId === userId || duel.opponentId === userId;
const isDone = (play: Pick<PlayRow, 'status'>) => play.status !== 'started';

async function getDuel(id: string): Promise<DuelRow | undefined> {
  const [row] = await db.select().from(schema.duels).where(eq(schema.duels.id, id)).limit(1);
  return row;
}

async function playsOf(duelIds: string[]): Promise<PlayRow[]> {
  if (duelIds.length === 0) return [];
  return db.select().from(schema.plays).where(inArray(schema.plays.duelId, duelIds));
}

/** Punteggi dei due giocatori dalle parole valide di ciascuno (versus: la parola in comune vale la base, quella unica il doppio). */
function scorePlays(duel: DuelRow, plays: PlayRow[], words: PlayWordRow[]) {
  const wordsByPlay = new Map<string, PlayWordRow[]>();
  for (const w of words) wordsByPlay.set(w.playId, [...(wordsByPlay.get(w.playId) ?? []), w]);

  const entries: VersusEntry[] = plays.map((p) => ({
    participantId: p.userId,
    groupId: p.userId,
    words: new Map((wordsByPlay.get(p.id) ?? []).map((w) => [w.word, w.points])),
  }));
  const versus = duel.config.scoring === 'versus';
  const counts = versus ? wordGroupCounts(entries) : undefined;
  const scoreByUser = versus
    ? new Map(Object.entries(computeVersusScores(entries)))
    : new Map(plays.map((p) => [p.userId, (wordsByPlay.get(p.id) ?? []).reduce((sum, w) => sum + w.points, 0)] as const));
  return { wordsByPlay, scoreByUser, counts };
}

/** Chiude la sfida quando hanno giocato entrambi: punteggi, XP, parole nuove e medaglie di ciascuno. */
async function trySettle(duel: DuelRow): Promise<Map<string, SettleResult> | undefined> {
  if (duel.status !== 'in_progress') return undefined;
  const plays = await playsOf([duel.id]);
  const done = plays.filter(isDone);
  if (!done.some((p) => p.userId === duel.challengerId) || !done.some((p) => p.userId === duel.opponentId)) return undefined;

  const words = await db
    .select()
    .from(schema.playWords)
    .where(inArray(schema.playWords.playId, done.map((p) => p.id)));
  const { scoreByUser } = scorePlays(duel, done, words);

  return db.transaction(async (tx) => {
    // Condizione sullo stato: se due invii arrivano insieme, chiude solo il primo
    const closed = await tx
      .update(schema.duels)
      .set({ status: 'completed', settledAt: new Date() })
      .where(and(eq(schema.duels.id, duel.id), eq(schema.duels.status, 'in_progress')))
      .returning({ id: schema.duels.id });
    if (closed.length === 0) return undefined;

    const results = new Map<string, SettleResult>();
    for (const play of done) {
      // Gli XP della sfida sono il punteggio Versus (o classico) ottenuto (SPEC.md §11.9)
      const score = scoreByUser.get(play.userId) ?? 0;
      await tx.update(schema.plays).set({ score }).where(eq(schema.plays.id, play.id));
      results.set(play.userId, await awardPlay(tx, play.id));
    }
    return results;
  });
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

  for (const play of await playsOf([duel.id])) {
    if (play.status !== 'started') continue;
    if (Date.now() - play.startedAt.getTime() < play.durationMs + SUBMIT_MARGIN_MS) continue;
    await db.transaction(async (tx) => {
      const claimed = await tx
        .update(schema.plays)
        .set({ status: 'abandoned' })
        .where(and(eq(schema.plays.id, play.id), eq(schema.plays.status, 'started')))
        .returning({ id: schema.plays.id });
      if (claimed.length > 0) await savePlayResult(tx, play, { status: 'abandoned', words: [], submission: null, score: 0 });
    });
  }
  await trySettle(duel);
  return (await getDuel(duel.id)) ?? duel;
}

function startResponse(play: PlayRow) {
  return {
    startedAt: play.startedAt,
    seed: play.seed,
    helpUsed: play.usedItemId !== null,
    durationMs: play.durationMs,
    remainingMs: Math.max(0, play.durationMs - (Date.now() - play.startedAt.getTime())),
  };
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
    const unlocked = await duelsAvailable(me);
    const rows = unlocked
      ? await db
          .select()
          .from(schema.duels)
          .where(and(or(eq(schema.duels.challengerId, me), eq(schema.duels.opponentId, me)), inArray(schema.duels.status, ['invited', 'in_progress'])))
      : [];
    const mine = await Promise.all(rows.map(refreshDuel));
    const active = mine.filter((d) => d.status === 'invited' || d.status === 'in_progress');
    const invites = active.filter((d) => d.status === 'invited' && d.opponentId === me).length;

    const inProgress = active.filter((d) => d.status === 'in_progress');
    const plays = await playsOf(inProgress.map((d) => d.id));
    const toPlay = inProgress.filter((d) => !plays.some((p) => p.duelId === d.id && p.userId === me && isDone(p))).length;

    let friendRequests: number | null = null;
    try {
      friendRequests = (await listFriends(me)).incomingRequests;
    } catch {
      // il portale non risponde: le notifiche di gioco restano valide
    }
    return reply.header('Cache-Control', 'no-store').send({ invites, toPlay, friendRequests, unlocked });
  });

  app.post('/challenges', { preHandler: requireAuth }, async (request, reply) => {
    const body = createSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    const me = request.userId!;
    const { opponentId, config } = body.data;
    if (opponentId === me) return reply.code(400).send({ error: 'Non puoi sfidare te stesso' });
    if (!(await duelsAvailable(me))) return reply.code(403).send({ error: 'Le sfide si sbloccano al livello 5' });

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
      const [duel] = await tx
        .insert(schema.duels)
        .values({ challengerId: me, opponentId, config: { ...config, dictionaryVersion }, seed: randomInt(0, MAX_SEED) })
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

    const existing = (await playsOf([duel.id])).find((p) => p.userId === me);
    if (existing && isDone(existing)) return reply.code(409).send({ error: 'Hai già giocato questa sfida' });
    if (existing) return reply.send(startResponse(existing));

    // L'aiuto si sceglie prima di iniziare e si consuma subito, nella stessa transazione dell'avvio
    const wantsHelp = startSchema.safeParse(request.body).data?.help === true;
    try {
      const play = await db.transaction(async (tx) => {
        const config = toGameConfig(duel.config, duel.seed);
        const item = wantsHelp ? await getItemDefinition(tx, AIUTO_10S) : undefined;
        const [row] = await tx
          .insert(schema.plays)
          .values({
            userId: me,
            mode: 'sfida',
            duelId: duel.id,
            seed: duel.seed,
            config,
            durationMs: config.durationMs + (item ? extraTimeMs(item) : 0),
            usedItemId: item?.id ?? null,
          })
          .returning();
        // Lo spendo dopo aver creato la partita: il registro ne conserva il riferimento
        if (item) await spendItem(tx, me, item.id, { playId: row!.id });
        await recordPlayStarted(tx, me, row!.startedAt);
        return row!;
      });
      return reply.code(201).send(startResponse(play));
    } catch (error) {
      if (error instanceof NotEnoughItemsError) return reply.code(409).send({ error: 'Non hai aiuti disponibili' });
      if (!isUniqueViolation(error)) throw error;
      const again = (await playsOf([duel.id])).find((p) => p.userId === me);
      return reply.send(startResponse(again!));
    }
  });

  // Uscita volontaria da una partita di sfida (con conferma lato client): punteggio zero, non si può più rigiocare
  app.post('/challenges/:id/abandon', { preHandler: requireAuth }, async (request, reply) => {
    const params = idParams.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: 'id non valido' });
    const me = request.userId!;
    const found = await getDuel(params.data.id);
    if (!found || !isParticipant(found, me)) return reply.code(404).send({ error: 'Sfida non trovata' });
    const duel = await refreshDuel(found);
    if (duel.status !== 'in_progress') return reply.code(409).send({ error: 'La sfida non è giocabile' });

    const play = (await playsOf([duel.id])).find((p) => p.userId === me);
    if (!play || isDone(play)) return reply.code(409).send({ error: 'Nessuna partita da lasciare' });
    await db.transaction(async (tx) => {
      const claimed = await tx
        .update(schema.plays)
        .set({ status: 'abandoned' })
        .where(and(eq(schema.plays.id, play.id), eq(schema.plays.status, 'started')))
        .returning({ id: schema.plays.id });
      if (claimed.length > 0) await savePlayResult(tx, play, { status: 'abandoned', words: [], submission: null, score: 0 });
    });
    await trySettle(duel);
    return reply.code(204).send();
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

    const play = (await playsOf([duel.id])).find((p) => p.userId === me);
    // Si può inviare solo dopo aver iniziato, ed entro la durata + margine
    if (!play) return reply.code(409).send({ error: 'Partita non iniziata' });
    if (isDone(play)) return reply.code(409).send({ error: 'Hai già inviato il risultato' });
    if (Date.now() - play.startedAt.getTime() > play.durationMs + SUBMIT_MARGIN_MS) {
      return reply.code(409).send({ error: 'Tempo scaduto' });
    }

    const words = gradeSubmission(play.config, loadDictionary().index, body.data.words, play.durationMs);
    const claimed = await db.transaction(async (tx) => {
      const taken = await tx
        .update(schema.plays)
        .set({ status: 'finished' })
        .where(and(eq(schema.plays.id, play.id), eq(schema.plays.status, 'started')))
        .returning({ id: schema.plays.id });
      if (taken.length === 0) return false;
      await savePlayResult(tx, play, {
        status: 'finished',
        words,
        submission: body.data.words,
        score: words.reduce((sum, w) => sum + w.points, 0),
      });
      return true;
    });
    if (!claimed) return reply.code(409).send({ error: 'Hai già inviato il risultato' });

    const settled = await trySettle(duel);
    const mine = settled?.get(me);
    return reply.send({
      found: words.map((w) => ({ word: w.word, path: w.path, points: w.points })),
      settled: settled !== undefined,
      progress: mine ? describeSettle(mine) : undefined,
    });
  });

  app.get('/challenges/:id', { preHandler: requireAuth }, async (request, reply) => {
    const params = idParams.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: 'id non valido' });
    const me = request.userId!;
    const found = await getDuel(params.data.id);
    if (!found || !isParticipant(found, me)) return reply.code(404).send({ error: 'Sfida non trovata' });
    const duel = await refreshDuel(found);

    const names = await usernamesOf([duel.challengerId, duel.opponentId]);
    const plays = await playsOf([duel.id]);
    const mine = plays.find((p) => p.userId === me);
    const opponentOfMe = duel.challengerId === me ? duel.opponentId : duel.challengerId;
    const theirs = plays.find((p) => p.userId === opponentOfMe);

    let scores:
      | { userId: string; username: string | undefined; score: number | null; xp: number; usedHelp: boolean; words: { word: string; points: number }[] }[]
      | undefined;
    if (duel.status === 'completed' && plays.length > 0) {
      const words = await db
        .select()
        .from(schema.playWords)
        .where(inArray(schema.playWords.playId, plays.map((p) => p.id)));
      const { wordsByPlay, counts } = scorePlays(duel, plays, words);
      scores = plays.map((p) => ({
        userId: p.userId,
        username: names.get(p.userId),
        score: p.score,
        xp: p.xpAwarded,
        usedHelp: p.usedItemId !== null,
        words: (wordsByPlay.get(p.id) ?? [])
          .map((w) => ({ word: w.word, points: counts ? versusWordValue(w.points, counts.get(w.word) ?? 1) : w.points }))
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
      config: duel.config,
      // Il seed si dà solo quando la sfida è giocabile (prima dell'accettazione nessuno può studiare la griglia)
      seed: duel.status === 'in_progress' ? duel.seed : undefined,
      startedByMe: mine?.startedAt ?? null,
      helpUsedByMe: mine?.usedItemId != null,
      submittedByMe: mine !== undefined && isDone(mine),
      opponentSubmitted: theirs !== undefined && isDone(theirs),
      scores,
    });
  });

  app.get('/challenges', { preHandler: requireAuth }, async (request, reply) => {
    const me = request.userId!;
    const unlocked = await duelsAvailable(me);
    const rows = await db
      .select()
      .from(schema.duels)
      .where(or(eq(schema.duels.challengerId, me), eq(schema.duels.opponentId, me)))
      .orderBy(desc(schema.duels.createdAt))
      .limit(50);
    const duels = await Promise.all(rows.map(refreshDuel));
    // Una sfida ricevuta prima di sbloccare le sfide resta in attesa e compare quando si arriva al livello 5
    const visible = duels.filter((d) => d.status !== 'cancelled' && (unlocked || d.challengerId === me));

    const names = await usernamesOf([...new Set(visible.flatMap((d) => [d.challengerId, d.opponentId]))]);
    const plays = await playsOf(visible.map((d) => d.id));

    return reply.header('Cache-Control', 'no-store').send(
      visible.map((d) => {
        const mine = plays.find((p) => p.duelId === d.id && p.userId === me);
        const other = d.challengerId === me ? d.opponentId : d.challengerId;
        const theirs = plays.find((p) => p.duelId === d.id && p.userId === other);
        return {
          id: d.id,
          status: d.status,
          createdAt: d.createdAt,
          iAmChallenger: d.challengerId === me,
          opponent: { id: other, username: names.get(other) },
          config: {
            size: d.config.size,
            durationMs: d.config.durationMs,
            minWordLength: d.config.minWordLength,
            scoring: d.config.scoring,
            pointMode: d.config.pointMode,
            positionBonus: d.config.positionBonus,
          },
          submittedByMe: mine !== undefined && isDone(mine),
          opponentSubmitted: theirs !== undefined && isDone(theirs),
          // Il punteggio si mostra solo a sfida conclusa
          myScore: d.status === 'completed' ? (mine?.score ?? null) : null,
          opponentScore: d.status === 'completed' ? (theirs?.score ?? null) : null,
        };
      }),
    );
  });
}
