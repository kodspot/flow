import jwt from '@tsndr/cloudflare-worker-jwt';

export interface JwtPayload {
  sub: string;          // userId
  wsId: string;         // workspaceId
  role: 'owner' | 'admin' | 'member';
  email: string;
  exp: number;
}

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export async function signJwt(
  secret: string,
  payload: Omit<JwtPayload, 'exp'>,
): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  return jwt.sign({ ...payload, exp }, secret);
}

export async function verifyJwt(secret: string, token: string): Promise<JwtPayload | null> {
  try {
    const ok = await jwt.verify(token, secret);
    if (!ok) return null;
    const decoded = jwt.decode<JwtPayload>(token);
    return decoded.payload ?? null;
  } catch {
    return null;
  }
}

// PBKDF2 password hashing — works on Workers (no Node crypto)
const PBKDF2_ITERS = 210_000;

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERS, hash: 'SHA-256' },
    key,
    256,
  );
  const hash = new Uint8Array(bits);
  return `pbkdf2$${PBKDF2_ITERS}$${b64(salt)}$${b64(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, itersStr, saltB64, hashB64] = stored.split('$');
  if (scheme !== 'pbkdf2' || !itersStr || !saltB64 || !hashB64) return false;
  const iters = Number(itersStr);
  const salt = unb64(saltB64);
  const expected = unb64(hashB64);
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: iters, hash: 'SHA-256' },
    key,
    expected.length * 8,
  );
  const got = new Uint8Array(bits);
  if (got.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got[i]! ^ expected[i]!;
  return diff === 0;
}

function b64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function unb64(str: string): Uint8Array {
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
