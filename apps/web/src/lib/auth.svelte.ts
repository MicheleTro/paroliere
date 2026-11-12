export interface AuthUser {
  id: string;
  username: string;
  isAdmin: boolean;
  loginUrl: string;
  portalUrl: string;
}

export type AuthStatus = 'checking' | 'authenticated' | 'unauthenticated';

class AuthStore {
  user: AuthUser | undefined = $state();
  status: AuthStatus = $state('checking');

  /** L'identità sta nel portale whoru: senza sessione si va lì, e dopo l'accesso si torna qui. */
  redirectToPortal(loginUrl?: string): void {
    this.status = 'unauthenticated';
    this.user = undefined;
    if (loginUrl) window.location.assign(loginUrl);
  }
}

export const auth = new AuthStore();

export async function checkSession(): Promise<void> {
  try {
    const res = await fetch('/api/auth/me', { cache: 'no-store' });
    if (res.status === 401) {
      const body = (await res.json().catch(() => ({}))) as { loginUrl?: string };
      auth.redirectToPortal(body.loginUrl);
      return;
    }
    if (!res.ok) throw new Error(String(res.status));
    auth.user = (await res.json()) as AuthUser;
    auth.status = 'authenticated';
  } catch {
    // Server non raggiungibile (es. senza rete): resta 'checking' con messaggio dedicato
    auth.status = 'unauthenticated';
  }
}

/** Esce dal gioco e torna al portale (la sessione del portale resta: da lì si può uscire del tutto). */
export async function logout(): Promise<void> {
  const portalUrl = auth.user?.portalUrl ?? '/';
  await fetch('/api/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).catch(() => {});
  auth.user = undefined;
  auth.status = 'unauthenticated';
  window.location.assign(portalUrl);
}
