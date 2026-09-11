import { classicScoring, generateGrid, type GameConfig } from '../../../packages/core/src/index.js';
import { parseFlags, requireFlag } from './args.js';
import { loadDictionary } from './dict.js';

export function runGrid(argv: string[]): void {
  const flags = parseFlags(argv);
  const seed = Number(requireFlag(flags, 'seed'));
  const dictPath = requireFlag(flags, 'dict');
  const minWords = flags.has('min-words') ? Number(flags.get('min-words')) : 50;

  const { index, dictionaryVersion } = loadDictionary(dictPath);

  const config: GameConfig = {
    seed,
    size: 4,
    durationMs: 120_000,
    minWordLength: 3,
    minWords,
    scoring: 'classic',
    generatorVersion: 1,
    dictionaryVersion,
  };

  const { grid, solutions, attempts } = generateGrid(config, index);

  console.log(`Griglia (seed=${seed}, tentativi=${attempts}):`);
  for (let row = 0; row < grid.size; row++) {
    const rowTiles = grid.tiles.slice(row * grid.size, (row + 1) * grid.size);
    console.log('  ' + rowTiles.map((t) => t.toUpperCase().padEnd(2)).join(' '));
  }

  console.log(`\nTentativi: ${attempts}`);
  console.log(`Parole trovate: ${solutions.length}`);

  const byLength = new Map<number, string[]>();
  for (const s of solutions) {
    const length = s.word.length;
    const list = byLength.get(length) ?? [];
    list.push(s.word);
    byLength.set(length, list);
  }
  console.log('\nParole per lunghezza:');
  for (const length of [...byLength.keys()].sort((a, b) => a - b)) {
    const words = byLength.get(length)!;
    console.log(`  ${length}: ${words.length} (${words.join(', ')})`);
  }

  const maxScore = solutions.reduce((sum, s) => sum + classicScoring.scoreWord(s.word, s.path, grid), 0);
  console.log(`\nPunteggio massimo: ${maxScore}`);
}
