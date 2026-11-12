import { and, eq, like, ne } from 'drizzle-orm';

import { config, portalUrl } from '../config.js';
import { db } from '../db/client.js';
import { users } from '../db/schema.js';

// Rete di amici: sta nel portale (decisione whoru #28). Il gioco la legge da server a server con il token
// del servizio e non si fida mai di ciò che dice il browser. In sviluppo, senza token, tutti gli utenti
// "dev-..." sono amici tra loro (per provare le sfide senza portale).

export interface Friend {
  sub: string;
  username: string;
}

export class PortalUnavailableError extends Error {}

const useDevFriends = !config.PORTAL_SERVICE_TOKEN && config.DEV_LOGIN;

async function portalGet<T>(path: string): Promise<T> {
  if (!config.PORTAL_SERVICE_TOKEN) throw new PortalUnavailableError('Token del portale non configurato');
  try {
    const res = await fetch(`${portalUrl}${path}`, {
      headers: { Authorization: `Bearer ${config.PORTAL_SERVICE_TOKEN}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new PortalUnavailableError(`Portale: ${res.status}`);
    return (await res.json()) as T;
  } catch (error) {
    if (error instanceof PortalUnavailableError) throw error;
    throw new PortalUnavailableError('Portale non raggiungibile');
  }
}

export async function listFriends(sub: string): Promise<{ friends: Friend[]; incomingRequests: number }> {
  if (useDevFriends) {
    const rows = await db
      .select({ sub: users.id, username: users.username })
      .from(users)
      .where(and(like(users.id, 'dev-%'), ne(users.id, sub)));
    return { friends: rows, incomingRequests: 0 };
  }
  return portalGet(`/api/internal/friends?sub=${encodeURIComponent(sub)}`);
}

/** Sono amici? Se sì, restituisce anche nome e id dell'altro, come li conosce il portale. */
export async function checkFriend(sub: string, other: string): Promise<Friend | null> {
  if (useDevFriends) {
    if (!other.startsWith('dev-') || !sub.startsWith('dev-') || other === sub) return null;
    const [row] = await db.select({ sub: users.id, username: users.username }).from(users).where(eq(users.id, other)).limit(1);
    return row ?? null;
  }
  const result = await portalGet<{ friends: boolean; other?: Friend | null }>(
    `/api/internal/friends/check?sub=${encodeURIComponent(sub)}&other=${encodeURIComponent(other)}`,
  );
  return result.friends && result.other ? result.other : null;
}
