import { auth } from './auth.svelte.js';

// Frontend e API sono sulla stessa origine (/api): la sessione è un cookie HttpOnly, nessun token nel browser.

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
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });
  if (res.status === 401) {
    // Sessione assente o scaduta: si torna dal portale, che riporta qui dopo l'accesso
    const body = (await res.json().catch(() => ({}))) as { loginUrl?: string };
    auth.redirectToPortal(body.loginUrl);
    throw new Error('Sessione scaduta');
  }
  if (!res.ok) throw new Error(await parseError(res));
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
