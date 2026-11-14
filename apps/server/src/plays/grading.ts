import {
  classicScoring,
  comboBonus,
  comboLevel,
  generateGrid,
  neighbors,
  type GameConfig,
  type Grid,
  type WordIndex,
} from '@paroliere/core';

import type { ScoredWord } from '../progress/service.js';

export interface SubmittedWord {
  path: number[];
  /** Millisecondi dall'inizio della partita dichiarati dal client (servono solo alla combo). */
  atMs: number;
}

function isValidPath(path: number[], grid: Grid): boolean {
  if (path.length === 0) return false;
  const seen = new Set<number>();
  for (let i = 0; i < path.length; i++) {
    const index = path[i]!;
    if (index < 0 || index >= grid.tiles.length) return false;
    if (seen.has(index)) return false;
    seen.add(index);
    if (i > 0 && !neighbors(path[i - 1]!, grid.size).includes(index)) return false;
  }
  return true;
}

/**
 * Rivaluta i percorsi ricevuti su una griglia già nota (RF-22): il client non decide mai il proprio punteggio.
 * I punti sono il valore base della parola secondo la configurazione (caselle bonus e opzioni incluse), più il bonus
 * combo se la partita lo prevede; nelle sfide Versus il punteggio ufficiale si calcola a parte con
 * `computeVersusScores`. I tempi dichiarati servono solo alla combo e vengono resi coerenti: mai decrescenti, mai
 * oltre `maxAtMs`.
 */
export function gradeOnGrid(
  config: GameConfig,
  grid: Grid,
  solutionWords: ReadonlySet<string>,
  submitted: readonly SubmittedWord[],
  maxAtMs: number = config.durationMs,
): ScoredWord[] {
  const found = new Map<string, ScoredWord>();
  let last: ScoredWord | undefined;
  let previousAtMs = 0;

  for (const entry of submitted) {
    if (!isValidPath(entry.path, grid)) continue;
    const word = entry.path.map((i) => grid.tiles[i]).join('');
    if (found.has(word) || !solutionWords.has(word)) continue;

    const atMs = Math.min(maxAtMs, Math.max(previousAtMs, Math.max(0, Math.floor(entry.atMs))));
    previousAtMs = atMs;
    const combo = comboLevel(last, atMs);
    const points = classicScoring.scoreWord(word, entry.path, grid, config) + (config.combo ? comboBonus(combo) : 0);
    last = { word, path: entry.path, points, atMs, combo };
    found.set(word, last);
  }

  return [...found.values()];
}

/** Come `gradeOnGrid`, ma rigenera la griglia dal seed con il dizionario del server (Gioca e sfide). */
export function gradeSubmission(
  config: GameConfig,
  index: WordIndex,
  submitted: readonly SubmittedWord[],
  maxAtMs: number = config.durationMs,
): ScoredWord[] {
  const { grid, solutions } = generateGrid(config, index);
  return gradeOnGrid(config, grid, new Set(solutions.map((s) => s.word)), submitted, maxAtMs);
}
