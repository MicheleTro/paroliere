import type { GameConfig } from '@paroliere/core';

import { apiRequest } from './api.js';

// Partita libera "Gioca": il server decide seed e inizio, rivaluta i percorsi e assegna XP, parole nuove e medaglie.

export interface StartedPlay {
  id: string;
  seed: number;
  config: GameConfig;
  startedAt: string;
  durationMs: number;
  /** Tempo che resta, calcolato dal server (vale anche se si riprende una partita già iniziata). */
  remainingMs: number;
  helpUsed: boolean;
  /** Questa partita ha chiuso un ciclo da 10 giorni: l'aiuto è già nell'inventario. */
  streakCycleCompleted?: boolean;
}

export interface LevelProgress {
  level: number;
  xpInLevel: number;
  xpForNext: number;
  xpRemaining: number;
}

export interface MedalInfo {
  id: string;
  name: string;
  description: string;
}

export interface Progress {
  /** XP dati dalla partita, bonus stella compreso. */
  xp: number;
  /** Bonus stella di Gioca, già incluso in `xp`. */
  starBonus: { star: 'bronzo' | 'argento' | 'oro'; multiplier: number; xp: number } | null;
  newWords: string[];
  totalXp: number;
  levelBefore: number;
  level: LevelProgress;
  leveledUp: boolean;
  newMedals: MedalInfo[];
}

export interface FinishedPlay extends Progress {
  playId: string;
  score: number;
  words: { word: string; path: number[]; points: number; atMs: number; combo: number; isNew: boolean }[];
  streakDays: number;
  helps: number;
}

export interface Me extends LevelProgress {
  totalXp: number;
  helps: number;
  streakDays: number;
  streakCycles: number;
  /** Serie in corso (0 se interrotta), se oggi si è già giocato, giorni del ciclo. */
  streak: { days: number; playedToday: boolean; cycleLength: number };
  /** Oggetti posseduti (aiuti, in futuro altro). */
  items: { itemId: string; name: string; description: string; kind: string; quantity: number }[];
  words: number;
  longestWord: string | null;
  gamesPlayed: number;
  onboarded: boolean;
  /** Sfide e collegamenti con gli amici si sbloccano al livello 5. */
  duelsUnlocked: boolean;
  medals: { id: string; earnedAt: string }[];
}

export function startPlay(): Promise<StartedPlay> {
  return apiRequest('/plays', { method: 'POST', body: JSON.stringify({ mode: 'gioca' }) });
}

export function finishPlay(id: string, words: { path: number[]; atMs: number }[]): Promise<FinishedPlay> {
  return apiRequest(`/plays/${id}/finish`, { method: 'POST', body: JSON.stringify({ words }) });
}

/** Uscita volontaria: si perdono punteggio e partita. */
export async function abandonPlay(id: string): Promise<void> {
  await apiRequest(`/plays/${id}/abandon`, { method: 'POST', body: '{}' });
}

/** Fine della prima partita guidata. */
export async function markOnboarded(): Promise<void> {
  await apiRequest('/me/onboarded', { method: 'POST', body: '{}' });
}

export function getMe(): Promise<Me> {
  return apiRequest('/me');
}
