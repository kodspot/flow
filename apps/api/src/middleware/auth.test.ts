import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { authMiddleware } from './auth.js';
import { markPasswordChanged, signJwt } from '../lib/auth.js';
import type { AppVariables, Env } from '../env.js';

const SECRET = 'test-secret';

/** Minimal in-memory KV with the calls the auth code makes. */
function fakeKv() {
  const store = new Map<string, string>();
  return {
    get: async (k: string) => store.get(k) ?? null,
    put: async (k: string, v: string) => void store.set(k, v),
    delete: async (k: string) => void store.delete(k),
  } as unknown as KVNamespace;
}

function app(kv: KVNamespace) {
  const a = new Hono<{ Bindings: Env; Variables: AppVariables }>();
  a.use('*', authMiddleware);
  a.get('/me', (c) => c.json({ userId: c.get('auth').userId }));
  const env = { JWT_SECRET: SECRET, KV: kv } as unknown as Env;
  return (token?: string) =>
    a.request('/me', { headers: token ? { Authorization: `Bearer ${token}` } : {} }, env);
}

const claims = { sub: 'user_1', wsId: 'ws_1', role: 'owner' as const, email: 'a@example.com' };

describe('authMiddleware', () => {
  it('accepts a valid token', async () => {
    const call = app(fakeKv());
    const res = await call(await signJwt(SECRET, claims));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ userId: 'user_1' });
  });

  it('marks missing or invalid tokens as an ended session', async () => {
    const call = app(fakeKv());
    for (const res of [await call(), await call('not.a.token')]) {
      expect(res.status).toBe(401);
      expect(await res.json()).toMatchObject({ code: 'session_expired' });
    }
  });

  it('refuses tokens issued before a password change, but not the one issued at it', async () => {
    const kv = fakeKv();
    const call = app(kv);
    // Issued a moment earlier, possibly within the same second as the change.
    const before = await signJwt(SECRET, claims, Date.now() - 5);
    expect((await call(before)).status).toBe(200);

    const changedAt = await markPasswordChanged(kv, 'user_1');
    const after = await signJwt(SECRET, claims, changedAt);

    const old = await call(before);
    expect(old.status).toBe(401);
    expect(await old.json()).toMatchObject({ code: 'session_expired' });
    expect((await call(after)).status).toBe(200);
    // A later sign-in works, and another user's sessions are unaffected.
    expect((await call(await signJwt(SECRET, claims, changedAt + 1))).status).toBe(200);
    expect((await call(await signJwt(SECRET, { ...claims, sub: 'user_2' }, changedAt - 60_000))).status).toBe(200);
  });
});
