import { describe, expect, it, vi } from 'vitest';
import type { SQL } from 'drizzle-orm';
import { SQLiteSyncDialect } from 'drizzle-orm/sqlite-core';
import type { DB } from '../db/client.js';
import * as s from '../db/schema.js';
import { createInvoice, type CounterStub } from './invoiceService.js';

type Row = { id: string; invoiceNumber: string; idempotencyKey: string | null };
type Op = { table: unknown; values: Record<string, unknown> };

const input = {
  clientId: 'client_1',
  invoiceDate: '2026-11-01',
  gstApplicable: false,
  gstRatePercent: 0,
  items: [{ description: 'Retainer', quantity: 1, amountPaise: 5_000_000 }],
};

/**
 * In-memory stand-in for the D1 calls createInvoice makes. `batch` applies the insert
 * atomically and enforces the real unique (workspace, idempotency_key) index.
 */
function fakeStore({ batchDelayMs = 0, failBatch }: { batchDelayMs?: number; failBatch?: Error } = {}) {
  const rows: Row[] = [];
  const batches: Op[][] = [];
  let lookups = 0;
  const db = {
    query: {
      companyProfiles: {
        findFirst: async () => ({ invoiceNumberPrefix: 'KOD/INV', defaultPlaceOfSupply: null, defaultGstNote: null, defaultInvoiceNotes: null }),
      },
      clients: { findFirst: async () => ({ id: 'client_1', name: 'BHEL' }) },
      invoices: {
        // createInvoice looks invoices up by (workspace, idempotency key); answer from `rows`.
        findFirst: async ({ where }: { where: SQL }) => {
          lookups++;
          const { params } = new SQLiteSyncDialect().sqlToQuery(where);
          const row = rows.find((r) => r.idempotencyKey !== null && params.includes(r.idempotencyKey));
          return row ? { ...row } : undefined;
        },
      },
    },
    insert: (table: unknown) => ({ values: (values: Record<string, unknown>) => ({ table, values }) }),
    batch: async (ops: Op[]) => {
      await new Promise((r) => setTimeout(r, batchDelayMs));
      if (failBatch) throw failBatch;
      const inv = ops.find((o) => o.table === s.invoices)!.values;
      if (inv.idempotencyKey && rows.some((r) => r.idempotencyKey === inv.idempotencyKey)) {
        throw new Error('D1_ERROR: UNIQUE constraint failed: invoices.workspace_id, invoices.idempotency_key');
      }
      batches.push(ops);
      rows.push({ id: inv.id as string, invoiceNumber: inv.invoiceNumber as string, idempotencyKey: inv.idempotencyKey as string | null });
    },
  };
  let seq = 6;
  const counter: CounterStub = { next: vi.fn(async (year: number) => ({ year, sequence: ++seq })) };
  return { db: db as unknown as DB, counter, rows, batches, lookups: () => lookups };
}

describe('createInvoice', () => {
  it('creates a new draft through the counter, with nothing paid and no PDF', async () => {
    const store = fakeStore();
    const res = await createInvoice(store, 'ws_1', { ...input, idempotencyKey: 'k1' });

    expect(res.invoiceNumber).toBe('KOD/INV/2026/007');
    expect(store.counter.next).toHaveBeenCalledWith(2026);
    const inv = store.batches[0]!.find((o) => o.table === s.invoices)!.values;
    expect(inv).toMatchObject({ id: res.id, status: 'draft', paidPaise: 0, idempotencyKey: 'k1', workspaceId: 'ws_1' });
    expect(inv).not.toHaveProperty('pdfR2Key');
    expect(inv).not.toHaveProperty('sentAt');
    expect(inv).not.toHaveProperty('paidAt');
  });

  it('returns the existing invoice for a repeated key without using another number', async () => {
    const store = fakeStore();
    const first = await createInvoice(store, 'ws_1', { ...input, idempotencyKey: 'k1' });
    const retry = await createInvoice(store, 'ws_1', { ...input, idempotencyKey: 'k1' });

    expect(retry).toEqual(first);
    expect(store.rows).toHaveLength(1);
    expect(store.counter.next).toHaveBeenCalledTimes(1);
  });

  it('concurrent requests with one key store one invoice and all get it back', async () => {
    // Both requests pass the initial key check before either write commits.
    const store = fakeStore({ batchDelayMs: 20 });
    const results = await Promise.all(
      [1, 2, 3].map(() => createInvoice(store, 'ws_1', { ...input, idempotencyKey: 'k-race' })),
    );

    expect(store.rows).toHaveLength(1);
    expect(new Set(results.map((r) => r.id)).size).toBe(1);
    expect(results.every((r) => r.invoiceNumber === store.rows[0]!.invoiceNumber)).toBe(true);
  });

  it('different keys create separate invoices with their own numbers', async () => {
    const store = fakeStore();
    const a = await createInvoice(store, 'ws_1', { ...input, idempotencyKey: 'copy-1' });
    const b = await createInvoice(store, 'ws_1', { ...input, idempotencyKey: 'copy-2' });

    expect(a.id).not.toBe(b.id);
    expect(a.invoiceNumber).not.toBe(b.invoiceNumber);
    expect(store.rows).toHaveLength(2);
  });

  it('still reports a failed write that is not a duplicate', async () => {
    const store = fakeStore({ failBatch: new Error('D1_ERROR: database unavailable') });
    await expect(createInvoice(store, 'ws_1', { ...input, idempotencyKey: 'k1' })).rejects.toThrow(
      'database unavailable',
    );
    await expect(createInvoice(store, 'ws_1', input)).rejects.toThrow('database unavailable');
  });
});
