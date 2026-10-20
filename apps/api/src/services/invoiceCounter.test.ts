import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { InvoiceCounter, formatInvoiceNumber } from './invoiceCounter.js';

// Node's built-in SQLite, loaded through Node itself (Vite can't resolve the `node:sqlite` builtin).
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');

/** Runs the Durable Object's real SQL against an in-memory SQLite database. */
function counter() {
  const db = new DatabaseSync(':memory:');
  const ctx = {
    blockConcurrencyWhile: <T>(fn: () => Promise<T>) => fn(),
    storage: {
      sql: {
        exec: (query: string, ...params: unknown[]) => {
          const stmt = db.prepare(query);
          const rows = /^\s*select/i.test(query) ? stmt.all(...(params as never[])) : (stmt.run(...(params as never[])), []);
          return { toArray: () => rows };
        },
      },
    },
  };
  return new InvoiceCounter(ctx as never, {});
}

describe('InvoiceCounter', () => {
  it('numbers each year consecutively', async () => {
    const c = counter();
    expect((await c.next(2026)).sequence).toBe(1);
    expect((await c.next(2026)).sequence).toBe(2);
    expect((await c.next(2027)).sequence).toBe(1);
    expect(formatInvoiceNumber('KOD/INV', 2026, 2)).toBe('KOD/INV/2026/002');
  });

  it('gives every request with the same idempotency key the same number', async () => {
    const c = counter();
    const a = await c.next(2026, 'web-abc');
    const b = await c.next(2026, 'web-abc');
    const other = await c.next(2026, 'web-def');
    const plain = await c.next(2026);
    expect([a.sequence, b.sequence, other.sequence, plain.sequence]).toEqual([1, 1, 2, 3]);
  });

  it('keeps a key per year (a retry with a different year gets that year’s next number)', async () => {
    const c = counter();
    expect((await c.next(2026, 'web-abc')).sequence).toBe(1);
    expect((await c.next(2027, 'web-abc')).sequence).toBe(1);
    expect((await c.next(2027)).sequence).toBe(2);
  });
});
