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

export interface AdminProfile {
  totalXp: number;
  level: number;
  words: number;
  gamesPlayed: number;
  streakDays: number;
  streakCycles: number;
  items: { itemId: string; name: string; quantity: number }[];
  longestWord: string | null;
  medals: string[];
}

export interface AdminRecentPlay {
  id: string;
  mode: 'gioca' | 'settimana' | 'sfida';
  status: 'started' | 'finished' | 'abandoned';
  size: number;
  durationMs: number;
  score: number;
  wordCount: number;
  startedAt: string;
}

export interface AdminUserStats {
  profile: AdminProfile;
  recentPlays: AdminRecentPlay[];
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

// --- Preset di partita e piano della Settimana ---

export interface AdminPreset {
  id: string;
  slug: string;
  name: string;
  description: string;
  size: 4 | 5 | 6;
  durationMs: number;
  minWordLength: number;
  minWords: number;
  bonusCells: number[];
  combo: boolean;
  pointMode: 'standard' | 'speciale';
  positionBonus: boolean;
  active: boolean;
}

export type AdminPresetFields = Omit<AdminPreset, 'id' | 'slug'>;

export interface AdminPlanDay {
  dayIndex: number;
  presetId: string;
  name: string;
}

export function listPresets(): Promise<AdminPreset[]> {
  return adminRequest('/admin/presets');
}

export function createPreset(preset: AdminPresetFields & { slug: string }): Promise<AdminPreset> {
  return adminRequest('/admin/presets', { method: 'POST', body: JSON.stringify(preset) });
}

export function updatePreset(id: string, changes: Partial<AdminPresetFields>): Promise<AdminPreset> {
  return adminRequest(`/admin/presets/${id}`, { method: 'PUT', body: JSON.stringify(changes) });
}

export function getWeekPlan(): Promise<AdminPlanDay[]> {
  return adminRequest('/admin/week-plan');
}

export async function saveWeekPlan(plan: { dayIndex: number; presetId: string }[]): Promise<void> {
  await adminRequest('/admin/week-plan', { method: 'PUT', body: JSON.stringify(plan) });
}
