import { eq, and, desc, isNull, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { DB } from '../db/client.js';
import * as s from '../db/schema.js';
import { amountInWords } from '@kodspot/shared/money';
import type { InvoiceCreateInput, InvoiceUpdateInput } from '@kodspot/shared/schemas';
import { formatInvoiceNumber } from './invoiceCounter.js';

export interface CounterStub {
  next(year: number): Promise<{ year: number; sequence: number }>;
}

export interface CreateInvoiceDeps {
  db: DB;
  counter: CounterStub;
}

function toDateMs(input: string | number): number {
  if (typeof input === 'number') return input;
  // Accept "2026-04-30" or full ISO
  const d = new Date(input.length <= 10 ? `${input}T00:00:00.000Z` : input);
  return d.getTime();
}

export async function createInvoice(
  { db, counter }: CreateInvoiceDeps,
  workspaceId: string,
  input: InvoiceCreateInput,
): Promise<{ id: string; invoiceNumber: string }> {
  // Idempotency
  if (input.idempotencyKey) {
    const existing = await db.query.invoices.findFirst({
      where: and(
        eq(s.invoices.workspaceId, workspaceId),
        eq(s.invoices.idempotencyKey, input.idempotencyKey),
      ),
    });
    if (existing) return { id: existing.id, invoiceNumber: existing.invoiceNumber };
  }

  // Load company + client snapshot
  const company = await db.query.companyProfiles.findFirst({
    where: eq(s.companyProfiles.workspaceId, workspaceId),
  });
  if (!company) throw new Error('Company profile not configured');

  const client = await db.query.clients.findFirst({
    where: and(
      eq(s.clients.id, input.clientId),
      eq(s.clients.workspaceId, workspaceId),
      isNull(s.clients.deletedAt),
    ),
  });
  if (!client) throw new Error('Client not found');

  // Compute totals
  const subtotal = input.items.reduce((sum, it) => sum + it.amountPaise, 0);
  const gstRateBp = input.gstApplicable ? Math.round(input.gstRatePercent * 100) : 0; // basis points x100
  const gstAmount = input.gstApplicable
    ? Math.round((subtotal * gstRateBp) / 10000)
    : 0;
  const total = subtotal + gstAmount;

  // Allocate sequence number
  const invoiceDateMs = toDateMs(input.invoiceDate);
  const year = new Date(invoiceDateMs).getUTCFullYear();
  const { sequence } = await counter.next(year);
  const invoiceNumber = formatInvoiceNumber(company.invoiceNumberPrefix, year, sequence);

  const id = nanoid(16);
  const now = Date.now();
  const dueDateMs = input.dueDate ? toDateMs(input.dueDate) : null;

  await db.batch([
    db.insert(s.invoices).values({
      id,
      workspaceId,
      clientId: client.id,
      clientSnapshot: JSON.stringify(client),
      invoiceNumber,
      sequenceYear: year,
      sequenceNumber: sequence,
      invoiceDate: invoiceDateMs,
      dueDate: dueDateMs,
      placeOfSupply: input.placeOfSupply ?? company.defaultPlaceOfSupply ?? null,
      status: 'draft',
      subtotalPaise: subtotal,
      gstApplicable: input.gstApplicable,
      gstRatePercent: gstRateBp,
      gstAmountPaise: gstAmount,
      gstNote: input.gstNote ?? company.defaultGstNote ?? null,
      totalPaise: total,
      paidPaise: 0,
      amountInWords: amountInWords(total),
      notes: input.notes ?? company.defaultInvoiceNotes ?? null,
      internalNotes: input.internalNotes ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      createdAt: now,
      updatedAt: now,
    }),
    ...input.items.map((it, idx) =>
      db.insert(s.invoiceItems).values({
        id: nanoid(16),
        invoiceId: id,
        workspaceId,
        position: idx,
        description: it.description,
        period: it.period ?? null,
        rateLabel: it.rateLabel ?? null,
        ratePaise: it.ratePaise ?? null,
        days: it.days ?? null,
        quantity: it.quantity ?? 1,
        amountPaise: it.amountPaise,
        createdAt: now,
      }),
    ),
    db.insert(s.auditLogs).values({
      id: nanoid(16),
      workspaceId,
      actorUserId: null,
      action: 'invoice.created',
      entityType: 'invoice',
      entityId: id,
      metadata: JSON.stringify({ invoiceNumber, total }),
      createdAt: now,
    }),
  ] as const);

  return { id, invoiceNumber };
}

export async function listInvoices(db: DB, workspaceId: string, opts: { limit?: number; offset?: number; status?: string } = {}) {
  const limit = Math.min(opts.limit ?? 50, 200);
  const offset = opts.offset ?? 0;
  const conds = [eq(s.invoices.workspaceId, workspaceId), isNull(s.invoices.deletedAt)];
  if (opts.status) conds.push(eq(s.invoices.status, opts.status as 'draft'));
  return db
    .select()
    .from(s.invoices)
    .where(and(...conds))
    .orderBy(desc(s.invoices.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function getInvoiceWithItems(db: DB, workspaceId: string, id: string) {
  const invoice = await db.query.invoices.findFirst({
    where: and(eq(s.invoices.id, id), eq(s.invoices.workspaceId, workspaceId)),
  });
  if (!invoice) return null;
  const items = await db.query.invoiceItems.findMany({
    where: eq(s.invoiceItems.invoiceId, id),
  });
  return { invoice, items };
}

export async function getDashboardStats(db: DB, workspaceId: string) {
  const rows = await db
    .select({
      status: s.invoices.status,
      count: sql<number>`count(*)`,
      total: sql<number>`coalesce(sum(${s.invoices.totalPaise}), 0)`,
    })
    .from(s.invoices)
    .where(and(eq(s.invoices.workspaceId, workspaceId), isNull(s.invoices.deletedAt)))
    .groupBy(s.invoices.status);

  const stats = {
    total: { count: 0, amount: 0 },
    draft: { count: 0, amount: 0 },
    sent: { count: 0, amount: 0 },
    paid: { count: 0, amount: 0 },
    overdue: { count: 0, amount: 0 },
    cancelled: { count: 0, amount: 0 },
  };
  for (const r of rows) {
    const k = r.status as keyof typeof stats;
    if (k in stats) stats[k] = { count: Number(r.count), amount: Number(r.total) };
    stats.total.count += Number(r.count);
    stats.total.amount += Number(r.total);
  }
  return stats;
}

/**
 * Update a draft invoice (full replace of fields + items).
 * Throws if not found, not editable (non-draft), or client invalid.
 * Returns the updated id.
 */
export async function updateInvoice(
  db: DB,
  workspaceId: string,
  id: string,
  input: InvoiceUpdateInput,
): Promise<{ id: string }> {
  const existing = await db.query.invoices.findFirst({
    where: and(eq(s.invoices.id, id), eq(s.invoices.workspaceId, workspaceId), isNull(s.invoices.deletedAt)),
  });
  if (!existing) throw new Error('Invoice not found');
  if (existing.status !== 'draft') {
    throw new Error('Only draft invoices can be edited. Change status to draft first or duplicate this invoice.');
  }

  // Resolve client (may change)
  const clientId = input.clientId ?? existing.clientId;
  const client = await db.query.clients.findFirst({
    where: and(
      eq(s.clients.id, clientId),
      eq(s.clients.workspaceId, workspaceId),
      isNull(s.clients.deletedAt),
    ),
  });
  if (!client) throw new Error('Client not found');

  const items = input.items ?? [];
  if (items.length === 0) throw new Error('At least one item required');

  const subtotal = items.reduce((sum, it) => sum + it.amountPaise, 0);
  const gstApplicable = input.gstApplicable ?? existing.gstApplicable;
  const gstRatePercent = input.gstRatePercent ?? existing.gstRatePercent / 100;
  const gstRateBp = gstApplicable ? Math.round(gstRatePercent * 100) : 0;
  const gstAmount = gstApplicable ? Math.round((subtotal * gstRateBp) / 10000) : 0;
  const total = subtotal + gstAmount;

  const invoiceDateMs = input.invoiceDate ? toDateMs(input.invoiceDate) : existing.invoiceDate;
  const dueDateMs =
    input.dueDate === undefined
      ? existing.dueDate
      : input.dueDate === null
      ? null
      : toDateMs(input.dueDate);

  const now = Date.now();

  await db.batch([
    db.update(s.invoices)
      .set({
        clientId: client.id,
        clientSnapshot: JSON.stringify(client),
        invoiceDate: invoiceDateMs,
        dueDate: dueDateMs,
        placeOfSupply: input.placeOfSupply ?? existing.placeOfSupply,
        subtotalPaise: subtotal,
        gstApplicable,
        gstRatePercent: gstRateBp,
        gstAmountPaise: gstAmount,
        gstNote: input.gstNote ?? existing.gstNote,
        totalPaise: total,
        amountInWords: amountInWords(total),
        notes: input.notes ?? existing.notes,
        internalNotes: input.internalNotes ?? existing.internalNotes,
        // Invalidate cached PDF — must be regenerated after edit
        pdfR2Key: null,
        htmlSnapshotR2Key: null,
        updatedAt: now,
      })
      .where(and(eq(s.invoices.id, id), eq(s.invoices.workspaceId, workspaceId))),
    db.delete(s.invoiceItems).where(eq(s.invoiceItems.invoiceId, id)),
    ...items.map((it, idx) =>
      db.insert(s.invoiceItems).values({
        id: nanoid(16),
        invoiceId: id,
        workspaceId,
        position: idx,
        description: it.description,
        period: it.period ?? null,
        rateLabel: it.rateLabel ?? null,
        ratePaise: it.ratePaise ?? null,
        days: it.days ?? null,
        quantity: it.quantity ?? 1,
        amountPaise: it.amountPaise,
        createdAt: now,
      }),
    ),
    db.insert(s.auditLogs).values({
      id: nanoid(16),
      workspaceId,
      actorUserId: null,
      action: 'invoice.updated',
      entityType: 'invoice',
      entityId: id,
      metadata: JSON.stringify({ total }),
      createdAt: now,
    }),
  ] as const);

  return { id };
}

/**
 * Soft-delete a draft invoice. Non-draft invoices cannot be deleted (use cancel).
 */
export async function softDeleteInvoice(db: DB, workspaceId: string, id: string): Promise<void> {
  const existing = await db.query.invoices.findFirst({
    where: and(eq(s.invoices.id, id), eq(s.invoices.workspaceId, workspaceId), isNull(s.invoices.deletedAt)),
  });
  if (!existing) throw new Error('Invoice not found');
  if (existing.status !== 'draft') {
    throw new Error('Only draft invoices can be deleted. Cancel non-draft invoices instead.');
  }
  const now = Date.now();
  await db.batch([
    db.update(s.invoices)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(eq(s.invoices.id, id), eq(s.invoices.workspaceId, workspaceId))),
    db.insert(s.auditLogs).values({
      id: nanoid(16),
      workspaceId,
      actorUserId: null,
      action: 'invoice.deleted',
      entityType: 'invoice',
      entityId: id,
      metadata: null,
      createdAt: now,
    }),
  ] as const);
}
