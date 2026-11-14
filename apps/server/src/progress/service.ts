import {
  addDays,
  applyPlay,
  calendarDay,
  duelsUnlocked,
  levelFromXp,
  newMedals,
  starBonus,
  type MedalDefinition,
  type MedalMetric,
  type MedalSnapshot,
  type StarBonus,
  type StreakState,
} from '@paroliere/core';
import { and, asc, count, countDistinct, eq, inArray, ne } from 'drizzle-orm';

import { db } from '../db/client.js';
import * as schema from '../db/schema.js';
import { AIUTO_10S, grantItem } from '../items/service.js';

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type PlayRow = typeof schema.plays.$inferSelect;
type ProfileRow = typeof schema.profiles.$inferSelect;

/** Legge il profilo bloccandone la riga fino a fine transazione (due partite insieme non si pestano i piedi). */
async function lockedProfile(tx: Tx, userId: string): Promise<ProfileRow> {
  await tx.insert(schema.profiles).values({ userId }).onConflictDoNothing();
  const [row] = await tx.select().from(schema.profiles).where(eq(schema.profiles.userId, userId)).for('update');
  return row!;
}

function streakOf(profile: ProfileRow): StreakState {
  // Gli aiuti non sono più nel profilo: stanno nell'inventario (items/service.ts)
  return { days: profile.streakDays, lastDay: profile.streakLastDay, cycles: profile.streakCycles, helps: 0 };
}

export interface StreakResult {
  /** Giorni della serie dopo questa partita (0 dopo un ciclo completato: riparte). */
  days: number;
  /** Vero se questa partita ha chiuso un ciclo da 10 giorni e ha dato un aiuto. */
  cycleCompleted: boolean;
  /** Aiuti guadagnati con questa partita (0 o 1). */
  helpsGranted: number;
}

/**
 * Una partita è iniziata (anche se poi viene abbandonata: conta come finita, SPEC.md §11.1). Aggiorna la serie sul
 * giorno di calendario di Roma. Idempotente nello stesso giorno.
 */
export async function recordPlayStarted(tx: Tx, userId: string, at: Date): Promise<StreakResult> {
  const profile = await lockedProfile(tx, userId);
  const update = applyPlay(streakOf(profile), calendarDay(at));
  if (update.extendedToday) {
    await tx
      .update(schema.profiles)
      .set({
        streakDays: update.state.days,
        streakLastDay: update.state.lastDay,
        streakCycles: update.state.cycles,
      })
      .where(eq(schema.profiles.userId, userId));
  }
  // Un ciclo completo dà un aiuto +10 s, registrato nell'inventario con il suo motivo
  const helpsGranted = update.cycleCompleted
    ? await grantItem(tx, userId, AIUTO_10S, 1, 'streak_cycle', { note: `Ciclo ${update.state.cycles} completato` })
    : 0;
  return { days: update.state.days, cycleCompleted: update.cycleCompleted, helpsGranted };
}

/** Una parola valida della partita, già rivalutata dal server. */
export interface ScoredWord {
  word: string;
  path: number[];
  points: number;
  atMs: number;
  combo: number;
}

/**
 * Salva il risultato di una partita (percorsi inviati, parole valide, punteggio, stato). Non assegna ancora XP né
 * medaglie: nelle sfide il punteggio ufficiale si conosce solo quando hanno giocato entrambi (`awardPlay`).
 */
export async function savePlayResult(
  tx: Tx,
  play: Pick<PlayRow, 'id' | 'userId'>,
  result: {
    status: 'finished' | 'abandoned';
    words: readonly ScoredWord[];
    submission: schema.PlaySubmissionEntry[] | null;
    score: number;
    finishedAt?: Date;
  },
): Promise<void> {
  await tx
    .update(schema.plays)
    .set({
      status: result.status,
      finishedAt: result.finishedAt ?? new Date(),
      submission: result.submission,
      wordCount: result.words.length,
      score: result.score,
    })
    .where(eq(schema.plays.id, play.id));

  if (result.words.length > 0) {
    await tx
      .insert(schema.playWords)
      .values(
        result.words.map((w) => ({
          playId: play.id,
          userId: play.userId,
          word: w.word,
          path: w.path,
          points: w.points,
          atMs: Math.round(w.atMs),
          combo: w.combo,
        })),
      )
      .onConflictDoNothing();
  }
}

