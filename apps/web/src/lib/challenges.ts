import { apiRequest } from './api.js';

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
  id: string;
  generatorVersion: 1;
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
}

export interface SubmitResultResponse {
  found: { word: string; path: number[]; points: number }[];
  settled: boolean;
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

export function startChallenge(id: string): Promise<{ startedAt: string; seed: number }> {
  return apiRequest(`/challenges/${id}/start`, { method: 'POST', body: '{}' });
}

export function submitChallengeResult(id: string, paths: number[][]): Promise<SubmitResultResponse> {
  return apiRequest(`/challenges/${id}/results`, { method: 'POST', body: JSON.stringify({ paths }) });
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
