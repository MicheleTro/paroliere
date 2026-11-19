import type { GameConfig } from '@paroliere/core';
import { eq } from 'drizzle-orm';

import { db } from '../db/client.js';
import * as schema from '../db/schema.js';

export type PresetRow = typeof schema.gamePresets.$inferSelect;

/** Preset della partita libera "Gioca". */
export const GIOCA_SLUG = 'gioca';

export async function getPresetBySlug(slug: string): Promise<PresetRow> {
  const [row] = await db.select().from(schema.gamePresets).where(eq(schema.gamePresets.slug, slug)).limit(1);
  if (!row) throw new Error(`Preset "${slug}" mancante: le migrazioni dei dati iniziali non sono state applicate`);
  return row;
}

export async function presetById(tx: Pick<typeof db, 'select'>, id: string): Promise<PresetRow | undefined> {
  const [row] = await tx.select().from(schema.gamePresets).where(eq(schema.gamePresets.id, id)).limit(1);
  return row;
}

/** Parametri di una partita a partire da un preset, un seed e la versione del dizionario in uso. */
export function presetToConfig(preset: PresetRow, seed: number, dictionaryVersion: string): GameConfig {
  return {
    seed,
    size: preset.size as 4 | 5 | 6,
    durationMs: preset.durationMs,
    minWordLength: preset.minWordLength,
    minWords: preset.minWords,
    scoring: 'classic',
    pointMode: preset.pointMode,
    positionBonus: preset.positionBonus,
    generatorVersion: 1,
    dictionaryVersion,
    ...(preset.bonusCells.length > 0 ? { bonusCells: preset.bonusCells } : {}),
    ...(preset.combo ? { combo: true } : {}),
  };
}

/** Scelte del giocatore per una partita libera personalizzata (le stesse delle sfide). */
export interface CustomGameOptions {
  size: 4 | 5 | 6;
  durationMs: number;
  minWordLength: number;
  pointMode: 'standard' | 'speciale';
  positionBonus: boolean;
}

/**
 * Partita libera con le scelte del giocatore al posto di quelle del preset. Le caselle bonus del preset valgono
 * solo per la sua griglia, quindi si tolgono; la combo resta com'è nel preset.
 */
export function customConfig(preset: PresetRow, options: CustomGameOptions, seed: number, dictionaryVersion: string): GameConfig {
  const config: GameConfig = { ...presetToConfig(preset, seed, dictionaryVersion), ...options };
  delete config.bonusCells;
  return config;
}

/** La partita usa esattamente il preset (solo così valgono le stelle di Gioca, tarate su quel formato). */
export function isPresetConfig(config: GameConfig, preset: PresetRow): boolean {
  return (
    config.size === preset.size &&
    config.durationMs === preset.durationMs &&
    config.minWordLength === preset.minWordLength &&
    config.pointMode === preset.pointMode &&
    config.positionBonus === preset.positionBonus
  );
}
