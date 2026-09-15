import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { classicScoring, getScoringRule, registerScoringRule, wordValue, type ScoringOptions } from './scoring.js';
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
const standard: ScoringOptions = { pointMode: 'standard', positionBonus: false };

describe('classicScoring — tabella RF-12', () => {
  it.each(fixture)('assegna $points punti a "$word"', (entry) => {
    expect(classicScoring.scoreWord(entry.word, entry.path, emptyGrid, standard)).toBe(entry.points);
  });

  it.each([
    ['abc', 1],
    ['abcd', 2],
    ['abcde', 3],
    ['abcdef', 5],
    ['abcdefg', 7],
    ['abcdefgh', 9],
    ['abcdefghijklmnop', 25],
  ] as const)('lunghezza %s -> %i punti', (word, expected) => {
    expect(classicScoring.scoreWord(word, [], emptyGrid, standard)).toBe(expected);
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
    expect(getScoringRule('test-double').scoreWord('abc', [], emptyGrid, standard)).toBe(6);
  });
});

describe('wordValue — modalità "speciale" e "Bonus Posizione"', () => {
  const grid: Grid = { size: 4, tiles: ['h', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'a'] };

  it('"speciale" aggiunge il valore delle lettere al valore base', () => {
    // "haaa": base 2 (4 lettere) + valori lettere (10+1+1+1=13) = 15
    const value = wordValue('haaa', [0, 1, 2, 3], grid, { pointMode: 'speciale', positionBonus: false });
    expect(value).toBe(15);
  });

  it('"Bonus Posizione" su standard aggiunge (moltiplicatore-1) per lettera', () => {
    // path sugli angoli (x3) e lati (x2) di una griglia 4x4: indici 0 (angolo) e 1 (lato)
    // base "aa" = 0, bonus = 1*(3-1) + 1*(2-1) = 3
    const value = wordValue('aa', [0, 1], grid, { pointMode: 'standard', positionBonus: true });
    expect(value).toBe(3);
  });

  it('"Bonus Posizione" su speciale moltiplica il valore della lettera per la posizione', () => {
    // "ha" con h in un angolo (x3) e a al centro (x1, indice 5): base 0 + speciale (10+1) + bonus (10*2 + 1*0) = 31
    const value = wordValue('ha', [0, 5], grid, { pointMode: 'speciale', positionBonus: true });
    expect(value).toBe(31);
  });
});
