import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { generateGrid, generateGridWithAdditions } from './generate.js';
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
    pointMode: 'standard',
    positionBonus: false,
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

describe('generateGridWithAdditions', () => {
  const config = fixtures[0]!.config;

  it('senza aggiunte coincide con generateGrid', () => {
    expect(generateGridWithAdditions(config, smallIndex)).toEqual(generateGrid(config, smallIndex));
  });

  it('stessa griglia, soluzioni in più per le parole aggiunte presenti nella griglia', () => {
    const base = generateGrid(config, smallIndex);
    const known = new Set(base.solutions.map((s) => s.word));
    // una parola tracciabile nella griglia ma assente dal dizionario di base: le prime tre caselle in riga
    const word = [0, 1, 2].map((i) => base.grid.tiles[i]).join('');
    const additions = buildWordIndex([word, 'zzzzz', ...known]);
    const result = generateGridWithAdditions({ ...config, minWordLength: 1 }, smallIndex, additions);
    expect(result.grid).toEqual(generateGrid({ ...config, minWordLength: 1 }, smallIndex).grid);
    const words = result.solutions.map((s) => s.word);
    expect(new Set(words).size).toBe(words.length);
    expect(words).toContain(word);
    expect(words).not.toContain('zzzzz');
  });
});
