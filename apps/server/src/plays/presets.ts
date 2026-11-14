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
