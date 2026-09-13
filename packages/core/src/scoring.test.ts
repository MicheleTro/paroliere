import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { classicScoring, getScoringRule, registerScoringRule } from './scoring.js';
import type { Grid } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(__dirname, '..', '..', '..', 'fixtures', 'scoring.json');

interface ScoringFixtureEntry {
  word: string;
  path: number[];
  points: number;
}

const fixture: ScoringFixtureEntry[] = JSON.parse(readFileSync(fixturePath, 'utf-8'));
const emptyGrid: Grid = { size: 4, tiles: [] };

describe('classicScoring — tabella RF-12', () => {
  it.each(fixture)('assegna $points punti a "$word"', (entry) => {
    expect(classicScoring.scoreWord(entry.word, entry.path, emptyGrid)).toBe(entry.points);
  });

  it.each([
    ['abc', 1],
    ['abcd', 2],
    ['abcde', 3],
    ['abcdef', 4],
    ['abcdefg', 5],
    ['abcdefgh', 6],
    ['abcdefghijklmnop', 14],
  ] as const)('lunghezza %s -> %i punti', (word, expected) => {
    expect(classicScoring.scoreWord(word, [], emptyGrid)).toBe(expected);
  });
});

describe('registro delle regole di punteggio', () => {
  it('getScoringRule("classic") restituisce la regola classica', () => {
    expect(getScoringRule('classic')).toBe(classicScoring);
  });

  it('lancia un errore per una regola non registrata', () => {
    expect(() => getScoringRule('inesistente')).toThrow();
  });

  it('registerScoringRule aggiunge una nuova regola al registro', () => {
    registerScoringRule({ id: 'test-double', scoreWord: (word) => word.length * 2 });
    expect(getScoringRule('test-double').scoreWord('abc', [], emptyGrid)).toBe(6);
  });
});
