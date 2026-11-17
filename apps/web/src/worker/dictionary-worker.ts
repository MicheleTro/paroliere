import { buildWordIndex, generateGridWithAdditions, parseDictionary } from '@paroliere/core';
import type { GameConfig, Grid, Solution, WordIndex } from '@paroliere/core';

interface Manifest {
  version: string;
  file: string;
}

export type NewGameConfig = Omit<GameConfig, 'dictionaryVersion'>;

export type WorkerRequest = { type: 'newGame'; config: NewGameConfig };

export type WorkerResponse =
  | { type: 'ready'; dictionaryVersion: string; display: [string, string][] }
  | { type: 'grid'; grid: Grid; solutions: Solution[]; attempts: number; dictionaryVersion: string };

let wordIndex: WordIndex | undefined;
let additionsIndex: WordIndex | undefined;
let dictionaryVersion: string | undefined;

/**
 * Parole approvate dagli admin dopo la pubblicazione del dizionario (stanno sul server). Se non arrivano si
 * gioca col solo dizionario: nelle sfide decide comunque il server.
 */
async function loadAdditions(): Promise<WordIndex | undefined> {
  try {
    const res = await fetch('/api/dictionary/additions', { credentials: 'same-origin' });
    if (!res.ok) return undefined;
    const { words } = (await res.json()) as { words: string[] };
    return words.length > 0 ? buildWordIndex(words) : undefined;
  } catch {
    return undefined;
  }
}

async function init(): Promise<void> {
  const additionsPromise = loadAdditions();
  const manifest = (await fetch('/dictionary/manifest.json').then((r) => r.json())) as Manifest;
  const text = await fetch(`/dictionary/${manifest.file}`).then((r) => r.text());
  const { words, display } = parseDictionary(text);

  wordIndex = buildWordIndex(words);
  dictionaryVersion = manifest.version;
  additionsIndex = await additionsPromise;

  const response: WorkerResponse = { type: 'ready', dictionaryVersion, display: [...display] };
  postMessage(response);
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  if (!wordIndex || !dictionaryVersion) return;

  if (event.data.type === 'newGame') {
    const config: GameConfig = { ...event.data.config, dictionaryVersion };
    const { grid, solutions, attempts } = generateGridWithAdditions(config, wordIndex, additionsIndex);
    const response: WorkerResponse = {
      type: 'grid',
      grid,
      solutions,
      attempts,
      dictionaryVersion,
    };
    postMessage(response);
  }
};

void init();
