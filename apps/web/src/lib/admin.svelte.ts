const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
const ADMIN_TOKEN_KEY = 'paroliere.admin.token';

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  createdAt: string;
}

class AdminAuthStore {
  loggedIn = $state(localStorage.getItem(ADMIN_TOKEN_KEY) !== null);
}

export const adminAuth = new AdminAuthStore();

async function parseError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body.error === 'string') return body.error;
  } catch {
    // corpo non JSON: usa il messaggio generico sotto
  }
  return 'Errore imprevisto';
}

async function adminRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem(ADMIN_TOKEN_KEY);
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

  if (res.status === 401 || res.status === 403) {
    adminLogout();
    throw new Error('Sessione admin scaduta, accedi di nuovo');
  }
  if (!res.ok) throw new Error(await parseError(res));
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function adminLogin(username: string, password: string): Promise<void> {
  const res = await fetch(`${API_URL}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error(await parseError(res));

  const { token } = (await res.json()) as { token: string };
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
  adminAuth.loggedIn = true;
}

export function adminLogout(): void {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  adminAuth.loggedIn = false;
}

export function listUsers(): Promise<AdminUser[]> {
  return adminRequest('/admin/users');
}

export function deleteUser(id: string): Promise<void> {
  return adminRequest(`/admin/users/${id}`, { method: 'DELETE', body: '{}' });
}

export interface AdminWordStat {
  gridSize: number;
  durationMs: number;
  gamesPlayed: number;
  longestWord: string | null;
  longestWordLength: number;
  averageWordLength: number;
  averageWordsPerGame: number;
  lastPlayedAt: string | null;
}

export interface AdminRecentGame {
  id: string;
  size: number;
  durationMs: number;
  score: number;
  wordCount: number;
  source: 'local' | 'challenge';
  startedAt: string;
}

export interface AdminUserStats {
  wordStats: AdminWordStat[];
  recentGames: AdminRecentGame[];
}

export function getUserStats(id: string): Promise<AdminUserStats> {
  return adminRequest(`/admin/users/${id}/stats`);
}

export interface AdminReportedWord {
  id: string;
  word: string;
  status: 'pending' | 'approved' | 'rejected';
  reportCount: number;
  createdAt: string;
}

export function listReportedWords(): Promise<AdminReportedWord[]> {
  return adminRequest('/admin/reported-words');
}

export function approveReportedWord(id: string): Promise<void> {
  return adminRequest(`/admin/reported-words/${id}/approve`, { method: 'POST', body: '{}' });
}

export function discardReportedWord(id: string): Promise<void> {
  return adminRequest(`/admin/reported-words/${id}/discard`, { method: 'POST', body: '{}' });
}