export interface SettleResult {
  /** XP dati dalla partita, bonus stella compreso. */
  xpAwarded: number;
  /** Bonus stella di Gioca (già incluso in `xpAwarded`). */
  starBonus: StarBonus | null;
  /** Parole entrate per la prima volta nella collezione. */
  newWords: string[];
  levelBefore: number;
  levelAfter: number;
  totalXp: number;
  newMedals: MedalDefinition[];
}

/** Catalogo delle medaglie attive, dal database. */
export async function loadMedalDefinitions(tx: Pick<Tx, 'select'>): Promise<MedalDefinition[]> {
  const rows = await tx
    .select()
    .from(schema.medalDefinitions)
    .where(eq(schema.medalDefinitions.active, true))
    .orderBy(asc(schema.medalDefinitions.sortOrder), asc(schema.medalDefinitions.id));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    kind: r.kind,
    metric: r.metric as MedalMetric,
    threshold: r.threshold,
  }));
}

/**
 * Assegna il progresso di una partita già salvata: XP uguali al punteggio, parole nuove nella collezione, contatori,
 * medaglie. Va chiamata una sola volta per partita (lo garantisce il chiamante con la transizione di stato).
 */
export async function awardPlay(tx: Tx, playId: string): Promise<SettleResult> {
  const [play] = await tx.select().from(schema.plays).where(eq(schema.plays.id, playId));
  if (!play) throw new Error(`awardPlay: partita ${playId} inesistente`);
  const userId = play.userId;
  const profile = await lockedProfile(tx, userId);

  const words = await tx.select().from(schema.playWords).where(eq(schema.playWords.playId, playId));

  const inserted = words.length
    ? await tx
        .insert(schema.foundWords)
        .values(words.map((w) => ({ userId, word: w.word, firstPlayId: playId })))
        .onConflictDoNothing()
        .returning({ word: schema.foundWords.word })
    : [];
  const newWords = inserted.map((r) => r.word);
  if (newWords.length > 0) {
    await tx
      .update(schema.playWords)
      .set({ isNew: true })
      .where(and(eq(schema.playWords.playId, playId), inArray(schema.playWords.word, newWords)));
  }

  let longestWord = profile.longestWord;
  let longestWordLength = profile.longestWordLength;
  for (const { word } of words) {
    if (word.length > longestWordLength) {
      longestWord = word;
      longestWordLength = word.length;
    }
  }

  // Solo in Gioca: la stella raggiunta moltiplica l'XP (nelle sfide e nella Settimana i punti sono XP e basta)
  const baseXp = Math.max(0, Math.floor(play.score));
  const bonus = play.mode === 'gioca' ? starBonus(baseXp) : null;
  const xpAwarded = baseXp + (bonus?.xp ?? 0);
  const totalXp = profile.totalXp + xpAwarded;
  const levelBefore = levelFromXp(profile.totalXp).level;
  const levelAfter = levelFromXp(totalXp).level;
  const gamesPlayed = profile.gamesPlayed + 1;
  const maxWordsInGame = Math.max(profile.maxWordsInGame, words.length);

  await tx
    .update(schema.profiles)
    .set({ totalXp, gamesPlayed, maxWordsInGame, longestWord, longestWordLength })
    .where(eq(schema.profiles.userId, userId));
  await tx.update(schema.plays).set({ xpAwarded }).where(eq(schema.plays.id, playId));

  const snapshot = await medalSnapshot(tx, userId, { ...profile, gamesPlayed, maxWordsInGame, longestWordLength }, levelAfter);
  const owned = await tx.select({ id: schema.medals.medalId }).from(schema.medals).where(eq(schema.medals.userId, userId));
  const definitions = await loadMedalDefinitions(tx);
  const due = newMedals(snapshot, owned.map((m) => m.id), definitions);
  const granted = due.length
    ? await tx
        .insert(schema.medals)
        .values(due.map((m) => ({ userId, medalId: m.id })))
        .onConflictDoNothing()
        .returning({ id: schema.medals.medalId })
    : [];
  const grantedIds = new Set(granted.map((g) => g.id));

  return {
    xpAwarded,
    starBonus: bonus,
    newWords,
    levelBefore,
    levelAfter,
    totalXp,
    newMedals: due.filter((m) => grantedIds.has(m.id)),
  };
}

