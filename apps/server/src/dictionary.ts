import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildWordIndex, parseDictionary, type WordIndex } from '@paroliere/core';
import { eq } from 'drizzle-orm';

import { db } from './db/client.js';
import * as schema from './db/schema.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dictionaryDir = join(__dirname, '..', '..', '..', 'dist', 'dictionary');

interface Manifest {
  version: string;
  file: string;
}

export interface LoadedDictionary {
  index: WordIndex;
  dictionaryVersion: string;
}

let cached: LoadedDictionary | undefined;

/**
 * Il server è l'unica fonte autoritativa per dictionaryVersion in una sfida
 * (il client non decide con quale dizionario si gioca): dizionario caricato
 * una sola volta da dist/dictionary (build:dict), stessa convenzione di
 * tools/cli.
 */
export function loadDictionary(): LoadedDictionary {
  if (cached) return cached;
  const manifest = JSON.parse(readFileSync(join(dictionaryDir, 'manifest.json'), 'utf-8')) as Manifest;
  const text = readFileSync(join(dictionaryDir, manifest.file), 'utf-8');
  const { words } = parseDictionary(text);
  cached = { index: buildWordIndex(words), dictionaryVersion: manifest.version };
  return cached;
}

export interface DictionaryAdditions {
  words: string[];
  index: WordIndex;
}

let additions: DictionaryAdditions | undefined;
let loadingAdditions: Promise<DictionaryAdditions> | undefined;

/**
 * Parole approvate dagli admin dopo la pubblicazione del dizionario (segnalazioni dei giocatori). Stanno nel
 * database, non nel file: valgono subito, senza ricostruire il dizionario e senza cambiarne la versione
 * (le griglie si scelgono col dizionario di base, vedi `generateGridWithAdditions`).
 */
export function loadAdditions(): Promise<DictionaryAdditions> {
  if (additions) return Promise.resolve(additions);
  loadingAdditions ??= reloadAdditions().finally(() => (loadingAdditions = undefined));
  return loadingAdditions;
}

export async function reloadAdditions(): Promise<DictionaryAdditions> {
  const rows = await db
    .select({ word: schema.reportedWords.word })
    .from(schema.reportedWords)
    .where(eq(schema.reportedWords.status, 'approved'));
  const words = rows.map((r) => r.word).sort();
  additions = { words, index: buildWordIndex(words) };
  return additions;
}
