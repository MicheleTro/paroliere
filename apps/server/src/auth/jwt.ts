import { jwtVerify, SignJWT } from 'jose';

import { config } from '../config.js';

const secret = new TextEncoder().encode(config.JWT_SECRET);
const ACCESS_TOKEN_TTL = '2h';

export function signAccessToken(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_TTL)
    .sign(secret);
}

export async function verifyAccessToken(token: string): Promise<string> {
  const { payload } = await jwtVerify(token, secret);
  if (typeof payload.sub !== 'string') {
    throw new Error('Token privo di subject');
  }
  return payload.sub;
}
