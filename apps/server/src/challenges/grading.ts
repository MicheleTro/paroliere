import { classicScoring, generateGridWithAdditions, neighbors, type GameConfig, type Grid, type Solution, type WordIndex } from '@paroliere/core';

export interface GradedWord {
  word: string;
  path: number[];
  points: number;
}

export interface SolvedGrid {
  config: GameConfig;
  grid: Grid;
  solutions: Solution[];
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

/** Rigenera la griglia dal seed (dizionario di base) e le sue soluzioni, comprese le parole aggiunte dagli admin. */
export function solveGrid(config: GameConfig, index: WordIndex, additions?: WordIndex): SolvedGrid {
  const { grid, solutions } = generateGridWithAdditions(config, index, additions);
  return { config, grid, solutions };
}

/** Valore base di una parola secondo la configurazione (RF-12 + eventuale "speciale"/Bonus Posizione). */
export function basePoints(solved: SolvedGrid, word: string, path: number[]): number {
  return classicScoring.scoreWord(word, path, solved.grid, solved.config);
}

/**
 * Rivalida i percorsi grezzi ricevuti dal client sulla griglia rigenerata dal seed (RF-22): il client non
 * decide mai il proprio punteggio. I percorsi delle parole che il client ha rifiutato arrivano comunque: se nel
 * frattempo una parola è stata aggiunta al dizionario, vale. `points` è il valore base — per 'versus' il
 * punteggio ufficiale si calcola a parte con computeVersusScores.
 */
export function gradeSubmission(solved: SolvedGrid, paths: readonly number[][]): GradedWord[] {
  const solutionsByWord = new Set(solved.solutions.map((s) => s.word));
  const found = new Map<string, GradedWord>();

  for (const path of paths) {
    if (!isValidPath(path, solved.grid)) continue;
    const word = path.map((i) => solved.grid.tiles[i]).join('');
    if (found.has(word) || !solutionsByWord.has(word)) continue;
    found.set(word, { word, path, points: basePoints(solved, word, path) });
  }

  return [...found.values()];
}
