import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { addDays } from '@paroliere/core';

import { requireAuth } from '../auth/require-auth.js';
import { db } from '../db/client.js';
import * as schema from '../db/schema.js';
import { AIUTO_10S, extraTimeMs, getItemDefinition, NotEnoughItemsError, spendItem } from '../items/service.js';
import { abandonPlay, isExpired } from '../plays/routes.js';
import { listFriends, PortalUnavailableError } from '../portal/friends.js';
import { duelsAvailable, recordPlayStarted, type PlayRow } from '../progress/service.js';
import { isUniqueViolation } from '../db/errors.js';
import { ensureGrid, frozenGrid, plannedPresets, publicPreset, weekClock, type WeeklyGridRow } from './service.js';

const dayParams = z.object({ day: z.coerce.number().int().min(0).max(6) });
const scopeQuery = z.object({ scope: z.enum(['generale', 'amici']).default('generale') });
const startSchema = z.object({ help: z.boolean().optional() });

type PresetRow = typeof schema.gamePresets.$inferSelect;

/** Gli amici si vedono dal livello 5; il portale può non rispondere. */
async function friendScope(userId: string): Promise<{ ids: string[] } | { locked: true } | { unavailable: true }> {
  if (!(await duelsAvailable(userId))) return { locked: true };
  try {
    const { friends } = await listFriends(userId);
    return { ids: [userId, ...friends.map((f) => f.sub)] };
  } catch (error) {
    if (error instanceof PortalUnavailableError) return { unavailable: true };
    throw error;
  }
}

function remainingMs(play: Pick<PlayRow, 'startedAt' | 'durationMs'>): number {
  return Math.max(0, play.durationMs - (Date.now() - play.startedAt.getTime()));
}

/** Chiude come abbandonate le partite della Settimana iniziate e mai inviate entro il tempo (tentativo perso). */
async function expireStale(plays: PlayRow[]): Promise<PlayRow[]> {
  const result: PlayRow[] = [];
  for (const play of plays) {
    if (play.status === 'started' && isExpired(play)) {
      await db.transaction((tx) => abandonPlay(tx, play));
      result.push({ ...play, status: 'abandoned', score: 0 });
    } else {
      result.push(play);
    }
  }
  return result;
}

async function myWeekPlays(userId: string, gridIds: string[]): Promise<PlayRow[]> {
  if (gridIds.length === 0) return [];
  const rows = await db
    .select()
    .from(schema.plays)
    .where(and(eq(schema.plays.userId, userId), inArray(schema.plays.gridId, gridIds)));
  return expireStale(rows);
}

/** 'locked' = giorno non ancora arrivato; 'blocked' = arrivato, ma il giorno prima non è stato giocato. */
type DayState = 'locked' | 'blocked' | 'open' | 'recover' | 'in_progress' | 'played' | 'lost';

/** Un giorno è "giocato" quando il suo tentativo è chiuso (finito o perso): quello ancora in corso non basta. */
function isPlayed(play: PlayRow | undefined): boolean {
  return play !== undefined && play.status !== 'started';
}

/** Ogni giornata si sblocca solo se la precedente è stata giocata; il lunedì è sempre aperto. */
async function previousDayPlayed(userId: string, week: string, day: number): Promise<boolean> {
  if (day === 0) return true;
  const grids = await db.select({ id: schema.weeklyGrids.id, dayIndex: schema.weeklyGrids.dayIndex }).from(schema.weeklyGrids).where(eq(schema.weeklyGrids.weekStart, week));
  const previous = grids.find((g) => g.dayIndex === day - 1);
  if (!previous) return false;
  const [play] = await myWeekPlays(userId, [previous.id]);
  return isPlayed(play);
}

function stateOf(day: number, todayIndex: number, mine: PlayRow | undefined, previousPlayed: boolean): DayState {
  if (day > todayIndex) return 'locked';
  if (!mine) return !previousPlayed ? 'blocked' : day === todayIndex ? 'open' : 'recover';
  if (mine.status === 'started') return 'in_progress';
  return mine.status === 'finished' ? 'played' : 'lost';
}

interface LeaderRow {
  rank: number;
  userId: string;
  username: string;
  score: number;
  wordCount: number;
  me: boolean;
  words?: string[];
}

/** Classifica di una griglia: chi l'ha finita, per punteggio (a parità, chi ha finito prima). */
async function dayLeaderboard(gridId: string, me: string, onlyIds: string[] | undefined, showWords: boolean): Promise<LeaderRow[]> {
  const conditions = [eq(schema.plays.gridId, gridId), eq(schema.plays.status, 'finished')];
  if (onlyIds) conditions.push(inArray(schema.plays.userId, onlyIds));
  const rows = await db
    .select({
      playId: schema.plays.id,
      userId: schema.plays.userId,
      username: schema.users.username,
      score: schema.plays.score,
      wordCount: schema.plays.wordCount,
    })
    .from(schema.plays)
    .innerJoin(schema.users, eq(schema.users.id, schema.plays.userId))
    .where(and(...conditions))
    .orderBy(desc(schema.plays.score), schema.plays.finishedAt)
    .limit(50);

  let wordsByPlay = new Map<string, string[]>();
  if (showWords && rows.length > 0) {
    const words = await db
      .select({ playId: schema.playWords.playId, word: schema.playWords.word })
      .from(schema.playWords)
      .where(inArray(schema.playWords.playId, rows.map((r) => r.playId)));
    wordsByPlay = new Map();
    for (const w of words) wordsByPlay.set(w.playId, [...(wordsByPlay.get(w.playId) ?? []), w.word]);
  }

  return rows.map((r, i) => ({
    rank: i + 1,
    userId: r.userId,
    username: r.username,
    score: r.score,
    wordCount: r.wordCount,
    me: r.userId === me,
    ...(showWords ? { words: (wordsByPlay.get(r.playId) ?? []).sort() } : {}),
  }));
}

