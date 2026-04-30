import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { companyProfileUpdateSchema } from '@kodspot/shared/schemas';
import { getDb } from '../db/client.js';
import * as s from '../db/schema.js';
import { authMiddleware } from '../middleware/auth.js';
import type { Env, AppVariables } from '../env.js';

const app = new Hono<{ Bindings: Env; Variables: AppVariables }>();
app.use('*', authMiddleware);

app.get('/company', async (c) => {
  const { workspaceId } = c.get('auth');
  const db = getDb(c.env.DB);
  const profile = await db.query.companyProfiles.findFirst({
    where: eq(s.companyProfiles.workspaceId, workspaceId),
  });
  return c.json({ profile });
});

app.put('/company', async (c) => {
  const { workspaceId, role } = c.get('auth');
  if (role === 'member') return c.json({ error: 'Forbidden' }, 403);
  const body = await c.req.json().catch(() => null);
  const parsed = companyProfileUpdateSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid input', issues: parsed.error.issues }, 400);
  const db = getDb(c.env.DB);
  await db
    .update(s.companyProfiles)
    .set({ ...parsed.data, updatedAt: Date.now() })
    .where(eq(s.companyProfiles.workspaceId, workspaceId));
  return c.json({ ok: true });
});

export { app as settingsRoutes };
