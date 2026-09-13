import { apiRequest } from './api.js';

export type ChallengeMode = 'individual' | 'team';
export type ChallengeStatus = 'open' | 'completed';
export type Scoring = 'classic' | 'versus';

export interface ChallengeConfigInput {
  size: 4 | 5 | 6;
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
  teams?: { name: string }[];
}

export interface ChallengeSummary {
  id: string;
  creatorUserId: string;
  configId: string;
  mode: ChallengeMode;
  maxParticipants: number | null;
  bestOf: number;
  status: ChallengeStatus;
  createdAt: string;
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

export interface ChallengeMatchScore {
  userId: string;
  username?: string;
  score: number | null;
}

export interface ChallengeMatch {
  id: string;
  matchIndex: number;
  seed: number;
  status: 'waiting' | 'completed';
  scores?: ChallengeMatchScore[];
}

export interface ChallengeConfig extends ChallengeConfigInput {
  id: string;
  generatorVersion: 1;
  dictionaryVersion: string;
  createdAt: string;
}

export interface ChallengeDetail {
  id: string;
  mode: ChallengeMode;
  status: ChallengeStatus;
  bestOf: number;
  maxParticipants: number | null;
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
): Promise<{ challenge: ChallengeSummary; config: ChallengeConfig; teams: ChallengeTeam[]; matches: ChallengeMatch[] }> {
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
