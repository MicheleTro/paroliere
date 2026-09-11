import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { generateGrid } from './generate.js';
import { buildWordIndex } from './word-index.js';
import type { GameConfig, Grid, Solution } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, '..', '..', '..', 'fixtures');

const dictSmallWords = readFileSync(join(fixturesDir, 'dict-small.txt'), 'utf-8')
  .split('\n')
  .map((w) => w.trim())
  .filter((w) => w.length > 0);
const smallIndex = buildWordIndex(dictSmallWords);

interface GenerateFixtureEntry {
  config: GameConfig;
  grid: Grid;
  attempts: number;
  solutions: Solution[];
}

const fixtures: GenerateFixtureEntry[] = JSON.parse(
  readFileSync(join(fixturesDir, 'generate.json'), 'utf-8'),
);

describe('generateGrid contro le fixture', () => {
  it.each(fixtures.map((f, i) => ({ ...f, i })))(
    'riproduce grid/attempts/solutions della fixture #$i (seed=$config.seed)',
    (fixture) => {
      const result = generateGrid(fixture.config, smallIndex);
      expect(result.grid).toEqual(fixture.grid);
      expect(result.attempts).toBe(fixture.attempts);
      expect(result.solutions).toEqual(fixture.solutions);
    },
  );
});

describe('generateGrid — determinismo e vincoli', () => {
  const config: GameConfig = {
    seed: 42,
    size: 4,
    durationMs: 120_000,
    minWordLength: 3,
    minWords: 5,
    scoring: 'classic',
    generatorVersion: 1,
    dictionaryVersion: 'test',
  };

  it('stesso seed e stessa configurazione producono la stessa griglia (RF-04)', () => {
    const a = generateGrid(config, smallIndex);
    const b = generateGrid(config, smallIndex);
    expect(a).toEqual(b);
  });

  it('la griglia accettata ha almeno minWords soluzioni', () => {
    const result = generateGrid(config, smallIndex);
    expect(result.solutions.length).toBeGreaterThanOrEqual(config.minWords);
  });

  it('lancia un errore esplicito se non trova una griglia in 1000 tentativi', () => {
    const impossibleConfig: GameConfig = { ...config, minWords: 1_000_000 };
    expect(() => generateGrid(impossibleConfig, smallIndex)).toThrow();
  });
});
