import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createSession, isOver, remainingMs, submitPath, summarize } from './session.js';
import type { GameConfig, Grid, Solution } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(__dirname, '..', '..', '..', 'fixtures', 'session.json');

interface SessionEventFixture {
  description: string;
  path: number[];
  now: number;
  result: { kind: string; word?: string; points?: number };
}

interface SessionFixture {
  config: GameConfig;
  grid: Grid;
  solutions: Solution[];
  events: SessionEventFixture[];
}

const fixture: SessionFixture = JSON.parse(readFileSync(fixturePath, 'utf-8'));

describe('submitPath contro la fixture session.json', () => {
  it('riproduce ogni evento nell ordine registrato', () => {
    const startedAt = fixture.events[0]!.now - 1000;
    let session = createSession(fixture.config, fixture.grid, fixture.solutions, startedAt);

    for (const event of fixture.events) {
      const { session: next, result } = submitPath(session, event.path, event.now);
      expect(result).toEqual(event.result);
      session = next;
    }
  });

  it('copre ogni valore di result.kind', () => {
    const kinds = new Set(fixture.events.map((e) => e.result.kind));
    expect(kinds).toEqual(
      new Set(['valid', 'already_found', 'not_in_dictionary', 'too_short', 'invalid_path', 'time_over']),
    );
  });
});

describe('submitPath — ordine dei controlli (SPEC.md §5.8)', () => {
  const config: GameConfig = {
    seed: 1,
    size: 4,
    durationMs: 1000,
    minWordLength: 3,
    minWords: 1,
    scoring: 'classic',
    pointMode: 'standard',
    positionBonus: false,
    generatorVersion: 1,
    dictionaryVersion: 'test',
  };
  const grid: Grid = { size: 4, tiles: ['c', 'a', 's', 'a', 'r', 'e', 't', 'e', 'p', 'o', 'r', 't', 'a', 'l', 'e', 'n'] };
  const solutions: Solution[] = [{ word: 'casa', path: [0, 1, 2, 3] }];

  it('time_over ha precedenza su tutto il resto', () => {
    const session = createSession(config, grid, solutions, 0);
    const { result } = submitPath(session, [0, 1, 2, 3], 2000);
    expect(result.kind).toBe('time_over');
  });

  it('invalid_path ha precedenza su too_short', () => {
    const session = createSession(config, grid, solutions, 0);
    const { result } = submitPath(session, [0, 15], 10);
    expect(result.kind).toBe('invalid_path');
  });

  it('too_short ha precedenza su already_found e not_in_dictionary', () => {
    const session = createSession(config, grid, solutions, 0);
    const { result } = submitPath(session, [0, 1], 10);
    expect(result.kind).toBe('too_short');
  });

  it('already_found ha precedenza su not_in_dictionary', () => {
    let session = createSession(config, grid, solutions, 0);
    session = submitPath(session, [0, 1, 2, 3], 10).session;
    const { result } = submitPath(session, [0, 1, 2, 3], 20);
    expect(result.kind).toBe('already_found');
  });

  it('valid include word e points', () => {
    const session = createSession(config, grid, solutions, 0);
    const { result } = submitPath(session, [0, 1, 2, 3], 10);
    expect(result).toEqual({ kind: 'valid', word: 'casa', points: 2 });
  });
});

describe('rejectedWords — parole not_in_dictionary tentate', () => {
  const config: GameConfig = {
    seed: 1,
    size: 4,
    durationMs: 1000,
    minWordLength: 3,
    minWords: 1,
    scoring: 'classic',
    pointMode: 'standard',
    positionBonus: false,
    generatorVersion: 1,
    dictionaryVersion: 'test',
  };
  const grid: Grid = { size: 4, tiles: ['c', 'a', 's', 'a', 'r', 'e', 't', 'e', 'p', 'o', 'r', 't', 'a', 'l', 'e', 'n'] };
  const solutions: Solution[] = [{ word: 'casa', path: [0, 1, 2, 3] }];

  it('registra una parola not_in_dictionary con il suo percorso', () => {
    const session = createSession(config, grid, solutions, 0);
    const { session: next, result } = submitPath(session, [8, 9, 10, 11], 10);
    expect(result.kind).toBe('not_in_dictionary');
    expect(next.rejectedWords).toEqual([{ word: 'port', path: [8, 9, 10, 11] }]);
  });

  it('non duplica la stessa parola rifiutata più volte', () => {
    let session = createSession(config, grid, solutions, 0);
    session = submitPath(session, [8, 9, 10, 11], 10).session;
    session = submitPath(session, [8, 9, 10, 11], 20).session;
    expect(session.rejectedWords).toHaveLength(1);
  });

  it('non registra parole accettate o troppo corte', () => {
    let session = createSession(config, grid, solutions, 0);
    session = submitPath(session, [0, 1, 2, 3], 10).session;
    session = submitPath(session, [0, 1], 20).session;
    expect(session.rejectedWords).toEqual([]);
  });
});

describe('remainingMs / isOver', () => {
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
  };
  const grid: Grid = { size: 4, tiles: Array(16).fill('a') };

  it('remainingMs decresce nel tempo e non va sotto zero', () => {
    const session = createSession(config, grid, [], 1000);
    expect(remainingMs(session, 1000)).toBe(120_000);
    expect(remainingMs(session, 121_000)).toBe(0);
    expect(remainingMs(session, 999_999)).toBe(0);
  });

  it('isOver e vero solo dopo la durata configurata', () => {
    const session = createSession(config, grid, [], 1000);
    expect(isOver(session, 1000)).toBe(false);
    expect(isOver(session, 120_999)).toBe(false);
    expect(isOver(session, 121_000)).toBe(true);
  });
});

describe('summarize', () => {
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
  };
  const grid: Grid = { size: 4, tiles: ['c', 'a', 's', 'a', 'r', 'e', 't', 'e', 'p', 'o', 'r', 't', 'a', 'l', 'e', 'n'] };
  const solutions: Solution[] = [
    { word: 'casa', path: [0, 1, 2, 3] },
    { word: 'rete', path: [4, 5, 6, 7] },
  ];

  it('calcola punteggio, totali e percentuale trovata', () => {
    let session = createSession(config, grid, solutions, 0);
    session = submitPath(session, [0, 1, 2, 3], 10).session;
    const summary = summarize(session);

    expect(summary.foundWords).toHaveLength(1);
    expect(summary.score).toBe(2);
    expect(summary.totalWords).toBe(2);
    expect(summary.maxScore).toBe(4);
    expect(summary.foundPercentage).toBe(50);
    expect(summary.missedWords).toEqual([{ word: 'rete', path: [4, 5, 6, 7] }]);
  });
});
