import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { solve } from './solver.js';
import { buildWordIndex, type WordIndex } from './word-index.js';
import { drawGrid } from './grid.js';
import { createRng } from './rng.js';
import { tileLetterCount } from './tile.js';
import type { Grid, Solution } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, '..', '..', '..', 'fixtures');

const dictSmallWords = readFileSync(join(fixturesDir, 'dict-small.txt'), 'utf-8')
  .split('\n')
  .map((w) => w.trim())
  .filter((w) => w.length > 0);
const smallIndex = buildWordIndex(dictSmallWords);

interface SolverFixture {
  grid: Grid;
  solutions: Solution[];
}

const solverFixtures: SolverFixture[] = JSON.parse(
  readFileSync(join(fixturesDir, 'solver.json'), 'utf-8'),
);

describe('solve contro le fixture', () => {
  it.each(solverFixtures.map((f, i) => ({ ...f, i })))(
    'riproduce le soluzioni della fixture #$i',
    (fixture) => {
      const solutions = solve(fixture.grid, smallIndex, 3);
      expect(solutions).toEqual(fixture.solutions);
    },
  );

  it('almeno una fixture contiene una casella Qu', () => {
    expect(solverFixtures.some((f) => f.grid.tiles.includes('qu'))).toBe(true);
  });
});

describe('solve — casi di base', () => {
  it('trova una parola semplice su una griglia minimale', () => {
    const grid: Grid = { size: 4, tiles: ['c', 'a', 's', 'a', 'r', 'e', 't', 'e', 'p', 'o', 'r', 't', 'a', 'l', 'e', 'n'] };
    const solutions = solve(grid, smallIndex, 3);
    const words = solutions.map((s) => s.word);
    expect(words).toContain('casa');
  });

  it('rispetta la soglia minWordLength contata in lettere (qu = 2)', () => {
    const grid: Grid = { size: 4, tiles: ['qu', 'a', 'l', 'e', 'a', 'b', 'c', 'd', 'a', 'b', 'c', 'd', 'a', 'b', 'c', 'd'] };
    const solutions = solve(grid, smallIndex, 3);
    for (const s of solutions) {
      const letterCount = s.path.reduce((sum, i) => sum + tileLetterCount(grid.tiles[i]!), 0);
      expect(letterCount).toBeGreaterThanOrEqual(3);
    }
  });

  it('ogni percorso usa caselle adiacenti e non ripetute', () => {
    for (const fixture of solverFixtures) {
      const solutions = solve(fixture.grid, smallIndex, 3);
      for (const s of solutions) {
        const seen = new Set<number>();
        for (let i = 0; i < s.path.length; i++) {
          const index = s.path[i]!;
          expect(seen.has(index)).toBe(false);
          seen.add(index);
        }
      }
    }
  });

  it('la lista finale e ordinata per code unit', () => {
    for (const fixture of solverFixtures) {
      const solutions = solve(fixture.grid, smallIndex, 3);
      const words = solutions.map((s) => s.word);
      const sorted = [...words].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
      expect(words).toEqual(sorted);
    }
  });
});

// --- Property test: brute force su percorsi fino a 5 caselle, senza librerie ---

const NEIGHBOR_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

function bruteNeighbors(index: number, size: number): number[] {
  const row = Math.floor(index / size);
  const col = index % size;
  const result: number[] = [];
  for (const [dRow, dCol] of NEIGHBOR_OFFSETS) {
    const r = row + dRow;
    const c = col + dCol;
    if (r >= 0 && r < size && c >= 0 && c < size) result.push(r * size + c);
  }
  return result;
}

function isWordInIndex(word: string, index: WordIndex): boolean {
  let node = index.root;
  for (let i = 0; i < word.length; i++) {
    node = index.child(node, word[i]!);
    if (node === -1) return false;
  }
  return index.isWord(node);
}

/** Enumera tutti i percorsi fino a `maxCells` caselle, senza alcuna potatura sui prefissi. */
function bruteForceWords(
  grid: Grid,
  index: WordIndex,
  minWordLength: number,
  maxCells: number,
): Set<string> {
  const words = new Set<string>();

  function visit(path: number[], visitedMask: number): void {
    if (path.length > 0) {
      const word = path.map((i) => grid.tiles[i]).join('');
      const letterCount = path.reduce((sum, i) => sum + tileLetterCount(grid.tiles[i]!), 0);
      if (letterCount >= minWordLength && isWordInIndex(word, index)) {
        words.add(word);
      }
    }
    if (path.length >= maxCells) return;
    const last = path[path.length - 1];
    const candidates = last === undefined ? grid.tiles.map((_, i) => i) : bruteNeighbors(last, grid.size);
    for (const next of candidates) {
      if ((visitedMask & (1 << next)) === 0) {
        visit([...path, next], visitedMask | (1 << next));
      }
    }
  }

  visit([], 0);
  return words;
}

describe('property test: solve non perde parole trovate da un brute force fino a 5 caselle', () => {
  const seeds = [1, 2, 3, 4, 5, 6, 7, 8];

  it.each(seeds)('seed=%i', (seed) => {
    const grid = drawGrid(createRng(seed), 4);
    const bruteWords = bruteForceWords(grid, smallIndex, 3, 5);
    const solvedWords = new Set(solve(grid, smallIndex, 3).map((s) => s.word));

    for (const word of bruteWords) {
      expect(solvedWords.has(word)).toBe(true);
    }
  });
});
