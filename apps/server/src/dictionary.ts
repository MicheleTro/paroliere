import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildWordIndex, type WordIndex } from '@paroliere/core';

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
  const words = text.split(/\r?\n/).filter((w) => w.length > 0);
  cached = { index: buildWordIndex(words), dictionaryVersion: manifest.version };
  return cached;
}
