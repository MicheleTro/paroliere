import { createHmac } from 'node:crypto';

import { calendarDay, generateGrid, weekdayIndex, weekStart as mondayOf, type Grid, type Solution } from '@paroliere/core';
import { eq } from 'drizzle-orm';

import { config } from '../config.js';
import { db } from '../db/client.js';
import * as schema from '../db/schema.js';
import { loadDictionary } from '../dictionary.js';
import { presetToConfig, type PresetRow } from '../plays/presets.js';

export type WeeklyGridRow = typeof schema.weeklyGrids.$inferSelect;

export interface WeekClock {
  /** Giorno di calendario di oggi (Europe/Rome). */
  today: string;
  /** Lunedì di questa settimana. */
  weekStart: string;
  /** 0 = lunedì … 6 = domenica. */
  todayIndex: number;
}

export function weekClock(now: Date = new Date()): WeekClock {
  const today = calendarDay(now);
  return { today, weekStart: mondayOf(today), todayIndex: weekdayIndex(today) };
}

/**
 * Seed di una griglia della Settimana: HMAC di un segreto del server sulla data, così nessuno può calcolare in
 * anticipo la griglia di domani. Intero positivo a 31 bit, come i seed delle altre modalità.
 */
export function seedFor(weekStart: string, dayIndex: number): number {
  const digest = createHmac('sha256', config.SESSION_SECRET).update(`week-grid-v1:${weekStart}:${dayIndex}`).digest();
  return digest.readUInt32BE(0) & 0x7fffffff;
}

/** Parametri pubblici di un preset (nessun dato interno). */
export function publicPreset(preset: PresetRow) {
  return {
    slug: preset.slug,
    name: preset.name,
    description: preset.description,
    size: preset.size,
    durationMs: preset.durationMs,
    minWordLength: preset.minWordLength,
    hasBonusCells: preset.bonusCells.length > 0,
    combo: preset.combo,
    pointMode: preset.pointMode,
    positionBonus: preset.positionBonus,
  };
}

/** Preset assegnato a un giorno dal piano settimanale (vale per le griglie non ancora create). */
export async function plannedPresets(): Promise<Map<number, PresetRow>> {
  const rows = await db
    .select({ dayIndex: schema.weekPlan.dayIndex, preset: schema.gamePresets })
    .from(schema.weekPlan)
    .innerJoin(schema.gamePresets, eq(schema.gamePresets.id, schema.weekPlan.presetId));
  return new Map(rows.map((r) => [r.dayIndex, r.preset]));
}

/**
 * La griglia di un giorno: si crea alla prima richiesta e poi resta congelata (seed, parametri, griglia e
 * soluzioni), anche se il piano o il dizionario cambiano dopo.
 */
export async function ensureGrid(week: string, dayIndex: number): Promise<WeeklyGridRow> {
  const existing = await findGrid(week, dayIndex);
  if (existing) return existing;

  const preset = (await plannedPresets()).get(dayIndex);
  if (!preset) throw new Error(`Nessun preset nel piano settimanale per il giorno ${dayIndex}`);
  const { index, dictionaryVersion } = loadDictionary();
  const gameConfig = presetToConfig(preset, seedFor(week, dayIndex), dictionaryVersion);
  const { grid, solutions } = generateGrid(gameConfig, index);

  await db
    .insert(schema.weeklyGrids)
    .values({
      weekStart: week,
      dayIndex,
      presetId: preset.id,
      config: gameConfig,
      tiles: grid.tiles,
      multipliers: grid.multipliers ?? null,
      solutions: solutions.map((s) => ({ word: s.word, path: s.path })),
      // Si apre a mezzanotte del suo giorno (Roma): l'ora esatta non serve, conta il giorno di calendario
      unlocksAt: new Date(`${week}T00:00:00Z`),
    })
    .onConflictDoNothing();

  const created = await findGrid(week, dayIndex);
  if (!created) throw new Error('Griglia della Settimana non creata');
  return created;
}

async function findGrid(week: string, dayIndex: number): Promise<WeeklyGridRow | undefined> {
  const rows = await db.select().from(schema.weeklyGrids).where(eq(schema.weeklyGrids.weekStart, week));
  return rows.find((r) => r.dayIndex === dayIndex);
}

/** Griglia e soluzioni congelate nel formato che usano il core e il client. */
export function frozenGrid(row: WeeklyGridRow): { grid: Grid; solutions: Solution[] } {
  const grid: Grid = {
    size: row.config.size,
    tiles: row.tiles as Grid['tiles'],
    ...(row.multipliers ? { multipliers: row.multipliers } : {}),
  };
  return { grid, solutions: row.solutions };
}
