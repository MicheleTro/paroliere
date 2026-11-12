import { jwtVerify, SignJWT } from 'jose';

import { config, isProduction } from '../config.js';

// Sessione del gioco: cookie HttpOnly con JWT firmato (HS256). Il gioco non conosce password: l'identità
// arriva dal portale (token EdDSA), qui si apre solo una sessione propria. Nessuna revoca lato server
// durante la sessione (limite noto, come nel portale).

export interface PlayerSession {
  sub: string;
  username: string;
  groups: string[];
}

const key = new TextEncoder().encode(config.SESSION_SECRET);
export const SESSION_COOKIE = isProduction ? '__Host-paroliere_session' : 'paroliere_session';
export const SESSION_TTL_SECONDS = 8 * 60 * 60;

export function signSession(session: PlayerSession): Promise<string> {
  return new SignJWT({ username: session.username, groups: session.groups })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(session.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(key);
}

export async function verifySession(token: string): Promise<PlayerSession | null> {
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] });
    if (typeof payload.sub !== 'string' || typeof payload.username !== 'string' || !Array.isArray(payload.groups)) {
      return null;
    }
    return {
      sub: payload.sub,
      username: payload.username,
      groups: payload.groups.filter((g): g is string => typeof g === 'string'),
    };
  } catch {
    return null;
  }
}

export function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return rest.join('=');
  }
  return undefined;
}

export function sessionCookie(token: string, maxAge = SESSION_TTL_SECONDS): string {
  const attrs = [`${SESSION_COOKIE}=${token}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAge}`];
  if (isProduction) attrs.push('Secure');
  return attrs.join('; ');
}

/** Cancellazione: con il prefisso __Host- vanno ripetuti gli stessi attributi (Secure compreso). */
export function clearedSessionCookie(): string {
  return `${sessionCookie('', 0)}; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}
