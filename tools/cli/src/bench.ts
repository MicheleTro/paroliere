import { readFileSync } from 'node:fs';
import { buildWordIndex, generateGrid, solve, type GameConfig } from '../../../packages/core/src/index.js';
import { parseFlags, requireFlag, resolveFromInvocationCwd } from './args.js';
import { loadDictionary } from './dict.js';

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[index]!;
}

export function runBench(argv: string[]): void {
  const flags = parseFlags(argv);
  const gridsCount = flags.has('grids') ? Number(flags.get('grids')) : 1000;
  const dictPath = requireFlag(flags, 'dict');
  const minWords = flags.has('min-words') ? Number(flags.get('min-words')) : 50;

  const rawContent = readFileSync(resolveFromInvocationCwd(dictPath), 'utf-8');
  const words = rawContent
    .split('\n')
    .map((w) => w.trim())
    .filter((w) => w.length > 0);

  const heapBefore = process.memoryUsage().heapUsed;
  const buildStart = performance.now();
  const index = buildWordIndex(words);
  const buildTimeMs = performance.now() - buildStart;
  const heapAfter = process.memoryUsage().heapUsed;

  const { dictionaryVersion } = loadDictionary(dictPath);

  console.log('Costruzione indice:');
  console.log(`  tempo: ${buildTimeMs.toFixed(2)} ms`);
  console.log(`  nodi: ${index.nodeCount}`);
  console.log(`  memoria heap (delta): ${((heapAfter - heapBefore) / (1024 * 1024)).toFixed(2)} MB`);

  const attempts: number[] = [];
  const wordCounts: number[] = [];
  const generationTimesMs: number[] = [];
  const solveTimesMs: number[] = [];

  for (let i = 0; i < gridsCount; i++) {
    const config: GameConfig = {
      seed: i,
      size: 4,
      durationMs: 120_000,
      minWordLength: 3,
      minWords,
      scoring: 'classic',
      generatorVersion: 1,
      dictionaryVersion,
    };

    const generationStart = performance.now();
    const result = generateGrid(config, index);
    generationTimesMs.push(performance.now() - generationStart);

    attempts.push(result.attempts);
    wordCounts.push(result.solutions.length);

    const solveStart = performance.now();
    solve(result.grid, index, config.minWordLength);
    solveTimesMs.push(performance.now() - solveStart);
  }

  const sortedAttempts = [...attempts].sort((a, b) => a - b);
  const sortedWordCounts = [...wordCounts].sort((a, b) => a - b);

  console.log(`\nGriglie generate: ${gridsCount}`);
  console.log('\nTentativi per griglia:');
  console.log(`  media: ${(attempts.reduce((s, a) => s + a, 0) / attempts.length).toFixed(2)}`);
  console.log(`  massimo: ${sortedAttempts[sortedAttempts.length - 1]}`);

  console.log('\nParole per griglia:');
  console.log(`  minimo: ${sortedWordCounts[0]}`);
  console.log(`  p50: ${percentile(sortedWordCounts, 50)}`);
  console.log(`  p95: ${percentile(sortedWordCounts, 95)}`);
  console.log(`  massimo: ${sortedWordCounts[sortedWordCounts.length - 1]}`);

  console.log('\nTempo medio:');
  console.log(
    `  generazione (con retry): ${(generationTimesMs.reduce((s, t) => s + t, 0) / generationTimesMs.length).toFixed(3)} ms`,
  );
  console.log(
    `  risoluzione: ${(solveTimesMs.reduce((s, t) => s + t, 0) / solveTimesMs.length).toFixed(3)} ms`,
  );
}
