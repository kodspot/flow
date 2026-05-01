import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import {
  signupSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  updateProfileSchema,
} from '@kodspot/shared/schemas';
import { getDb } from '../db/client.js';
import * as s from '../db/schema.js';
import { hashPassword, verifyPassword, signJwt } from '../lib/auth.js';
import { sendEmail, passwordResetEmailHtml } from '../lib/email.js';
import { authMiddleware } from '../middleware/auth.js';
import type { Env, AppVariables } from '../env.js';

const app = new Hono<{ Bindings: Env; Variables: AppVariables }>();

const RESET_TOKEN_TTL_SECONDS = 30 * 60; // 30 minutes
const RESET_TOKEN_KV_PREFIX = 'pwreset:';

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

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

/** Returns the current user + workspace from the JWT. */
app.get('/me', authMiddleware, async (c) => {
  const { userId, workspaceId } = c.get('auth');
  const db = getDb(c.env.DB);
  const user = await db.query.users.findFirst({ where: eq(s.users.id, userId) });
  const workspace = await db.query.workspaces.findFirst({ where: eq(s.workspaces.id, workspaceId) });
  if (!user || !workspace) return c.json({ error: 'Not found' }, 404);
  return c.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      lastLoginAt: user.lastLoginAt,
    },
    workspace: { id: workspace.id, name: workspace.name, plan: workspace.plan },
  });
});

/**
 * Forgot password — always returns 200 to prevent email enumeration.
 * Stores SHA-256(token) in KV with TTL; emails the raw token in a reset link.
 */
app.post('/forgot-password', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid input' }, 400);
  const { email } = parsed.data;

  // Light rate limit per email — KV-backed, 5 requests / 15 min
  const rlKey = `pwreset_rl:${email.toLowerCase()}`;
  const count = Number((await c.env.KV.get(rlKey)) ?? 0);
  if (count >= 5) return c.json({ ok: true });
  await c.env.KV.put(rlKey, String(count + 1), { expirationTtl: 15 * 60 });

  const db = getDb(c.env.DB);
  const user = await db.query.users.findFirst({ where: eq(s.users.email, email) });

  // Always respond ok — but only do work if user exists.
  if (user) {
    const token = nanoid(48);
    const tokenHash = await sha256Hex(token);
    await c.env.KV.put(
      `${RESET_TOKEN_KV_PREFIX}${tokenHash}`,
      JSON.stringify({ userId: user.id, createdAt: Date.now() }),
      { expirationTtl: RESET_TOKEN_TTL_SECONDS },
    );

    const resetUrl = `${c.env.APP_URL}/reset-password?token=${encodeURIComponent(token)}`;
    await sendEmail({
      apiKey: c.env.RESEND_API_KEY,
      from: c.env.RESEND_FROM_EMAIL,
      to: user.email,
      subject: 'Reset your Kodspot Flow password',
      html: passwordResetEmailHtml({
        userName: user.name,
        resetUrl,
        expiresMinutes: RESET_TOKEN_TTL_SECONDS / 60,
      }),
    });
  }

  return c.json({ ok: true });
});

/** Reset password using the token issued by /forgot-password. */
app.post('/reset-password', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid input', issues: parsed.error.issues }, 400);
  const { token, password } = parsed.data;

  const tokenHash = await sha256Hex(token);
  const kvKey = `${RESET_TOKEN_KV_PREFIX}${tokenHash}`;
  const stored = await c.env.KV.get(kvKey);
  if (!stored) return c.json({ error: 'Invalid or expired link' }, 400);

  let userId: string;
  try {
    const parsedStored = JSON.parse(stored) as { userId?: string };
    if (!parsedStored.userId) throw new Error('bad token');
    userId = parsedStored.userId;
  } catch {
    return c.json({ error: 'Invalid or expired link' }, 400);
  }

  const db = getDb(c.env.DB);
  const user = await db.query.users.findFirst({ where: eq(s.users.id, userId) });
  if (!user) return c.json({ error: 'Invalid or expired link' }, 400);

  const newHash = await hashPassword(password);
  await db
    .update(s.users)
    .set({ passwordHash: newHash, updatedAt: Date.now() })
    .where(eq(s.users.id, userId));

  // Single-use: delete the token immediately.
  await c.env.KV.delete(kvKey);

  return c.json({ ok: true });
});

/** Change password while logged in. Requires current password. */
app.post('/change-password', authMiddleware, async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid input', issues: parsed.error.issues }, 400);
  const { currentPassword, newPassword } = parsed.data;
  if (currentPassword === newPassword) {
    return c.json({ error: 'New password must be different' }, 400);
  }

  const { userId } = c.get('auth');
  const db = getDb(c.env.DB);
  const user = await db.query.users.findFirst({ where: eq(s.users.id, userId) });
  if (!user) return c.json({ error: 'Not found' }, 404);

  const ok = await verifyPassword(currentPassword, user.passwordHash);
  if (!ok) return c.json({ error: 'Current password is incorrect' }, 401);

  const newHash = await hashPassword(newPassword);
  await db
    .update(s.users)
    .set({ passwordHash: newHash, updatedAt: Date.now() })
    .where(eq(s.users.id, userId));

  return c.json({ ok: true });
});

/** Update profile (display name) for the current user. */
app.patch('/profile', authMiddleware, async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid input', issues: parsed.error.issues }, 400);
  const { name } = parsed.data;

  const { userId } = c.get('auth');
  const db = getDb(c.env.DB);
  await db
    .update(s.users)
    .set({ name, updatedAt: Date.now() })
    .where(eq(s.users.id, userId));

  return c.json({ ok: true });
});

export { app as authRoutes };
