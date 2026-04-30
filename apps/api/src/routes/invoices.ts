import { Hono } from 'hono';
import { and, eq } from 'drizzle-orm';
import { invoiceCreateSchema, invoiceStatusUpdateSchema } from '@kodspot/shared/schemas';
import { getDb } from '../db/client.js';
import * as s from '../db/schema.js';
import { authMiddleware } from '../middleware/auth.js';
import {
  createInvoice,
  getInvoiceWithItems,
  listInvoices,
  getDashboardStats,
} from '../services/invoiceService.js';
import { renderInvoiceHtml } from '../services/invoiceRenderer.js';
import { PdfService } from '../services/pdfService.js';
import { putHtmlSnapshot, putPdf } from '../services/storageService.js';
import type { Env, AppVariables } from '../env.js';

const app = new Hono<{ Bindings: Env; Variables: AppVariables }>();
app.use('*', authMiddleware);

app.get('/dashboard', async (c) => {
  const { workspaceId } = c.get('auth');
  const stats = await getDashboardStats(getDb(c.env.DB), workspaceId);
  return c.json({ stats });
});

app.get('/', async (c) => {
  const { workspaceId } = c.get('auth');
  const status = c.req.query('status') ?? undefined;
  const limit = Number(c.req.query('limit') ?? 50);
  const offset = Number(c.req.query('offset') ?? 0);
  const rows = await listInvoices(getDb(c.env.DB), workspaceId, { status, limit, offset });
  return c.json({ invoices: rows });
});

app.post('/', async (c) => {
  const { workspaceId } = c.get('auth');
  const body = await c.req.json().catch(() => null);
  const parsed = invoiceCreateSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid input', issues: parsed.error.issues }, 400);

  const db = getDb(c.env.DB);
  const counterId = c.env.INVOICE_COUNTER.idFromName(workspaceId);
  const counter = c.env.INVOICE_COUNTER.get(counterId);

  try {
    const result = await createInvoice({ db, counter }, workspaceId, parsed.data);
    return c.json(result, 201);
  } catch (e) {
    return c.json({ error: (e as Error).message }, 400);
  }
});

app.get('/:id', async (c) => {
  const { workspaceId } = c.get('auth');
  const data = await getInvoiceWithItems(getDb(c.env.DB), workspaceId, c.req.param('id'));
  if (!data) return c.json({ error: 'Not found' }, 404);
  return c.json(data);
});

app.patch('/:id/status', async (c) => {
  const { workspaceId } = c.get('auth');
  const body = await c.req.json().catch(() => null);
  const parsed = invoiceStatusUpdateSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Invalid input' }, 400);
  const db = getDb(c.env.DB);
  await db
    .update(s.invoices)
    .set({
      status: parsed.data.status,
      paidAt: parsed.data.status === 'paid' ? Date.now() : undefined,
      updatedAt: Date.now(),
    })
    .where(and(eq(s.invoices.id, c.req.param('id')), eq(s.invoices.workspaceId, workspaceId)));
  return c.json({ ok: true });
});

/**
 * Render HTML preview (no PDF, no R2). Useful for live preview.
 */
app.get('/:id/preview', async (c) => {
  const { workspaceId } = c.get('auth');
  const db = getDb(c.env.DB);
  const data = await getInvoiceWithItems(db, workspaceId, c.req.param('id'));
  if (!data) return c.json({ error: 'Not found' }, 404);
  const company = await db.query.companyProfiles.findFirst({
    where: eq(s.companyProfiles.workspaceId, workspaceId),
  });
  const client = await db.query.clients.findFirst({
    where: eq(s.clients.id, data.invoice.clientId),
  });
  if (!company || !client) return c.json({ error: 'Missing data' }, 400);
  const html = renderInvoiceHtml({
    invoice: data.invoice,
    items: data.items,
    client,
    company,
    showDraftWatermark: data.invoice.status === 'draft',
  });
  return c.html(html);
});

/**
 * Generate PDF, store in R2, return signed-ish download URL via API.
 * If already locked + pdfR2Key exists, reuse it.
 */
app.post('/:id/pdf', async (c) => {
  const { workspaceId } = c.get('auth');
  const db = getDb(c.env.DB);
  const id = c.req.param('id');
  const data = await getInvoiceWithItems(db, workspaceId, id);
  if (!data) return c.json({ error: 'Not found' }, 404);

  const company = await db.query.companyProfiles.findFirst({
    where: eq(s.companyProfiles.workspaceId, workspaceId),
  });
  const client = await db.query.clients.findFirst({
    where: eq(s.clients.id, data.invoice.clientId),
  });
  if (!company || !client) return c.json({ error: 'Missing data' }, 400);

  const html = renderInvoiceHtml({
    invoice: data.invoice,
    items: data.items,
    client,
    company,
    showDraftWatermark: false,
  });

  const pdfSvc = new PdfService(c.env.BROWSER as never);
  const pdf = await pdfSvc.renderPdf(html);

  const pdfKey = await putPdf(c.env.PDFS, workspaceId, id, pdf);
  const htmlKey = await putHtmlSnapshot(c.env.PDFS, workspaceId, id, html);

  await db
    .update(s.invoices)
    .set({
      pdfR2Key: pdfKey,
      htmlSnapshotR2Key: htmlKey,
      lockedAt: data.invoice.lockedAt ?? Date.now(),
      updatedAt: Date.now(),
    })
    .where(and(eq(s.invoices.id, id), eq(s.invoices.workspaceId, workspaceId)));

  return c.json({ pdfKey, downloadUrl: `${c.env.API_URL}/v1/invoices/${id}/pdf/download` });
});

/**
 * Stream PDF directly. Auth required.
 */
app.get('/:id/pdf/download', async (c) => {
  const { workspaceId } = c.get('auth');
  const db = getDb(c.env.DB);
  const id = c.req.param('id');
  const inv = await db.query.invoices.findFirst({
    where: and(eq(s.invoices.id, id), eq(s.invoices.workspaceId, workspaceId)),
  });
  if (!inv?.pdfR2Key) return c.json({ error: 'PDF not generated yet' }, 404);
  const obj = await c.env.PDFS.get(inv.pdfR2Key);
  if (!obj) return c.json({ error: 'PDF missing in storage' }, 404);
  return new Response(obj.body, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${inv.invoiceNumber.replace(/\//g, '-')}.pdf"`,
      'Cache-Control': 'private, max-age=300',
    },
  });
});

export { app as invoiceRoutes };