export function registerWeekRoutes(app: FastifyInstance): void {
  // Panoramica della settimana in corso: i 7 giorni, con stato e punteggio di chi guarda
  app.get('/week', { preHandler: requireAuth }, async (request, reply) => {
    const me = request.userId!;
    const clock = weekClock();
    const planned = await plannedPresets();
    const grids = await db.select().from(schema.weeklyGrids).where(eq(schema.weeklyGrids.weekStart, clock.weekStart));
    const frozenByDay = new Map<number, WeeklyGridRow>(grids.map((g) => [g.dayIndex, g]));
    const frozenPresets = grids.length
      ? await db.select().from(schema.gamePresets).where(inArray(schema.gamePresets.id, grids.map((g) => g.presetId)))
      : [];
    const presetById = new Map(frozenPresets.map((p) => [p.id, p]));

    const mine = await myWeekPlays(me, grids.map((g) => g.id));
    const counts = grids.length
      ? await db
          .select({ gridId: schema.plays.gridId, n: sql<number>`count(*)::int` })
          .from(schema.plays)
          .where(and(inArray(schema.plays.gridId, grids.map((g) => g.id)), eq(schema.plays.status, 'finished')))
          .groupBy(schema.plays.gridId)
      : [];
    const playersByGrid = new Map(counts.map((c) => [c.gridId, c.n]));

    const playOf = (day: number): PlayRow | undefined => {
      const grid = frozenByDay.get(day);
      return grid ? mine.find((p) => p.gridId === grid.id) : undefined;
    };

    const days = Array.from({ length: 7 }, (_, day) => {
      const grid = frozenByDay.get(day);
      const preset: PresetRow | undefined = grid ? presetById.get(grid.presetId) : planned.get(day);
      const play = playOf(day);
      return {
        dayIndex: day,
        date: addDays(clock.weekStart, day),
        state: stateOf(day, clock.todayIndex, play, day === 0 || isPlayed(playOf(day - 1))),
        preset: preset ? publicPreset(preset) : null,
        myScore: play?.status === 'finished' ? play.score : null,
        players: grid ? (playersByGrid.get(grid.id) ?? 0) : 0,
      };
    });

    return reply.header('Cache-Control', 'no-store').send({
      weekStart: clock.weekStart,
      weekEnd: addDays(clock.weekStart, 6),
      today: clock.today,
      todayIndex: clock.todayIndex,
      days,
    });
  });

  // Classifica della settimana: somma dei punteggi delle griglie giocate (quelle non giocate valgono 0)
  app.get('/week/ranking', { preHandler: requireAuth }, async (request, reply) => {
    const query = scopeQuery.safeParse(request.query);
    if (!query.success) return reply.code(400).send({ error: 'Richiesta non valida' });
    const me = request.userId!;
    const clock = weekClock();

    let onlyIds: string[] | undefined;
    if (query.data.scope === 'amici') {
      const scope = await friendScope(me);
      if ('locked' in scope) return reply.send({ scope: 'amici', locked: true, rows: [] });
      if ('unavailable' in scope) return reply.send({ scope: 'amici', unavailable: true, rows: [] });
      onlyIds = scope.ids;
    }

    const grids = await db.select({ id: schema.weeklyGrids.id }).from(schema.weeklyGrids).where(eq(schema.weeklyGrids.weekStart, clock.weekStart));
    let rows: { userId: string; username: string; total: number; played: number }[] = [];
    if (grids.length > 0) {
      const conditions = [inArray(schema.plays.gridId, grids.map((g) => g.id)), eq(schema.plays.status, 'finished')];
      if (onlyIds) conditions.push(inArray(schema.plays.userId, onlyIds));
      rows = await db
        .select({
          userId: schema.plays.userId,
          username: schema.users.username,
          total: sql<number>`sum(${schema.plays.score})::int`,
          played: sql<number>`count(*)::int`,
        })
        .from(schema.plays)
        .innerJoin(schema.users, eq(schema.users.id, schema.plays.userId))
        .where(and(...conditions))
        .groupBy(schema.plays.userId, schema.users.username)
        .orderBy(desc(sql`sum(${schema.plays.score})`))
        .limit(100);
    }

    return reply.header('Cache-Control', 'no-store').send({
      scope: query.data.scope,
      weekStart: clock.weekStart,
      rows: rows.map((r, i) => ({ rank: i + 1, userId: r.userId, username: r.username, score: r.total, played: r.played, me: r.userId === me })),
    });
  });

  // Dettaglio di un giorno: regole, il mio stato e la classifica della griglia
  app.get('/week/:day', { preHandler: requireAuth }, async (request, reply) => {
    const params = dayParams.safeParse(request.params);
    const query = scopeQuery.safeParse(request.query);
    if (!params.success || !query.success) return reply.code(400).send({ error: 'Richiesta non valida' });
    const me = request.userId!;
    const clock = weekClock();
    const day = params.data.day;
    if (day > clock.todayIndex) {
      const planned = (await plannedPresets()).get(day);
      return reply.send({ dayIndex: day, date: addDays(clock.weekStart, day), state: 'locked', preset: planned ? publicPreset(planned) : null });
    }

    const grid = await ensureGrid(clock.weekStart, day);
    const [preset] = await db.select().from(schema.gamePresets).where(eq(schema.gamePresets.id, grid.presetId));
    const [mine] = await myWeekPlays(me, [grid.id]);
    const state = stateOf(day, clock.todayIndex, mine, await previousDayPlayed(me, clock.weekStart, day));

    let onlyIds: string[] | undefined;
    let scopeNote: 'locked' | 'unavailable' | undefined;
    if (query.data.scope === 'amici') {
      const scope = await friendScope(me);
      if ('ids' in scope) onlyIds = scope.ids;
      else scopeNote = 'locked' in scope ? 'locked' : 'unavailable';
    }
    const hasPlayed = mine !== undefined && mine.status !== 'started';
    const rows = scopeNote ? [] : await dayLeaderboard(grid.id, me, onlyIds, hasPlayed);

    return reply.header('Cache-Control', 'no-store').send({
      dayIndex: day,
      date: addDays(clock.weekStart, day),
      state,
      preset: preset ? publicPreset(preset) : null,
      myScore: mine?.status === 'finished' ? mine.score : null,
      myPlayId: mine?.status === 'started' ? mine.id : null,
      scope: query.data.scope,
      scopeNote,
      leaderboard: rows,
      // Le parole degli altri si vedono solo dopo aver giocato quella griglia
      wordsVisible: hasPlayed,
    });
  });

  // Inizia (o riprende) il tentativo unico di una griglia. Il server decide l'ora di inizio e consegna la
  // griglia già pronta con le sue soluzioni: il dizionario del telefono non può cambiare le regole del giorno.
  app.post('/week/:day/start', { preHandler: requireAuth }, async (request, reply) => {
    const params = dayParams.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: 'Richiesta non valida' });
    const me = request.userId!;
    const clock = weekClock();
    const day = params.data.day;
    if (day > clock.todayIndex) return reply.code(403).send({ error: 'Questa griglia non è ancora aperta' });

    const grid = await ensureGrid(clock.weekStart, day);
    const [existing] = await myWeekPlays(me, [grid.id]);
    const response = (play: PlayRow) => {
      const { grid: frozen, solutions } = frozenGrid(grid);
      return {
        id: play.id,
        mode: play.mode,
        seed: play.seed,
        config: play.config,
        startedAt: play.startedAt,
        durationMs: play.durationMs,
        remainingMs: remainingMs(play),
        helpUsed: play.usedItemId !== null,
        grid: frozen,
        solutions,
      };
    };

    if (existing) {
      if (existing.status === 'started') return reply.send(response(existing));
      return reply.code(409).send({ error: 'Hai già giocato questa griglia: il tentativo è uno solo' });
    }
    if (!(await previousDayPlayed(me, clock.weekStart, day))) {
      return reply.code(403).send({ error: 'Prima devi giocare la griglia del giorno precedente' });
    }

    const wantsHelp = startSchema.safeParse(request.body).data?.help === true;
    try {
      const { play, streak } = await db.transaction(async (tx) => {
        const item = wantsHelp ? await getItemDefinition(tx, AIUTO_10S) : undefined;
        const [row] = await tx
          .insert(schema.plays)
          .values({
            userId: me,
            mode: 'settimana',
            presetId: grid.presetId,
            gridId: grid.id,
            seed: grid.config.seed,
            config: grid.config,
            durationMs: grid.config.durationMs + (item ? extraTimeMs(item) : 0),
            usedItemId: item?.id ?? null,
          })
          .returning();
        if (item) await spendItem(tx, me, item.id, { playId: row!.id });
        const streak = await recordPlayStarted(tx, me, row!.startedAt);
        return { play: row!, streak };
      });
      return reply.code(201).send({ ...response(play), streakCycleCompleted: streak.cycleCompleted });
    } catch (error) {
      if (error instanceof NotEnoughItemsError) return reply.code(409).send({ error: 'Non hai aiuti disponibili' });
      if (!isUniqueViolation(error)) throw error;
      const [again] = await myWeekPlays(me, [grid.id]);
      return again ? reply.send(response(again)) : reply.code(409).send({ error: 'Tentativo già usato' });
    }
  });
}
