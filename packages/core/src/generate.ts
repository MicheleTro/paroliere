import { createRng } from './rng.js';
import { drawGrid } from './grid.js';
import { solve } from './solver.js';
import type { WordIndex } from './word-index.js';
import type { GameConfig, Grid, Solution } from './types.js';

const MAX_ATTEMPTS = 1000;

export interface GenerateResult {
  grid: Grid;
  solutions: Solution[];
  attempts: number;
}

/**
 * Un solo PRNG inizializzato con il seed, mai reinizializzato tra i tentativi
 * (SPEC.md §5.3). Si accetta la prima griglia con almeno `minWords` soluzioni.
 */
export function generateGrid(config: GameConfig, wordIndex: WordIndex): GenerateResult {
  const rng = createRng(config.seed);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const grid = drawGrid(rng, config.size);
    const solutions = solve(grid, wordIndex, config.minWordLength);
    if (solutions.length >= config.minWords) {
      return { grid, solutions, attempts: attempt };
    }
  }

  throw new Error(
    `generateGrid: nessuna griglia con almeno ${config.minWords} parole trovata in ${MAX_ATTEMPTS} tentativi (seed=${config.seed})`,
  );
}

/**
 * Come `generateGrid`, ma con le parole aggiunte dopo la pubblicazione del dizionario (approvate dagli admin).
 * La griglia si sceglie sempre col solo dizionario di base, così lo stesso seed dà la stessa griglia anche se
 * le aggiunte cambiano; le aggiunte entrano solo tra le soluzioni (dopo quelle di base, senza doppioni).
 */
export function generateGridWithAdditions(
  config: GameConfig,
  baseIndex: WordIndex,
  additions?: WordIndex,
): GenerateResult {
  const result = generateGrid(config, baseIndex);
  if (!additions) return result;
  const known = new Set(result.solutions.map((s) => s.word));
  const extra = solve(result.grid, additions, config.minWordLength).filter((s) => !known.has(s.word));
  return extra.length === 0 ? result : { ...result, solutions: [...result.solutions, ...extra] };
}
