import { Hono } from 'hono';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { clientCreateSchema, clientUpdateSchema } from '@kodspot/shared/schemas';
import { getDb } from '../db/client.js';
import * as s from '../db/schema.js';
import { authMiddleware } from '../middleware/auth.js';
import type { Env, AppVariables } from '../env.js';

const app = new Hono<{ Bindings: Env; Variables: AppVariables }>();
app.use('*', authMiddleware);

app.get('/', async (c) => {
  const { workspaceId } = c.get('auth');
  const db = getDb(c.env.DB);
  const rows = await db
    .select()
    .from(s.clients)
    .where(and(eq(s.clients.workspaceId, workspaceId), isNull(s.clients.deletedAt)))
    .orderBy(desc(s.clients.createdAt));
  return c.json({ clients: rows });
});

app.post('/', async (c) => {
  const { workspaceId } = c.get('auth');
  const body = await c.req.json().catch(() => null);
  const parsed = clientCreateSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid input', issues: parsed.error.issues }, 400);
  const db = getDb(c.env.DB);
  const id = nanoid(16);
  const now = Date.now();
  await db.insert(s.clients).values({
    id,
    workspaceId,
    name: parsed.data.name,
    company: parsed.data.company ?? null,
    email: parsed.data.email ?? null,
    phone: parsed.data.phone ?? null,
    whatsappPhone: parsed.data.whatsappPhone ?? null,
    addressLine1: parsed.data.addressLine1 ?? null,
    addressLine2: parsed.data.addressLine2 ?? null,
    city: parsed.data.city ?? null,
    state: parsed.data.state ?? null,
    postalCode: parsed.data.postalCode ?? null,
    country: parsed.data.country ?? 'India',
    gstNumber: parsed.data.gstNumber ?? null,
    notes: parsed.data.notes ?? null,
    createdAt: now,
    updatedAt: now,
  });
  return c.json({ id }, 201);
});

app.get('/:id', async (c) => {
  const { workspaceId } = c.get('auth');
  const db = getDb(c.env.DB);
  const row = await db.query.clients.findFirst({
    where: and(
      eq(s.clients.id, c.req.param('id')),
      eq(s.clients.workspaceId, workspaceId),
      isNull(s.clients.deletedAt),
    ),
  });
  if (!row) return c.json({ error: 'Not found' }, 404);
  return c.json({ client: row });
});

app.patch('/:id', async (c) => {
  const { workspaceId } = c.get('auth');
  const body = await c.req.json().catch(() => null);
  const parsed = clientUpdateSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid input' }, 400);
  const db = getDb(c.env.DB);
  await db
    .update(s.clients)
    .set({ ...parsed.data, updatedAt: Date.now() })
    .where(and(eq(s.clients.id, c.req.param('id')), eq(s.clients.workspaceId, workspaceId)));
  return c.json({ ok: true });
});

app.delete('/:id', async (c) => {
  const { workspaceId } = c.get('auth');
  const db = getDb(c.env.DB);
  await db
    .update(s.clients)
    .set({ deletedAt: Date.now() })
    .where(and(eq(s.clients.id, c.req.param('id')), eq(s.clients.workspaceId, workspaceId)));
  return c.json({ ok: true });
});

export { app as clientRoutes };
