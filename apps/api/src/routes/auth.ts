import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { signupSchema, loginSchema } from '@kodspot/shared/schemas';
import { getDb } from '../db/client.js';
import * as s from '../db/schema.js';
import { hashPassword, verifyPassword, signJwt } from '../lib/auth.js';
import type { Env, AppVariables } from '../env.js';

const app = new Hono<{ Bindings: Env; Variables: AppVariables }>();

app.post('/signup', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid input', issues: parsed.error.issues }, 400);
  const { name, email, password, workspaceName } = parsed.data;

  const db = getDb(c.env.DB);
  const existing = await db.query.users.findFirst({ where: eq(s.users.email, email) });
  if (existing) return c.json({ error: 'Email already registered' }, 409);

  const workspaceId = nanoid(16);
  const userId = nanoid(16);
  const slug = workspaceName.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) + '-' + nanoid(6);
  const passwordHash = await hashPassword(password);
  const now = Date.now();

  await db.batch([
    db.insert(s.workspaces).values({
      id: workspaceId,
      name: workspaceName,
      slug,
      plan: 'free',
      createdAt: now,
      updatedAt: now,
    }),
    db.insert(s.users).values({
      id: userId,
      workspaceId,
      email,
      name,
      passwordHash,
      role: 'owner',
      createdAt: now,
      updatedAt: now,
    }),
    db.insert(s.companyProfiles).values({
      workspaceId,
      legalName: workspaceName,
      brandName: workspaceName,
      country: 'India',
      invoiceNumberPrefix: 'KOD/INV',
      defaultDueDays: 0,
      updatedAt: now,
    }),
  ] as const);

  const token = await signJwt(c.env.JWT_SECRET, {
    sub: userId,
    wsId: workspaceId,
    role: 'owner',
    email,
  });

  return c.json({ token, user: { id: userId, name, email }, workspace: { id: workspaceId, name: workspaceName } }, 201);
});

app.post('/login', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid input' }, 400);
  const { email, password } = parsed.data;

  const db = getDb(c.env.DB);
  const user = await db.query.users.findFirst({ where: eq(s.users.email, email) });
  if (!user) return c.json({ error: 'Invalid credentials' }, 401);

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return c.json({ error: 'Invalid credentials' }, 401);

  await db.update(s.users).set({ lastLoginAt: Date.now() }).where(eq(s.users.id, user.id));

  const token = await signJwt(c.env.JWT_SECRET, {
    sub: user.id,
    wsId: user.workspaceId,
    role: user.role,
    email: user.email,
  });
  return c.json({ token, user: { id: user.id, name: user.name, email: user.email } });
});

app.post('/logout', (c) => c.json({ ok: true }));

export { app as authRoutes };
