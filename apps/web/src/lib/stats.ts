import { apiRequest } from './api.js';

export interface WordStats {
  gridSize: number;
  durationMs: number;
  gamesPlayed: number;
  longestWord: string | null;
  longestWordLength: number;
  averageWordLength: number;
  averageWordsPerGame: number;
  lastPlayedAt: string | null;
}

export function getWordStats(gridSize: number, durationMs: number): Promise<WordStats> {
  return apiRequest(`/users/me/word-stats?gridSize=${gridSize}&durationMs=${durationMs}`);
}
