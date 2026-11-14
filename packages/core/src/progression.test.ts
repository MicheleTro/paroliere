import { describe, expect, it } from 'vitest';

import { duelsUnlocked, levelFromXp, starBonus, xpForLevel, xpToAdvance } from './progression.js';

describe('xpToAdvance', () => {
  it('segue round(60 · n^1.4) con i valori della specifica', () => {
    expect(xpToAdvance(1)).toBe(60);
    expect(xpToAdvance(4)).toBe(418);
    expect(xpToAdvance(9)).toBe(1300);
  });

  it('rifiuta livelli non validi', () => {
    expect(() => xpToAdvance(0)).toThrow(RangeError);
    expect(() => xpToAdvance(1.5)).toThrow(RangeError);
  });
});

describe('levelFromXp', () => {
  it('parte dal livello 1 a 0 XP', () => {
    expect(levelFromXp(0)).toEqual({ level: 1, xpInLevel: 0, xpForNext: 60, xpRemaining: 60 });
  });

  it('sale esattamente alla soglia', () => {
    expect(levelFromXp(59).level).toBe(1);
    expect(levelFromXp(60)).toMatchObject({ level: 2, xpInLevel: 0 });
  });

  it('è coerente con xpForLevel per molti livelli', () => {
    for (let level = 1; level <= 60; level++) {
      const start = xpForLevel(level);
      expect(levelFromXp(start).level).toBe(level);
      expect(levelFromXp(start + xpToAdvance(level) - 1).level).toBe(level);
      expect(levelFromXp(start + xpToAdvance(level)).level).toBe(level + 1);
    }
  });

  it('non ha un livello massimo', () => {
    expect(levelFromXp(10_000_000).level).toBeGreaterThan(100);
  });

  it('rifiuta XP negativi o non finiti', () => {
    expect(() => levelFromXp(-1)).toThrow(RangeError);
    expect(() => levelFromXp(Number.NaN)).toThrow(RangeError);
  });
});

describe('sblocco delle sfide', () => {
  it('si apre al livello 5', () => {
    expect(duelsUnlocked(xpForLevel(5) - 1)).toBe(false);
    expect(duelsUnlocked(xpForLevel(5))).toBe(true);
  });
});

describe('stelle di Gioca', () => {
  it('nessuna stella sotto i 20 punti', () => {
    expect(starBonus(0)).toBeNull();
    expect(starBonus(19)).toBeNull();
  });

  it('conta la stella più alta raggiunta, senza sommare i moltiplicatori', () => {
    expect(starBonus(20)).toEqual({ star: 'bronzo', multiplier: 1.2, xp: 4 });
    expect(starBonus(49)).toEqual({ star: 'bronzo', multiplier: 1.2, xp: 9 });
    expect(starBonus(50)).toEqual({ star: 'argento', multiplier: 1.3, xp: 15 });
    expect(starBonus(80)).toEqual({ star: 'oro', multiplier: 1.5, xp: 40 });
    expect(starBonus(100)).toEqual({ star: 'oro', multiplier: 1.5, xp: 50 });
  });
});
