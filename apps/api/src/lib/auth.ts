import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from '../config.ts';

const b64 = (s: string | Buffer) => Buffer.from(s).toString('base64url');
const sign = (payload: string) => createHmac('sha256', config.sessionSecret).update(payload).digest('base64url');

export interface SessionClaims {
  email: string;
  exp: number; // epoch seconds
  kind: 'session' | 'login';
}

export function issueToken(claims: SessionClaims): string {
  const body = b64(JSON.stringify(claims));
  return `${body}.${sign(body)}`;
}

export function verifyToken(tok: string | undefined | null, kind: SessionClaims['kind']): SessionClaims | null {
  if (!tok || !tok.includes('.')) return null;
  const [body, sig] = tok.split('.');
  const expected = sign(body);
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const claims = JSON.parse(Buffer.from(body, 'base64url').toString()) as SessionClaims;
    if (claims.kind !== kind || claims.exp < Date.now() / 1000) return null;
    if (!config.adminEmails.includes(claims.email)) return null;
    return claims;
  } catch {
    return null;
  }
}

export const isAdminEmail = (email: string) => config.adminEmails.includes(email.trim().toLowerCase());
export const loginToken = (email: string) => issueToken({ email: email.toLowerCase(), exp: Math.floor(Date.now() / 1000) + 15 * 60, kind: 'login' });
export const sessionToken = (email: string) => issueToken({ email: email.toLowerCase(), exp: Math.floor(Date.now() / 1000) + 14 * 86_400, kind: 'session' });
export const SESSION_COOKIE = 'bf_admin';
