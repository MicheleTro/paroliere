import { neighbors } from './grid.js';
import { tileLetterCount } from './tile.js';
import type { WordIndex } from './word-index.js';
import type { Grid, Solution } from './types.js';

/**
 * DFS da ogni casella in ordine di indice, vicini in ordine NW,N,NE,W,E,SW,S,SE
 * (SPEC.md §5.6). La casella "qu" si percorre come due passi consecutivi nel trie.
 * Il primo percorso trovato nell'ordine di visita è quello conservato per ogni parola.
 */
export function solve(grid: Grid, wordIndex: WordIndex, minWordLength: number): Solution[] {
  const found = new Map<string, number[]>();
  const path: number[] = [];
  const neighborCache = new Map<number, number[]>();
  const neighborsOf = (index: number): number[] => {
    let cached = neighborCache.get(index);
    if (!cached) {
      cached = neighbors(index, grid.size);
      neighborCache.set(index, cached);
    }
    return cached;
  };

  function visit(index: number, visitedMask: number, node: number, letterCount: number): void {
    const tile = grid.tiles[index]!;
    let currentNode = node;
    for (let i = 0; i < tile.length; i++) {
      currentNode = wordIndex.child(currentNode, tile[i]!);
      if (currentNode === -1) return;
    }
    const newLetterCount = letterCount + tileLetterCount(tile);
    path.push(index);
    const newMask = visitedMask | (1 << index);

    if (wordIndex.isWord(currentNode) && newLetterCount >= minWordLength) {
      const word = path.map((i) => grid.tiles[i]).join('');
      if (!found.has(word)) {
        found.set(word, [...path]);
      }
    }

    for (const next of neighborsOf(index)) {
      if ((newMask & (1 << next)) === 0) {
        visit(next, newMask, currentNode, newLetterCount);
      }
    }

    path.pop();
  }

  for (let start = 0; start < grid.tiles.length; start++) {
    visit(start, 0, wordIndex.root, 0);
  }

  const solutions: Solution[] = [...found.entries()].map(([word, solutionPath]) => ({
    word,
    path: solutionPath,
  }));
  solutions.sort((a, b) => (a.word < b.word ? -1 : a.word > b.word ? 1 : 0));
  return solutions;
}
