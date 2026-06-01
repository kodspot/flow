import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { companyProfileUpdateSchema } from '@kodspot/shared/schemas';
import { getDb } from '../db/client.js';
import * as s from '../db/schema.js';
import { authMiddleware } from '../middleware/auth.js';
import type { Env, AppVariables } from '../env.js';

const app = new Hono<{ Bindings: Env; Variables: AppVariables }>();
app.use('*', authMiddleware);

const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']);
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024; // 2 MB

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

/* ──────────────────────────────────────────────────────────
 * Asset uploads — logo, signature, UPI QR. Stored in R2 ASSETS.
 * ────────────────────────────────────────────────────────── */
type AssetKind = 'logo' | 'signature' | 'upi-qr';
type AssetColumn = 'logoR2Key' | 'signatureR2Key' | 'upiQrR2Key';

const KIND_TO_COLUMN: Record<AssetKind, AssetColumn> = {
  logo: 'logoR2Key',
  signature: 'signatureR2Key',
  'upi-qr': 'upiQrR2Key',
};

function isAssetKind(v: string): v is AssetKind {
  return v === 'logo' || v === 'signature' || v === 'upi-qr';
}

app.post('/upload/:kind', async (c) => {
  const { workspaceId, role } = c.get('auth');
  if (role === 'member') return c.json({ error: 'Forbidden' }, 403);
  const kind = c.req.param('kind');
  if (!isAssetKind(kind)) return c.json({ error: 'Invalid kind' }, 400);

  const form = await c.req.formData().catch(() => null);
  const fileEntry = form?.get('file');
  if (!fileEntry || typeof fileEntry === 'string') {
    return c.json({ error: 'No file uploaded' }, 400);
  }
  const file = fileEntry as unknown as { type: string; size: number; arrayBuffer: () => Promise<ArrayBuffer> };
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return c.json({ error: `Unsupported file type: ${file.type}` }, 400);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return c.json({ error: `File too large (max ${MAX_UPLOAD_BYTES / 1024 / 1024} MB)` }, 400);
  }

  const ext = file.type === 'image/svg+xml' ? 'svg'
    : file.type === 'image/png' ? 'png'
    : file.type === 'image/webp' ? 'webp' : 'jpg';
  const key = `branding/${workspaceId}/${kind}-${nanoid(8)}.${ext}`;
  const buf = await file.arrayBuffer();
  await c.env.ASSETS.put(key, buf, { httpMetadata: { contentType: file.type } });

  const db = getDb(c.env.DB);
  const column = KIND_TO_COLUMN[kind];
  const existing = await db.query.companyProfiles.findFirst({
    where: eq(s.companyProfiles.workspaceId, workspaceId),
  });
  const oldKey = existing ? (existing as Record<string, unknown>)[column] as string | null : null;

  await db
    .update(s.companyProfiles)
    .set({ [column]: key, updatedAt: Date.now() })
    .where(eq(s.companyProfiles.workspaceId, workspaceId));

  if (oldKey && oldKey !== key) {
    await c.env.ASSETS.delete(oldKey).catch(() => {});
  }
  return c.json({ key, kind });
});

/** Stream a workspace asset. Auth-gated; key must belong to caller's workspace. */
app.get('/asset', async (c) => {
  const { workspaceId } = c.get('auth');
  const key = c.req.query('key');
  if (!key) return c.json({ error: 'Missing key' }, 400);
  if (!key.startsWith(`branding/${workspaceId}/`)) {
    return c.json({ error: 'Forbidden' }, 403);
  }
  const obj = await c.env.ASSETS.get(key);
  if (!obj) return c.json({ error: 'Not found' }, 404);
  return new Response(obj.body, {
    headers: {
      'Content-Type': obj.httpMetadata?.contentType ?? 'application/octet-stream',
      'Cache-Control': 'private, max-age=300',
    },
  });
});

