import { apiRequest } from './api.js';

export type Sky = 'auto' | 'giorno' | 'notte';
export type Season = 'auto' | 'autunno' | 'inverno' | 'primavera' | 'estate';

export interface Settings {
  sound: boolean;
  vibration: boolean;
  /** Promemoria della serie: la scelta si salva, le notifiche non sono ancora attive. */
  reminder: boolean;
  sky: Sky;
  season: Season;
}

export interface SettingsResponse {
  settings: Settings;
  available: { reminder: boolean };
}

export interface MedalEntry {
  id: string;
  name: string;
  description: string;
  kind: string;
  earnedAt: string | null;
}

export type WordLength = 'tutte' | '3' | '4' | '5' | '6' | '7+';

export function getSettings(): Promise<SettingsResponse> {
  return apiRequest('/me/settings');
}

export function saveSettings(changes: Partial<Settings>): Promise<SettingsResponse> {
  return apiRequest('/me/settings', { method: 'PUT', body: JSON.stringify(changes) });
}

export function getWords(length: WordLength): Promise<{ total: number; length: WordLength; words: string[] }> {
  return apiRequest(`/me/words?length=${encodeURIComponent(length)}`);
}

export function getMedals(): Promise<{ medals: MedalEntry[] }> {
  return apiRequest('/me/medals');
}
