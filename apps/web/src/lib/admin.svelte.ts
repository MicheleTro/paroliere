export interface AdminUser {
  id: string;
  username: string;
  createdAt: string;
  lastSeenAt: string;
}

/** Schermata admin aperta o chiusa. Chi è admin lo decide il server (gruppo `admin` di whoru). */
class AdminUiStore {
  open = $state(false);
}

export const adminAuth = new AdminUiStore();

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
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });
  if (res.status === 401 || res.status === 403) {
    closeAdmin();
    throw new Error('Accesso admin non disponibile');
  }
  if (!res.ok) throw new Error(await parseError(res));
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function closeAdmin(): void {
  adminAuth.open = false;
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
