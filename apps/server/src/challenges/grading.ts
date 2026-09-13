import { classicScoring, generateGrid, neighbors, type GameConfig, type Grid, type WordIndex } from '@paroliere/core';

export interface GradedWord {
  word: string;
  path: number[];
  points: number;
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
 * Rivalida i percorsi grezzi ricevuti dal client rigenerando la griglia dal
 * seed del match (RF-22): il client non decide mai il proprio punteggio.
 * `points` è sempre il valore base RF-12 — per 'versus' il punteggio
 * ufficiale si calcola a parte con computeVersusScores.
 */
export function gradeSubmission(config: GameConfig, index: WordIndex, paths: readonly number[][]): GradedWord[] {
  const { grid, solutions } = generateGrid(config, index);
  const solutionsByWord = new Map(solutions.map((s) => [s.word, s]));
  const found = new Map<string, GradedWord>();

  for (const path of paths) {
    if (!isValidPath(path, grid)) continue;
    const word = path.map((i) => grid.tiles[i]).join('');
    if (found.has(word) || !solutionsByWord.has(word)) continue;
    found.set(word, { word, path, points: classicScoring.scoreWord(word, path, grid) });
  }

  return [...found.values()];
}
