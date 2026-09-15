import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  createRng,
  buildWordIndex,
  solve,
  generateGrid,
  classicScoring,
  createSession,
  submitPath,
  type GameConfig,
  type Grid,
  type Tile,
} from '../packages/core/src/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, '..', 'fixtures');

function writeFixture(name: string, data: unknown): void {
  writeFileSync(join(fixturesDir, name), JSON.stringify(data, null, 2) + '\n', 'utf-8');
  console.log(`wrote fixtures/${name}`);
}

// --- prng.json ---
function buildPrngFixture() {
  const seeds = [0, 1, 42, 123456789, 4294967295];
  const nValues = [1, 2, 3, 5, 10, 100, 1000, 999999, 1048576];
  return seeds.map((seed) => {
    const rngForUint32 = createRng(seed);
    const nextUint32 = Array.from({ length: 20 }, () => rngForUint32.nextUint32());

    const rngForInt = createRng(seed);
    const nextInt = Array.from({ length: 20 }, (_, i) =>
      rngForInt.nextInt(nValues[i % nValues.length]!),
    );

    return { seed, nextUint32, nextInt };
  });
}

// --- dict-small index ---
const dictSmallPath = join(fixturesDir, 'dict-small.txt');
const dictSmallWords = readFileSync(dictSmallPath, 'utf-8')
  .split('\n')
  .map((w) => w.trim())
  .filter((w) => w.length > 0);
const smallIndex = buildWordIndex(dictSmallWords);

// --- solver.json ---
const SOLVER_GRIDS: Tile[][] = [
  ['c', 'a', 's', 'a', 'r', 'e', 't', 'e', 'p', 'o', 'r', 't', 'a', 'l', 'e', 'n'],
  ['m', 'a', 'r', 'e', 'l', 'i', 'b', 'r', 'o', 't', 't', 'a', 'v', 'i', 't', 'a'],
  ['qu', 'a', 't', 't', 'r', 'o', 'a', 's', 'i', 'n', 'o', 'r', 't', 'e', 'l', 'a'],
  ['s', 'o', 'l', 'e', 'n', 'o', 't', 't', 'e', 'r', 'a', 'm', 'e', 's', 'e', 'i'],
  ['p', 'a', 'n', 'e', 'c', 'a', 'n', 'i', 's', 'o', 'l', 'a', 't', 'e', 's', 't'],
  ['f', 'i', 'u', 'm', 'e', 'r', 'o', 's', 'a', 't', 'o', 'r', 'r', 'e', 'v', 'a'],
  ['g', 'a', 't', 't', 'o', 'r', 'r', 'e', 'n', 'a', 'v', 'e', 'l', 'a', 'n', 'i'],
  ['a', 'c', 'qu', 'a', 'r', 'i', 'o', 't', 'e', 'l', 'a', 's', 'i', 'n', 'o', 'r'],
  ['l', 'u', 'n', 'a', 't', 'e', 's', 't', 'a', 'r', 'e', 't', 'o', 'r', 'r', 'e'],
  ['v', 'i', 't', 'a', 'l', 'e', 'n', 't', 'o', 'r', 'r', 'e', 'n', 'a', 's', 'o'],
];

function buildSolverFixture() {
  return SOLVER_GRIDS.map((tiles) => {
    const grid: Grid = { size: 4, tiles };
    const solutions = solve(grid, smallIndex, 3);
    return { grid, solutions };
  });
}

// --- generate.json ---
const GENERATE_CONFIGS: GameConfig[] = Array.from({ length: 10 }, (_, i) => ({
  seed: [0, 1, 2, 42, 123, 999, 12345, 777777, 2024, 4000000000][i]!,
  size: 4 as const,
  durationMs: 120_000,
  minWordLength: 3,
  minWords: 5,
  scoring: 'classic' as const,
  pointMode: 'standard' as const,
  positionBonus: false,
  generatorVersion: 1 as const,
  dictionaryVersion: 'fixture-dict-small',
}));

function buildGenerateFixture() {
  return GENERATE_CONFIGS.map((config) => {
    const { grid, solutions, attempts } = generateGrid(config, smallIndex);
    return { config, grid, attempts, solutions };
  });
}

// --- scoring.json ---
function buildScoringFixture() {
  // parole reali di varie lunghezze prese dal dizionario piccolo (3,4,5,6,7,8 lettere)
  const wordsByLength = ['ape', 'sole', 'torre', 'navale', 'atomica', 'principe'];
  return wordsByLength.map((word) => ({
    word,
    path: word.split('').map((_, i) => i),
    points: classicScoring.scoreWord(word, [], { size: 4, tiles: [] }, { pointMode: 'standard', positionBonus: false }),
  }));
}

// --- session.json ---
function buildSessionFixture() {
  const config: GameConfig = {
    seed: 42,
    size: 4,
    durationMs: 120_000,
    minWordLength: 3,
    minWords: 5,
    scoring: 'classic',
    pointMode: 'standard',
    positionBonus: false,
    generatorVersion: 1,
    dictionaryVersion: 'fixture-dict-small',
  };
  const tiles = SOLVER_GRIDS[0]!;
  const grid: Grid = { size: 4, tiles };
  const solutions = solve(grid, smallIndex, config.minWordLength);
  const firstSolution = solutions[0]!;

  const startedAt = 1_000_000;
  let session = createSession(config, grid, solutions, startedAt);
  const events: Array<{
    description: string;
    path: number[];
    now: number;
    expectedKind: string;
  }> = [
    {
      description: 'parola valida',
      path: firstSolution.path,
      now: startedAt + 1_000,
      expectedKind: 'valid',
    },
    {
      description: 'stessa parola gia trovata',
      path: firstSolution.path,
      now: startedAt + 2_000,
      expectedKind: 'already_found',
    },
    {
      description: 'percorso non adiacente',
      path: [0, 15],
      now: startedAt + 3_000,
      expectedKind: 'invalid_path',
    },
    {
      description: 'percorso troppo corto',
      path: [0, 1],
      now: startedAt + 4_000,
      expectedKind: 'too_short',
    },
    {
      description: 'percorso valido ma non nel dizionario',
      path: [0, 4, 8],
      now: startedAt + 5_000,
      expectedKind: 'not_in_dictionary',
    },
    {
      description: 'tempo scaduto',
      path: firstSolution.path,
      now: startedAt + config.durationMs + 1,
      expectedKind: 'time_over',
    },
  ];

  const results: unknown[] = [];
  for (const event of events) {
    const { session: nextSession, result } = submitPath(session, event.path, event.now);
    results.push({ description: event.description, path: event.path, now: event.now, result });
    session = nextSession;
  }

  return { config, grid, solutions, events: results };
}

writeFixture('prng.json', buildPrngFixture());
writeFixture('solver.json', buildSolverFixture());
writeFixture('generate.json', buildGenerateFixture());
writeFixture('scoring.json', buildScoringFixture());
writeFixture('session.json', buildSessionFixture());