app.delete('/asset/:kind', async (c) => {
  const { workspaceId, role } = c.get('auth');
  if (role === 'member') return c.json({ error: 'Forbidden' }, 403);
  const kind = c.req.param('kind');
  if (!isAssetKind(kind)) return c.json({ error: 'Invalid kind' }, 400);
  const column = KIND_TO_COLUMN[kind];
  const db = getDb(c.env.DB);
  const existing = await db.query.companyProfiles.findFirst({
    where: eq(s.companyProfiles.workspaceId, workspaceId),
  });
  const oldKey = existing ? (existing as Record<string, unknown>)[column] as string | null : null;
  await db
    .update(s.companyProfiles)
    .set({ [column]: null, updatedAt: Date.now() })
    .where(eq(s.companyProfiles.workspaceId, workspaceId));
  if (oldKey) await c.env.ASSETS.delete(oldKey).catch(() => {});
  return c.json({ ok: true });
});

/* ──────────────────────────────────────────────────────────
 * One-shot seed for the KODSPOT workspace owner. Pre-fills the
 * company profile with verified Udyam/bank details and creates
 * the KLE Institute of Hotel Management client. Idempotent —
 * fields already filled by the user are preserved.
 * ────────────────────────────────────────────────────────── */
const KODSPOT_DEFAULTS = {
  legalName: 'KODSPOT',
  brandName: 'KODSPOT',
  tagline: 'Operations. Verified.',
  email: 'kishan@kodspot.com',
  phone: '+91 76766 99291',
  addressLine1: 'Hanuman Nagar',
  addressLine2: 'Muralidhar Colony, Scheme No 40',
  city: 'Belagavi',
  state: 'Karnataka',
  postalCode: '590019',
  country: 'India',
  panNumber: 'AXWPT4874G',
  udyamNumber: 'UDYAM-KR-04-0179635',
  bankAccountName: 'Kishan A Thorat (KODSPOT)',
  bankName: 'State Bank of India (SBI)',
  bankBranch: 'Jayanagar, Belagavi',
  bankIfsc: 'SBIN0040786',
  bankAccountNumber: '40870638363',
  signatoryName: 'Kishan Thorat',
  signatoryDesignation: 'Founder & Proprietor',
  invoiceNumberPrefix: 'KOD/INV',
  defaultPlaceOfSupply: 'Karnataka (29)',
  defaultGstNote:
    'This transaction is exempt from GST under Section 22 of the Central Goods and Services Tax Act, 2017 as the aggregate turnover of KODSPOT is below the prescribed threshold limit of ₹20 lakh. No GST will be charged or collected. HSN Code: 998313 (IT Services).',
  defaultInvoiceNotes: 'Note: Invoice is generated at the end of every month.',
} as const;

const KLE_CLIENT = {
  name: 'The Principal',
  company: 'KLE Institute of Hotel Management',
  addressLine1: 'JNMC Campus, Nehru Nagar',
  addressLine2: null,
  city: 'Belagavi',
  state: 'Karnataka',
  postalCode: '590010',
  country: 'India',
} as const;

app.post('/seed-kodspot', async (c) => {
  const { workspaceId, role } = c.get('auth');
  if (role !== 'owner') return c.json({ error: 'Owner only' }, 403);
  const db = getDb(c.env.DB);

  const existing = await db.query.companyProfiles.findFirst({
    where: eq(s.companyProfiles.workspaceId, workspaceId),
  });
  if (!existing) return c.json({ error: 'Company profile missing' }, 404);

  // Only fill blanks — don't overwrite user edits
  const merged: Record<string, unknown> = { updatedAt: Date.now() };
  for (const [k, v] of Object.entries(KODSPOT_DEFAULTS)) {
    const cur = (existing as Record<string, unknown>)[k];
    if (cur == null || cur === '' || (k === 'brandName' && cur === existing.legalName)) {
      merged[k] = v;
    }
  }
  if (Object.keys(merged).length > 1) {
    await db
      .update(s.companyProfiles)
      .set(merged)
      .where(eq(s.companyProfiles.workspaceId, workspaceId));
  }

  // KLE client — create if not present (match by company name to avoid dupes)
  const allClients = await db.query.clients.findMany({
    where: eq(s.clients.workspaceId, workspaceId),
  });
  let clientId = allClients.find((cl) => cl.company === KLE_CLIENT.company)?.id;
  if (!clientId) {
    clientId = nanoid(16);
    const now = Date.now();
    await db.insert(s.clients).values({
      id: clientId,
      workspaceId,
      ...KLE_CLIENT,
      createdAt: now,
      updatedAt: now,
    });
  }

  return c.json({
    ok: true,
    fieldsUpdated: Object.keys(merged).length - 1,
    clientId,
  });
});

export { app as settingsRoutes };
