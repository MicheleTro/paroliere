const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
const TOKEN_KEY = 'paroliere.token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
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

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  if (!res.ok) throw new Error(await parseError(res));
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
