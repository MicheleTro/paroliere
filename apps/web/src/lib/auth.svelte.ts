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

// --- Controllo della sessione del portale ---
// Il gioco ha una sessione sua; se nel frattempo l'utente esce dal portale (o entra con un altro account)
// il gioco deve accorgersene. Il portale non tiene l'elenco delle sessioni: lo chiede il browser, che ha il
// cookie del portale (stesso sito). Non interrompe mai una partita in corso: aspetta la fine.

const CHECK_EVERY_MS = 60_000;

/** true = stessa persona, false = uscita o cambiata, null = non si sa (rete assente): non si fa nulla. */
async function portalMatches(): Promise<boolean | null> {
  const user = auth.user;
  if (!user) return null;
  try {
    const res = await fetch(`${user.portalUrl}/api/session`, { credentials: 'include', cache: 'no-store' });
    if (res.status === 401) return false;
    if (!res.ok) return null;
    const body = (await res.json()) as { sub?: string };
    return body.sub === user.id;
  } catch {
    return null;
  }
}

export function watchPortalSession(isBusy: () => boolean): void {
  let pendingLeave = false;
  let running = false;

  const check = async () => {
    const user = auth.user;
    // Le sessioni di sviluppo (dev-...) non hanno un corrispettivo nel portale
    if (running || !user || user.id.startsWith('dev-')) return;
    running = true;
    try {
      if (!pendingLeave && (await portalMatches()) === false) pendingLeave = true;
      if (pendingLeave && !isBusy()) {
        const loginUrl = user.loginUrl;
        await fetch('/api/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }).catch(
          () => {},
        );
        auth.redirectToPortal(loginUrl);
      }
    } finally {
      running = false;
    }
  };

  setInterval(() => void check(), CHECK_EVERY_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void check();
  });
  window.addEventListener('focus', () => void check());
}
