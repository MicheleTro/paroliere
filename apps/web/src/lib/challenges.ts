import { apiRequest } from './api.js';
import type { Progress } from './plays.js';

// Sfide 1 contro 1 su invito (decisione whoru #28): si lanciano solo contro un amico del portale, un solo match.

export type DuelStatus = 'invited' | 'in_progress' | 'completed' | 'declined' | 'cancelled' | 'expired';
export type Scoring = 'classic' | 'versus';
export type PointMode = 'standard' | 'speciale';

export interface ChallengeConfigInput {
  size: 4 | 5 | 6;
  durationMs: number;
  minWordLength: number;
  minWords: number;
  scoring: Scoring;
  pointMode: PointMode;
  positionBonus: boolean;
}

export interface Person {
  id: string;
  username?: string;
}

export interface ChallengeSummary {
  id: string;
  status: DuelStatus;
  createdAt: string;
  iAmChallenger: boolean;
  opponent: Person;
  config?: Omit<ChallengeConfigInput, 'minWords'>;
  submittedByMe: boolean;
  opponentSubmitted: boolean;
  myScore: number | null;
  opponentScore: number | null;
}

export interface ChallengeConfig extends ChallengeConfigInput {
  dictionaryVersion: string;
}

export interface ChallengeWord {
  word: string;
  points: number;
}

export interface ChallengeScore {
  userId: string;
  username?: string;
  score: number | null;
  /** XP guadagnati con la sfida. */
  xp?: number;
  /** Ha usato l'aiuto +10 s. */
  usedHelp?: boolean;
  words: ChallengeWord[];
}

export interface ChallengeDetail {
  id: string;
  status: DuelStatus;
  createdAt: string;
  challenger: Person;
  opponent: Person;
  iAmChallenger: boolean;
  config: ChallengeConfig;
  /** Solo quando la sfida è giocabile. */
  seed?: number;
  startedByMe: string | null;
  helpUsedByMe?: boolean;
  submittedByMe: boolean;
  opponentSubmitted: boolean;
  scores?: ChallengeScore[];
}

export interface Friend {
  sub: string;
  username: string;
}

export interface Notifications {
  /** Inviti di sfida a cui devi rispondere. */
  invites: number;
  /** Sfide accettate che non hai ancora giocato. */
  toPlay: number;
  /** Richieste di amicizia ricevute (dal portale); null se il portale non risponde. */
  friendRequests: number | null;
  /** Falso finché non si arriva al livello 5. */
  unlocked?: boolean;
}

export interface SubmitResultResponse {
  found: { word: string; path: number[]; points: number }[];
  settled: boolean;
  /** XP, parole nuove e medaglie: presente quando questo invio ha chiuso la sfida. */
  progress?: Progress;
}

export function listFriends(): Promise<{ friends: Friend[]; incomingRequests: number }> {
  return apiRequest('/friends');
}

export function getNotifications(): Promise<Notifications> {
  return apiRequest('/notifications');
}

export function createChallenge(opponentId: string, config: ChallengeConfigInput): Promise<{ id: string }> {
  return apiRequest('/challenges', { method: 'POST', body: JSON.stringify({ opponentId, config }) });
}

export function listChallenges(): Promise<ChallengeSummary[]> {
  return apiRequest('/challenges');
}

export function getChallenge(id: string): Promise<ChallengeDetail> {
  return apiRequest(`/challenges/${id}`);
}

export async function respondToChallenge(id: string, accept: boolean): Promise<void> {
  await apiRequest(`/challenges/${id}/respond`, { method: 'POST', body: JSON.stringify({ accept }) });
}

export async function cancelChallenge(id: string): Promise<void> {
  await apiRequest(`/challenges/${id}/cancel`, { method: 'POST', body: '{}' });
}

export interface StartedChallenge {
  startedAt: string;
  seed: number;
  helpUsed: boolean;
  /** Durata concessa, compreso l'aiuto. */
  durationMs: number;
  /** Tempo che resta, calcolato dal server. */
  remainingMs: number;
}

export function startChallenge(id: string, help = false): Promise<StartedChallenge> {
  return apiRequest(`/challenges/${id}/start`, { method: 'POST', body: JSON.stringify({ help }) });
}

/** Uscita volontaria dalla partita di una sfida: punteggio zero, non si può rigiocare. */
export async function abandonChallenge(id: string): Promise<void> {
  await apiRequest(`/challenges/${id}/abandon`, { method: 'POST', body: '{}' });
}

export function submitChallengeResult(id: string, words: { path: number[]; atMs: number }[]): Promise<SubmitResultResponse> {
  return apiRequest(`/challenges/${id}/results`, { method: 'POST', body: JSON.stringify({ words }) });
}

export const STATUS_LABEL: Record<DuelStatus, string> = {
  invited: 'In attesa di risposta',
  in_progress: 'In corso',
  completed: 'Conclusa',
  declined: 'Rifiutata',
  cancelled: 'Ritirata',
  expired: 'Scaduta',
};

export function pointModeLabel(config: Pick<ChallengeConfigInput, 'pointMode' | 'positionBonus'>): string {
  const base = config.pointMode === 'speciale' ? 'Speciale' : 'Standard';
  return config.positionBonus ? `${base} + Bonus Posizione` : base;
}
