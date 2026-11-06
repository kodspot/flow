import jwt from '@tsndr/cloudflare-worker-jwt';

export interface JwtPayload {
  sub: string;          // userId
  wsId: string;         // workspaceId
  role: 'owner' | 'admin' | 'member';
  email: string;
  exp: number;
  iat?: number;         // issued at (seconds); absent on tokens issued before it was added
  iatMs?: number;       // issued at (milliseconds), so a password change in the same second still counts
}

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export async function signJwt(
  secret: string,
  payload: Omit<JwtPayload, 'exp' | 'iat' | 'iatMs'>,
  issuedAtMs: number = Date.now(),
): Promise<string> {
  const iat = Math.floor(issuedAtMs / 1000);
  return jwt.sign({ ...payload, iat, iatMs: issuedAtMs, exp: iat + TOKEN_TTL_SECONDS }, secret);
}

/*
 * Password changes end other sessions: the time of the latest change is kept in KV, and tokens
 * issued before it are refused. The record only needs to outlive the tokens it revokes.
 */
const PASSWORD_CHANGED_PREFIX = 'pwchanged:';

/** Record a password change for `userId`; returns the change time (ms) to issue the new token at. */
export async function markPasswordChanged(kv: KVNamespace, userId: string): Promise<number> {
  const at = Date.now();
  await kv.put(`${PASSWORD_CHANGED_PREFIX}${userId}`, String(at), {
    expirationTtl: TOKEN_TTL_SECONDS + 60 * 60,
  });
  return at;
}

/** True when the token was issued before the user's latest password change. */
export async function issuedBeforePasswordChange(kv: KVNamespace, payload: JwtPayload): Promise<boolean> {
  const changedAt = await kv.get(`${PASSWORD_CHANGED_PREFIX}${payload.sub}`);
  if (changedAt === null) return false;
  // Older tokens carry only `iat` (seconds), or nothing at all.
  const issuedAtMs = payload.iatMs ?? (payload.iat ?? 0) * 1000;
  return issuedAtMs < Number(changedAt);
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

// PBKDF2 password hashing — works on Workers (no Node crypto).
// Cloudflare Workers Web Crypto caps PBKDF2 iterations at 100,000.
const PBKDF2_ITERS = 100_000;

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
