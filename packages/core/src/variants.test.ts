import { describe, expect, it } from 'vitest';

import { drawBonusMultipliers, pathMultiplier } from './bonus.js';
import { createSession, submitPath } from './session.js';
import { COMBO_WINDOW_MS, comboBonus, comboLevel, wordValue } from './scoring.js';
import type { Tile } from './tile.js';
import type { GameConfig, Grid, Solution } from './types.js';

describe('caselle bonus', () => {
  it('assegna un moltiplicatore per valore, su caselle distinte', () => {
    const m = drawBonusMultipliers(42, 5, [3, 2]);
    expect(m).toHaveLength(25);
    expect(m.filter((x) => x === 3)).toHaveLength(1);
    expect(m.filter((x) => x === 2)).toHaveLength(1);
    expect(m.filter((x) => x === 1)).toHaveLength(23);
  });

  it('è deterministico per lo stesso seed e cambia con un seed diverso', () => {
    expect(drawBonusMultipliers(7, 4, [3, 2])).toEqual(drawBonusMultipliers(7, 4, [3, 2]));
    const seeds = new Set(Array.from({ length: 30 }, (_, s) => drawBonusMultipliers(s, 4, [3, 2]).join()));
    expect(seeds.size).toBeGreaterThan(10);
  });

  it('non finisce mai su una casella già occupata, nemmeno riempiendo la griglia', () => {
    const m = drawBonusMultipliers(1, 4, Array.from({ length: 16 }, () => 2));
    expect(m.every((x) => x === 2)).toBe(true);
  });

  it('rifiuta più bonus che caselle e moltiplicatori non validi', () => {
    expect(() => drawBonusMultipliers(1, 4, Array.from({ length: 17 }, () => 2))).toThrow(RangeError);
    expect(() => drawBonusMultipliers(1, 4, [1])).toThrow(RangeError);
  });

  it('il prodotto sul percorso moltiplica i valori delle caselle attraversate', () => {
    const m = [1, 3, 1, 2];
    expect(pathMultiplier([0, 1, 3], m)).toBe(6);
    expect(pathMultiplier([0, 2], m)).toBe(1);
    expect(pathMultiplier([0, 1], undefined)).toBe(1);
  });

  it('moltiplica il valore della parola', () => {
    const tiles: Tile[] = ['c', 'a', 's', 'a'];
    const grid: Grid = { size: 2, tiles, multipliers: [1, 3, 1, 1] };
    const options = { pointMode: 'standard', positionBonus: false } as const;
    const plain = wordValue('casa', [0, 1, 2, 3], { size: 2, tiles }, options);
    expect(wordValue('casa', [0, 1, 2, 3], grid, options)).toBe(plain * 3);
  });
});

describe('combo', () => {
  it('la prima parola è a livello 1', () => {
    expect(comboLevel(undefined, 1_000)).toBe(1);
  });

  it('entro la finestra sale, oltre la finestra riparte', () => {
    expect(comboLevel({ atMs: 1_000, combo: 1 }, 1_000 + COMBO_WINDOW_MS)).toBe(2);
    expect(comboLevel({ atMs: 1_000, combo: 3 }, 1_000 + COMBO_WINDOW_MS)).toBe(4);
    expect(comboLevel({ atMs: 1_000, combo: 3 }, 1_000 + COMBO_WINDOW_MS + 1)).toBe(1);
  });

  it('il bonus è +1 per livello oltre il primo', () => {
    expect(comboBonus(1)).toBe(0);
    expect(comboBonus(2)).toBe(1);
    expect(comboBonus(5)).toBe(4);
  });

  const tiles: Tile[] = ['c', 'a', 's', 'a', 'r', 'e', 'o', 'l', 'a'];
  function session(combo: boolean) {
    const grid: Grid = { size: 3, tiles };
    const solutions: Solution[] = [
      { word: 'cas', path: [0, 1, 2] },
      { word: 'car', path: [0, 1, 4] },
      { word: 'are', path: [1, 4, 5] },
    ];
    const config: GameConfig = {
      seed: 1,
      size: 4,
      durationMs: 120_000,
      minWordLength: 3,
      minWords: 1,
      scoring: 'classic',
      pointMode: 'standard',
      positionBonus: false,
      generatorVersion: 1,
      dictionaryVersion: 'test',
      combo,
    };
    return createSession(config, grid, solutions, 0);
  }

  it('con la variante attiva, le parole ravvicinate valgono di più', () => {
    let s = session(true);
    const first = submitPath(s, [0, 1, 2], 1_000);
    s = first.session;
    const second = submitPath(s, [0, 1, 4], 3_000);
    s = second.session;
    const third = submitPath(s, [1, 4, 5], 5_000);
    expect(first.result.points).toBe(1);
    expect(second.result.points).toBe(2); // base 1 + combo di livello 2
    expect(third.result.points).toBe(3); // base 1 + combo di livello 3
    expect(third.session.foundWords.map((f) => f.combo)).toEqual([1, 2, 3]);
  });

  it('una pausa lunga azzera la combo', () => {
    let s = session(true);
    s = submitPath(s, [0, 1, 2], 1_000).session;
    const late = submitPath(s, [0, 1, 4], 1_000 + COMBO_WINDOW_MS + 1);
    expect(late.result.points).toBe(1);
  });

  it('senza la variante la combo si traccia ma non dà punti', () => {
    let s = session(false);
    s = submitPath(s, [0, 1, 2], 1_000).session;
    const second = submitPath(s, [0, 1, 4], 2_000);
    expect(second.result.points).toBe(1);
    expect(second.session.foundWords[1]!.combo).toBe(2);
  });

  it('registra il momento della parola dall’inizio della partita', () => {
    const s = submitPath(session(false), [0, 1, 2], 4_321).session;
    expect(s.foundWords[0]!.atMs).toBe(4_321);
  });
});
