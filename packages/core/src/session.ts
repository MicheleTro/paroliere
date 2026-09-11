import { neighbors } from './grid.js';
import { getScoringRule } from './scoring.js';
import { tileLetterCount } from './tile.js';
import type { GameConfig, Grid, Solution } from './types.js';

export interface FoundWord {
  word: string;
  path: number[];
  points: number;
}

export interface GameSession {
  readonly config: GameConfig;
  readonly grid: Grid;
  readonly allSolutions: readonly Solution[];
  readonly startedAt: number;
  readonly foundWords: readonly FoundWord[];
  readonly solutionsByWord: ReadonlyMap<string, Solution>;
}

export type SubmitResultKind =
  | 'valid'
  | 'already_found'
  | 'not_in_dictionary'
  | 'too_short'
  | 'invalid_path'
  | 'time_over';

export interface SubmitResult {
  kind: SubmitResultKind;
  word?: string;
  points?: number;
}

export function createSession(
  config: GameConfig,
  grid: Grid,
  solutions: readonly Solution[],
  startedAt: number,
): GameSession {
  const solutionsByWord = new Map(solutions.map((s) => [s.word, s]));
  return {
    config,
    grid,
    allSolutions: solutions,
    startedAt,
    foundWords: [],
    solutionsByWord,
  };
}

export function isOver(session: GameSession, now: number): boolean {
  return now - session.startedAt >= session.config.durationMs;
}

export function remainingMs(session: GameSession, now: number): number {
  return Math.max(0, session.config.durationMs - (now - session.startedAt));
}

function isValidPath(path: number[], grid: Grid): boolean {
  if (path.length === 0) return false;
  const seen = new Set<number>();
  for (let i = 0; i < path.length; i++) {
    const index = path[i]!;
    if (index < 0 || index >= grid.tiles.length) return false;
    if (seen.has(index)) return false;
    seen.add(index);
    if (i > 0) {
      const previous = path[i - 1]!;
      if (!neighbors(previous, grid.size).includes(index)) return false;
    }
  }
  return true;
}

function pathToWord(path: number[], grid: Grid): string {
  return path.map((i) => grid.tiles[i]).join('');
}

function letterCount(path: number[], grid: Grid): number {
  return path.reduce((sum, i) => sum + tileLetterCount(grid.tiles[i]!), 0);
}

/**
 * Ordine dei controlli normativo (SPEC.md §5.8): time_over, invalid_path,
 * too_short, already_found, not_in_dictionary.
 */
export function submitPath(
  session: GameSession,
  path: number[],
  now: number,
): { session: GameSession; result: SubmitResult } {
  if (isOver(session, now)) {
    return { session, result: { kind: 'time_over' } };
  }

  if (!isValidPath(path, session.grid)) {
    return { session, result: { kind: 'invalid_path' } };
  }

  if (letterCount(path, session.grid) < session.config.minWordLength) {
    return { session, result: { kind: 'too_short' } };
  }

  const word = pathToWord(path, session.grid);

  if (session.foundWords.some((f) => f.word === word)) {
    return { session, result: { kind: 'already_found' } };
  }

  const solution = session.solutionsByWord.get(word);
  if (!solution) {
    return { session, result: { kind: 'not_in_dictionary' } };
  }

  const scoringRule = getScoringRule(session.config.scoring);
  const points = scoringRule.scoreWord(word, path, session.grid);
  const foundWord: FoundWord = { word, path, points };

  const nextSession: GameSession = {
    ...session,
    foundWords: [...session.foundWords, foundWord],
  };

  return { session: nextSession, result: { kind: 'valid', word, points } };
}

export interface SessionSummary {
  foundWords: readonly FoundWord[];
  score: number;
  totalWords: number;
  maxScore: number;
  foundPercentage: number;
  missedWords: readonly Solution[];
}

export function summarize(session: GameSession): SessionSummary {
  const scoringRule = getScoringRule(session.config.scoring);
  const score = session.foundWords.reduce((sum, f) => sum + f.points, 0);
  const foundWordSet = new Set(session.foundWords.map((f) => f.word));
  const missedWords = session.allSolutions.filter((s) => !foundWordSet.has(s.word));
  const maxScore = session.allSolutions.reduce(
    (sum, s) => sum + scoringRule.scoreWord(s.word, s.path, session.grid),
    0,
  );
  const totalWords = session.allSolutions.length;
  const foundPercentage = totalWords === 0 ? 0 : (session.foundWords.length / totalWords) * 100;

  return {
    foundWords: session.foundWords,
    score,
    totalWords,
    maxScore,
    foundPercentage,
    missedWords,
  };
}