async function medalSnapshot(
  tx: Tx,
  userId: string,
  profile: Pick<ProfileRow, 'gamesPlayed' | 'maxWordsInGame' | 'longestWordLength' | 'streakCycles'>,
  level: number,
): Promise<MedalSnapshot> {
  const [wordsRow] = await tx.select({ n: count() }).from(schema.foundWords).where(eq(schema.foundWords.userId, userId));

  // Griglie della Settimana giocate (concluse o abbandonate), per settimana e per giorno di gioco
  const weekly = await tx
    .select({
      startedAt: schema.plays.startedAt,
      weekStart: schema.weeklyGrids.weekStart,
      dayIndex: schema.weeklyGrids.dayIndex,
      presetId: schema.weeklyGrids.presetId,
    })
    .from(schema.plays)
    .innerJoin(schema.weeklyGrids, eq(schema.weeklyGrids.id, schema.plays.gridId))
    .where(and(eq(schema.plays.userId, userId), eq(schema.plays.mode, 'settimana'), ne(schema.plays.status, 'started')));

  const perWeek = new Map<string, { played: number; onTime: number }>();
  for (const row of weekly) {
    const week = perWeek.get(row.weekStart) ?? { played: 0, onTime: 0 };
    week.played++;
    if (calendarDay(row.startedAt) === addDays(row.weekStart, row.dayIndex)) week.onTime++;
    perWeek.set(row.weekStart, week);
  }

  // Le varianti del catalogo sono i preset assegnati ai giorni del piano settimanale
  const [variantsRow] = await tx.select({ n: countDistinct(schema.weekPlan.presetId) }).from(schema.weekPlan);

  return {
    totalWords: Number(wordsRow?.n ?? 0),
    gamesPlayed: profile.gamesPlayed,
    longestWordLength: profile.longestWordLength,
    maxWordsInGame: profile.maxWordsInGame,
    level,
    weeklyGridsPlayed: weekly.length,
    bestWeekGridsPlayed: Math.max(0, ...[...perWeek.values()].map((w) => w.played)),
    bestWeekOnTime: Math.max(0, ...[...perWeek.values()].map((w) => w.onTime)),
    variantsPlayed: new Set(weekly.map((w) => w.presetId)).size,
    variantsTotal: Number(variantsRow?.n ?? 0),
    streakCycles: profile.streakCycles,
  };
}

/** Nomi degli utenti per le schermate con classifiche e avversari. */
export async function usernamesOf(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const rows = await db.select().from(schema.users).where(inArray(schema.users.id, ids));
  return new Map(rows.map((u) => [u.id, u.username]));
}

/** Le sfide e i collegamenti con gli amici si sbloccano al livello 5 (SPEC.md §11.3). */
export async function duelsAvailable(userId: string): Promise<boolean> {
  const [row] = await db.select({ xp: schema.profiles.totalXp }).from(schema.profiles).where(eq(schema.profiles.userId, userId));
  return duelsUnlocked(row?.xp ?? 0);
}
