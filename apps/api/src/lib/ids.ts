import { randomBytes, randomUUID } from 'node:crypto';

const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';
export function shortId(len = 10): string {
  const bytes = randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}
export const uuid = () => randomUUID();
export const token = () => randomBytes(24).toString('base64url');
export const familyCode = (season: string, seq: number) => `BF-${season}-${String(seq).padStart(3, '0')}`;
export const nowIso = () => new Date().toISOString();
