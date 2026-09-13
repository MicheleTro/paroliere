const TOKEN_KEY = 'paroliere.token';
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  createdAt: string;
}

export type AuthStatus = 'checking' | 'authenticated' | 'unauthenticated';

class AuthStore {
  user: AuthUser | undefined = $state();
  status: AuthStatus = $state('checking');
}

export const auth = new AuthStore();

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

async function parseError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    const err = body.error;
    if (typeof err === 'string') return err;
    if (err && typeof err === 'object') {
      const fieldErrors = err.fieldErrors as Record<string, string[]> | undefined;
      const firstFieldError = fieldErrors && Object.values(fieldErrors).find((messages) => messages?.length);
      if (firstFieldError?.[0]) return firstFieldError[0];
      const formError = err.formErrors?.[0];
      if (typeof formError === 'string') return formError;
    }
  } catch {
    // corpo non JSON: usa il messaggio generico sotto
  }
  return 'Errore imprevisto';
}

export async function checkSession(): Promise<void> {
  const token = getToken();
  if (!token) {
    auth.status = 'unauthenticated';
    return;
  }

  try {
    const res = await fetch(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('sessione non valida');
    auth.user = await res.json();
    auth.status = 'authenticated';
  } catch {
    clearToken();
    auth.status = 'unauthenticated';
  }
}

export async function login(identifier: string, password: string): Promise<void> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const { token } = await res.json();
  setToken(token);
  await checkSession();
}

export async function register(username: string, email: string, password: string): Promise<void> {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const { token } = await res.json();
  setToken(token);
  await checkSession();
}

export function logout(): void {
  clearToken();
  auth.user = undefined;
  auth.status = 'unauthenticated';
}
