import type { GameConfig, Grid, Solution } from '@paroliere/core';

import { apiRequest } from './api.js';

// La Settimana: una griglia al giorno, uguale per tutti, un solo tentativo. Il server consegna la griglia già
// pronta con le sue soluzioni (il dizionario del telefono non può cambiare le regole del giorno).

export type DayState = 'locked' | 'blocked' | 'open' | 'recover' | 'in_progress' | 'played' | 'lost';
export type Scope = 'generale' | 'amici';

export interface PresetInfo {
  slug: string;
  name: string;
  description: string;
  size: number;
  durationMs: number;
  minWordLength: number;
  hasBonusCells: boolean;
  combo: boolean;
  pointMode: 'standard' | 'speciale';
  positionBonus: boolean;
}

export interface WeekDay {
  dayIndex: number;
  /** YYYY-MM-DD */
  date: string;
  state: DayState;
  preset: PresetInfo | null;
  myScore: number | null;
  players: number;
}

export interface WeekOverview {
  weekStart: string;
  weekEnd: string;
  today: string;
  todayIndex: number;
  days: WeekDay[];
}

export interface LeaderRow {
  rank: number;
  userId: string;
  username: string;
  score: number;
  wordCount: number;
  me: boolean;
  /** Presenti solo dopo aver giocato quella griglia. */
  words?: string[];
}

export interface DayDetail {
  dayIndex: number;
  date: string;
  state: DayState;
  preset: PresetInfo | null;
  myScore?: number | null;
  scope?: Scope;
  scopeNote?: 'locked' | 'unavailable';
  leaderboard?: LeaderRow[];
  wordsVisible?: boolean;
}

export interface WeekRankingRow {
  rank: number;
  userId: string;
  username: string;
  score: number;
  played: number;
  me: boolean;
}

export interface WeekRanking {
  scope: Scope;
  weekStart?: string;
  locked?: boolean;
  unavailable?: boolean;
  rows: WeekRankingRow[];
}

/** Partita della Settimana: la griglia arriva già pronta. */
export interface StartedWeekPlay {
  id: string;
  seed: number;
  config: GameConfig;
  startedAt: string;
  durationMs: number;
  remainingMs: number;
  helpUsed: boolean;
  streakCycleCompleted?: boolean;
  grid: Grid;
  solutions: Solution[];
}

/** Nome della Settimana, come lo vede il giocatore. */
export const WEEK_NAME = "Sloth's week";

export const DAY_NAMES = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
export const DAY_SHORT = ['LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB', 'DOM'];
const MONTHS = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

/** "13 nov" da una data YYYY-MM-DD. */
export function shortDate(date: string): string {
  const [, month, day] = date.split('-').map(Number) as [number, number, number];
  return `${day} ${MONTHS[month - 1]}`;
}

export function getWeek(): Promise<WeekOverview> {
  return apiRequest('/week');
}

export function getDay(day: number, scope: Scope = 'generale'): Promise<DayDetail> {
  return apiRequest(`/week/${day}?scope=${scope}`);
}

export function getWeekRanking(scope: Scope): Promise<WeekRanking> {
  return apiRequest(`/week/ranking?scope=${scope}`);
}

export function startWeekDay(day: number, help = false): Promise<StartedWeekPlay> {
  return apiRequest(`/week/${day}/start`, { method: 'POST', body: JSON.stringify({ help }) });
}

export function presetFacts(preset: PresetInfo): string[] {
  const facts = [`${preset.size}×${preset.size}`, `${Math.round((preset.durationMs / 60_000) * 10) / 10} min`];
  if (preset.minWordLength > 3) facts.push(`${preset.minWordLength}+ lettere`);
  if (preset.hasBonusCells) facts.push('caselle bonus');
  if (preset.combo) facts.push('combo');
  if (preset.pointMode === 'speciale') facts.push('punti per lettera');
  if (preset.positionBonus) facts.push('bonus posizione');
  return facts;
}
