import { createRemoteJWKSet, jwtVerify } from 'jose';

import { config } from '../config.js';
import type { PlayerSession } from './session.js';

// Verifica del token emesso dal portale (decisione whoru #24): firma EdDSA con la chiave pubblica del portale,
// emittente, destinatario (questo servizio) e scadenza. Ogni token vale una volta sola (jti).

const issuer = config.PORTAL_URL.replace(/\/+$/, '');
const jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`), { cooldownDuration: 30_000 });

const usedTokens = new Map<string, number>(); // jti -> scadenza (ms)

function markUsed(jti: string, expiresAtMs: number): boolean {
  const now = Date.now();
  for (const [id, exp] of usedTokens) if (exp < now) usedTokens.delete(id);
  if (usedTokens.has(jti)) return false;
  usedTokens.set(jti, expiresAtMs);
  return true;
}

export async function verifyPortalToken(token: string): Promise<PlayerSession | null> {
  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer,
      audience: config.SERVICE_ID,
      algorithms: ['EdDSA'],
      clockTolerance: 5,
    });
    if (
      typeof payload.sub !== 'string' ||
      typeof payload.preferred_username !== 'string' ||
      typeof payload.jti !== 'string' ||
      typeof payload.exp !== 'number'
    ) {
      return null;
    }
    if (!markUsed(payload.jti, payload.exp * 1000)) return null;
    const groups = Array.isArray(payload.groups) ? payload.groups.filter((g): g is string => typeof g === 'string') : [];
    return { sub: payload.sub, username: payload.preferred_username, groups };
  } catch {
    return null;
  }
}
