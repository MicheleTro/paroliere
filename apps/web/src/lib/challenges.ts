import { apiRequest } from './api.js';

export type ChallengeMode = 'individual' | 'team';
export type ChallengeStatus = 'open' | 'in_progress' | 'completed' | 'cancelled';
export type Scoring = 'classic' | 'versus';

export interface ChallengeConfigInput {
  size: 3 | 4 | 5 | 6;
  durationMs: number;
  minWordLength: number;
  minWords: number;
  scoring: Scoring;
}

export interface CreateChallengeInput {
  config: ChallengeConfigInput;
  mode: ChallengeMode;
  bestOf: number;
  maxParticipants?: number;
  playersPerTeam?: number;
  teams?: { name: string }[];
  creatorTeamIndex?: number;
}

export interface ChallengeRecord {
  id: string;
  creatorUserId: string;
  configId: string;
  mode: ChallengeMode;
  maxParticipants: number | null;
  playersPerTeam: number | null;
  bestOf: number;
  status: ChallengeStatus;
  createdAt: string;
}

export interface ChallengeSummary {
  id: string;
  creatorUserId: string;
  creatorUsername: string;
  mode: ChallengeMode;
  bestOf: number;
  status: ChallengeStatus;
  createdAt: string;
  maxParticipants: number | null;
  playersPerTeam: number | null;
  participantCount: number;
  config: {
    size: 3 | 4 | 5 | 6;
    durationMs: number;
    minWordLength: number;
    scoring: Scoring;
  };
}

export interface ChallengeTeam {
  id: string;
  challengeId: string;
  name: string;
}

export interface ChallengeParticipant {
  id: string;
  challengeId: string;
  userId: string;
  username: string;
  teamId: string | null;
  joinedAt: string;
}

export interface ChallengeMatchWord {
  word: string;
  points: number;
}

export interface ChallengeMatchScore {
  userId: string;
  username?: string;
  score: number | null;
  words?: ChallengeMatchWord[];
}

export interface ChallengeMatch {
  id: string;
  matchIndex: number;
  seed: number;
  status: 'waiting' | 'completed';
  scores?: ChallengeMatchScore[];
  submittedByMe?: boolean;
  startedByMe?: string | null;
}

export interface ChallengeConfig extends ChallengeConfigInput {
  id: string;
  generatorVersion: 1;
  dictionaryVersion: string;
  createdAt: string;
}

export interface ChallengeDetail {
  id: string;
  creatorUserId: string;
  mode: ChallengeMode;
  status: ChallengeStatus;
  bestOf: number;
  maxParticipants: number | null;
  playersPerTeam: number | null;
  config: ChallengeConfig;
  teams: ChallengeTeam[];
  participants: ChallengeParticipant[];
  matches: ChallengeMatch[];
}

export interface SubmitResultResponse {
  found: { word: string; path: number[]; points: number }[];
  settled: boolean;
}

export async function createChallenge(
  input: CreateChallengeInput,
): Promise<{ challenge: ChallengeRecord; config: ChallengeConfig; teams: ChallengeTeam[]; matches: ChallengeMatch[] }> {
  return apiRequest('/challenges', { method: 'POST', body: JSON.stringify(input) });
}

export async function joinChallenge(challengeId: string, teamId?: string): Promise<ChallengeParticipant> {
  return apiRequest(`/challenges/${challengeId}/join`, { method: 'POST', body: JSON.stringify({ teamId }) });
}

export async function getChallenge(challengeId: string): Promise<ChallengeDetail> {
  return apiRequest(`/challenges/${challengeId}`);
}

export async function submitMatchResult(
  challengeId: string,
  matchIndex: number,
  paths: number[][],
): Promise<SubmitResultResponse> {
  return apiRequest(`/challenges/${challengeId}/matches/${matchIndex}/results`, {
    method: 'POST',
    body: JSON.stringify({ paths }),
  });
}

export async function listChallenges(): Promise<ChallengeSummary[]> {
  return apiRequest('/challenges');
}

export async function startMatch(challengeId: string, matchIndex: number): Promise<{ startedAt: string }> {
  return apiRequest(`/challenges/${challengeId}/matches/${matchIndex}/start`, { method: 'POST', body: '{}' });
}

export async function cancelChallenge(challengeId: string): Promise<void> {
  await apiRequest(`/challenges/${challengeId}/cancel`, { method: 'POST', body: '{}' });
}
