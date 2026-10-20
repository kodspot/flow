import { describe, expect, it, vi } from 'vitest';
import type { SQL } from 'drizzle-orm';
import { SQLiteSyncDialect } from 'drizzle-orm/sqlite-core';
import type { DB } from '../db/client.js';
import * as s from '../db/schema.js';
import { createInvoice, IdempotencyConflictError, type CounterStub } from './invoiceService.js';

type Values = Record<string, unknown>;
type Op = { table: unknown; values: Values };

const input = {
  clientId: 'client_1',
  invoiceDate: '2026-11-01',
  gstApplicable: false,
  gstRatePercent: 0,
  items: [{ description: 'Retainer', quantity: 1, amountPaise: 5_000_000 }],
};

const params = (where: SQL) => new SQLiteSyncDialect().sqlToQuery(where).params;

/**
 * In-memory stand-in for the D1 calls createInvoice makes. `batch` applies the insert
 * atomically and enforces the real unique (workspace, idempotency_key) index.
 */
function fakeStore({
  batchDelayMs = 0,
  companyDelayMs = 0,
  failBatch,
}: { batchDelayMs?: number; companyDelayMs?: number; failBatch?: Error } = {}) {
  const invoices: Values[] = [];
  const items: Values[] = [];
  const db = {
    query: {
      companyProfiles: {
        findFirst: async () => {
          await new Promise((r) => setTimeout(r, companyDelayMs));
          return { invoiceNumberPrefix: 'KOD/INV', defaultPlaceOfSupply: 'Karnataka (29)', defaultGstNote: 'GST note', defaultInvoiceNotes: 'Thanks' };
        },
      },
      clients: { findFirst: async () => ({ id: 'client_1', name: 'BHEL' }) },
      invoices: {
        // createInvoice looks invoices up by (workspace, idempotency key).
        findFirst: async ({ where }: { where: SQL }) => {
          const p = params(where);
          const row = invoices.find((r) => r.idempotencyKey !== null && p.includes(r.idempotencyKey));
          return row ? { ...row } : undefined;
        },
      },
      invoiceItems: {
        findMany: async ({ where }: { where: SQL }) => {
          const p = params(where);
          return items
            .filter((it) => p.includes(it.invoiceId))
            .sort((a, b) => (a.position as number) - (b.position as number));
        },
      },
    },
    insert: (table: unknown) => ({ values: (values: Values) => ({ table, values }) }),
    batch: async (ops: Op[]) => {
      await new Promise((r) => setTimeout(r, batchDelayMs));
      if (failBatch) throw failBatch;
      const inv = ops.find((o) => o.table === s.invoices)!.values;
      if (inv.idempotencyKey && invoices.some((r) => r.idempotencyKey === inv.idempotencyKey)) {
        throw new Error('D1_ERROR: UNIQUE constraint failed: invoices.workspace_id, invoices.idempotency_key');
      }
      invoices.push(inv);
      items.push(...ops.filter((o) => o.table === s.invoiceItems).map((o) => o.values));
    },
  };
  // Models the InvoiceCounter Durable Object: one number per idempotency key.
  let seq = 6;
  const held = new Map<string, number>();
  const counter: CounterStub = {
    next: vi.fn(async (year: number, key?: string) => {
      if (key && held.has(key)) return { year, sequence: held.get(key)! };
      const sequence = ++seq;
      if (key) held.set(key, sequence);
      return { year, sequence };
    }),
  };
  const numbersUsed = () => seq - 6;
  return { db: db as unknown as DB, counter, invoices, numbersUsed };
}

