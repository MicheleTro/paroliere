import { buildWordIndex, generateGrid } from '@paroliere/core';
import type { GameConfig, Grid, Solution, WordIndex } from '@paroliere/core';

interface Manifest {
  version: string;
  file: string;
}

export type NewGameConfig = Omit<GameConfig, 'dictionaryVersion'>;

export type WorkerRequest = { type: 'newGame'; config: NewGameConfig };

export type WorkerResponse =
  | { type: 'ready'; dictionaryVersion: string }
  | { type: 'grid'; grid: Grid; solutions: Solution[]; attempts: number; dictionaryVersion: string };

let wordIndex: WordIndex | undefined;
let dictionaryVersion: string | undefined;

async function init(): Promise<void> {
  const manifest = (await fetch('/dictionary/manifest.json').then((r) => r.json())) as Manifest;
  const text = await fetch(`/dictionary/${manifest.file}`).then((r) => r.text());
  const words = text.split('\n').filter((w) => w.length > 0);

  wordIndex = buildWordIndex(words);
  dictionaryVersion = manifest.version;

  const response: WorkerResponse = { type: 'ready', dictionaryVersion };
  postMessage(response);
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  if (!wordIndex || !dictionaryVersion) return;

  if (event.data.type === 'newGame') {
    const config: GameConfig = { ...event.data.config, dictionaryVersion };
    const { grid, solutions, attempts } = generateGrid(config, wordIndex);
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
