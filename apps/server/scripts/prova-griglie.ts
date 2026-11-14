// Verifica, senza database, che ogni giornata della Settimana si generi con almeno 80 parole (quante ne servono
// e quanto tempo richiede) su molti seed. Uso: pnpm --filter @paroliere/server exec tsx --env-file=.env scripts/prova-griglie.ts
import { generateGrid, type GameConfig } from '@paroliere/core';

import { loadDictionary } from '../src/dictionary.js';

const { index, dictionaryVersion } = loadDictionary();

const base = { minWords: 80, scoring: 'classic', generatorVersion: 1, dictionaryVersion } as const;
const VARIANTI: { nome: string; config: Omit<GameConfig, 'seed'> }[] = [
  { nome: 'lun classica 4x4', config: { ...base, size: 4, durationMs: 90_000, minWordLength: 3, pointMode: 'standard', positionBonus: false } },
  { nome: 'mar lunghe 4x4 (4+)', config: { ...base, size: 4, durationMs: 90_000, minWordLength: 4, pointMode: 'standard', positionBonus: false } },
  { nome: 'mer speciale 5x5', config: { ...base, size: 5, durationMs: 90_000, minWordLength: 3, pointMode: 'speciale', positionBonus: false } },
  { nome: 'gio posizione 6x6', config: { ...base, size: 6, durationMs: 90_000, minWordLength: 3, pointMode: 'standard', positionBonus: true } },
  { nome: 'ven combo 5x5', config: { ...base, size: 5, durationMs: 90_000, minWordLength: 3, pointMode: 'standard', positionBonus: false, combo: true } },
  { nome: 'sab misto 5x5', config: { ...base, size: 5, durationMs: 90_000, minWordLength: 3, pointMode: 'speciale', positionBonus: true } },
  { nome: 'dom finale 6x6', config: { ...base, size: 6, durationMs: 120_000, minWordLength: 3, pointMode: 'speciale', positionBonus: true, combo: true } },
];

let failures = 0;
for (const { nome, config } of VARIANTI) {
  const times: number[] = [];
  const counts: number[] = [];
  for (let seed = 1; seed <= 30; seed++) {
    const started = Date.now();
    try {
      const { solutions } = generateGrid({ ...config, seed: seed * 7919 }, index);
      counts.push(solutions.length);
    } catch {
      failures++;
      counts.push(0);
    }
    times.push(Date.now() - started);
  }
  const max = Math.max(...times);
  console.log(`${nome}: parole min ${Math.min(...counts)} · max ${Math.max(...counts)} · tempo medio ${Math.round(times.reduce((a, b) => a + b, 0) / times.length)} ms · peggiore ${max} ms`);
}
console.log(failures === 0 ? 'Tutte le griglie generate' : `${failures} griglie non generate`);
process.exit(failures === 0 ? 0 : 1);