describe('createInvoice', () => {
  it('creates a new draft through the counter, with nothing paid and no PDF', async () => {
    const store = fakeStore();
    const res = await createInvoice(store, 'ws_1', { ...input, idempotencyKey: 'k1' });

    expect(res.invoiceNumber).toBe('KOD/INV/2026/007');
    expect(store.counter.next).toHaveBeenCalledWith(2026, 'k1');
    const inv = store.invoices[0]!;
    expect(inv).toMatchObject({ id: res.id, status: 'draft', paidPaise: 0, idempotencyKey: 'k1', workspaceId: 'ws_1' });
    expect(inv).not.toHaveProperty('pdfR2Key');
    expect(inv).not.toHaveProperty('sentAt');
    expect(inv).not.toHaveProperty('paidAt');
  });

  it('returns the existing invoice for a repeat with the same key and details, without using a number', async () => {
    const store = fakeStore();
    const first = await createInvoice(store, 'ws_1', { ...input, idempotencyKey: 'k1' });
    const retry = await createInvoice(store, 'ws_1', { ...input, idempotencyKey: 'k1' });

    expect(retry).toEqual(first);
    expect(store.invoices).toHaveLength(1);
    expect(store.counter.next).toHaveBeenCalledTimes(1);
  });

  it('treats omitted optional fields as the same details as their stored defaults', async () => {
    const store = fakeStore();
    const first = await createInvoice(store, 'ws_1', { ...input, idempotencyKey: 'k1' });
    // Explicitly sending the defaults the first request received must still count as a retry.
    const retry = await createInvoice(store, 'ws_1', {
      ...input,
      placeOfSupply: 'Karnataka (29)',
      notes: 'Thanks',
      gstNote: 'GST note',
      items: [{ ...input.items[0]!, period: null, rateLabel: null, ratePaise: null, days: null }],
      idempotencyKey: 'k1',
    });
    expect(retry).toEqual(first);
  });

  it('rejects a repeated key with changed details instead of reporting the earlier invoice as saved', async () => {
    const store = fakeStore();
    const first = await createInvoice(store, 'ws_1', { ...input, idempotencyKey: 'k1' });
    const changed = { ...input, items: [{ ...input.items[0]!, description: 'Retainer (edited)' }], idempotencyKey: 'k1' };

    const err = await createInvoice(store, 'ws_1', changed).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(IdempotencyConflictError);
    expect((err as IdempotencyConflictError).existing).toEqual(first);
    // Nothing new stored, the earlier invoice untouched, no number used.
    expect(store.invoices).toHaveLength(1);
    expect(store.invoices[0]!.id).toBe(first.id);
    expect(store.counter.next).toHaveBeenCalledTimes(1);
  });

  it('concurrent requests with one key and the same details store one invoice and all get it back', async () => {
    // Both requests pass the initial key check before either write commits.
    const store = fakeStore({ batchDelayMs: 20 });
    const results = await Promise.all(
      [1, 2, 3].map(() => createInvoice(store, 'ws_1', { ...input, idempotencyKey: 'k-race' })),
    );

    expect(store.invoices).toHaveLength(1);
    expect(new Set(results.map((r) => r.id)).size).toBe(1);
    expect(results.every((r) => r.invoiceNumber === store.invoices[0]!.invoiceNumber)).toBe(true);
  });

  it('concurrent duplicates that both pass the key check use one invoice number between them', async () => {
    const store = fakeStore({ batchDelayMs: 20 });
    const results = await Promise.all(
      [1, 2, 3, 4].map(() => createInvoice(store, 'ws_1', { ...input, idempotencyKey: 'k-twin' })),
    );
    const next = await createInvoice(store, 'ws_1', { ...input, idempotencyKey: 'k-next' });

    expect(new Set(results.map((r) => r.id)).size).toBe(1);
    expect(store.counter.next).toHaveBeenCalledWith(2026, 'k-twin');
    expect(store.numbersUsed()).toBe(2);
    expect(next.invoiceNumber).toBe('KOD/INV/2026/008'); // no gap after 007
  });

  it('concurrent requests with one key but different details: one is stored, the other is rejected', async () => {
    const store = fakeStore({ batchDelayMs: 20 });
    const a = { ...input, idempotencyKey: 'k-race' };
    const b = { ...input, items: [{ ...input.items[0]!, amountPaise: 1 }], idempotencyKey: 'k-race' };
    const [ra, rb] = await Promise.allSettled([createInvoice(store, 'ws_1', a), createInvoice(store, 'ws_1', b)]);

    expect(store.invoices).toHaveLength(1);
    expect(ra.status).toBe('fulfilled');
    expect(rb.status).toBe('rejected');
    expect((rb as PromiseRejectedResult).reason).toBeInstanceOf(IdempotencyConflictError);
  });

  it('different keys create separate invoices with their own numbers', async () => {
    const store = fakeStore();
    const a = await createInvoice(store, 'ws_1', { ...input, idempotencyKey: 'copy-1' });
    const b = await createInvoice(store, 'ws_1', { ...input, idempotencyKey: 'copy-2' });

    expect(a.id).not.toBe(b.id);
    expect(a.invoiceNumber).not.toBe(b.invoiceNumber);
    expect(store.invoices).toHaveLength(2);
  });

  it('still reports a failed write that is not a duplicate', async () => {
    const store = fakeStore({ failBatch: new Error('D1_ERROR: database unavailable') });
    await expect(createInvoice(store, 'ws_1', { ...input, idempotencyKey: 'k1' })).rejects.toThrow(
      'database unavailable',
    );
    await expect(createInvoice(store, 'ws_1', input)).rejects.toThrow('database unavailable');
  });
});
