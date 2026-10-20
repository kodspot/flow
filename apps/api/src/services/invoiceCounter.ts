import { DurableObject } from 'cloudflare:workers';

/**
 * One DO instance per workspace (`idFromName(workspaceId)`).
 * Atomic, race-free invoice numbering across the edge.
 *
 * State stored in the DO's built-in SQLite:
 *   counters(year INTEGER PRIMARY KEY, last INTEGER)
 *   key_sequences(key, year, sequence, created_at) — number already handed to an idempotency key
 */
const KEY_SEQUENCE_TTL_MS = 24 * 60 * 60 * 1000;

export class InvoiceCounter extends DurableObject {
  constructor(state: DurableObjectState, env: unknown) {
    super(state, env as never);
    this.ctx.storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS counters (year INTEGER PRIMARY KEY, last INTEGER NOT NULL)`,
    );
    this.ctx.storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS key_sequences (
         key TEXT NOT NULL, year INTEGER NOT NULL, sequence INTEGER NOT NULL, created_at INTEGER NOT NULL,
         PRIMARY KEY (key, year))`,
    );
  }

  /**
   * Next number for `year`. With an idempotency key, every request carrying that key gets the
   * same number, so concurrent duplicates or a retry after a failed write never use up an extra
   * one: only one invoice can be written with it (unique key and sequence indexes).
   */
  async next(year: number, idempotencyKey?: string): Promise<{ year: number; sequence: number }> {
    return await this.ctx.blockConcurrencyWhile(async () => {
      const sql = this.ctx.storage.sql;
      if (idempotencyKey) {
        sql.exec('DELETE FROM key_sequences WHERE created_at < ?', Date.now() - KEY_SEQUENCE_TTL_MS);
        const held = sql
          .exec<{ sequence: number }>('SELECT sequence FROM key_sequences WHERE key = ? AND year = ?', idempotencyKey, year)
          .toArray();
        if (held[0]) return { year, sequence: held[0].sequence };
      }
      const rows = sql
        .exec<{ last: number }>('SELECT last FROM counters WHERE year = ?', year)
        .toArray();
      const next = (rows[0]?.last ?? 0) + 1;
      sql.exec(
        `INSERT INTO counters(year, last) VALUES(?, ?) ON CONFLICT(year) DO UPDATE SET last = excluded.last`,
        year,
        next,
      );
      if (idempotencyKey) {
        sql.exec(
          'INSERT INTO key_sequences(key, year, sequence, created_at) VALUES(?, ?, ?, ?)',
          idempotencyKey,
          year,
          next,
          Date.now(),
        );
      }
      return { year, sequence: next };
    });
  }

  async peek(year: number): Promise<number> {
    const rows = this.ctx.storage.sql
      .exec<{ last: number }>('SELECT last FROM counters WHERE year = ?', year)
      .toArray();
    return rows[0]?.last ?? 0;
  }

  // Allow setting starting value (e.g. when migrating existing invoices)
  async seed(year: number, value: number): Promise<void> {
    this.ctx.storage.sql.exec(
      `INSERT INTO counters(year, last) VALUES(?, ?) ON CONFLICT(year) DO UPDATE SET last = MAX(last, excluded.last)`,
      year,
      value,
    );
  }

  // RPC entrypoint when called via fetch (fallback)
  override async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const year = Number(url.searchParams.get('year') ?? new Date().getUTCFullYear());
    if (url.pathname.endsWith('/next')) {
      const r = await this.next(year);
      return Response.json(r);
    }
    if (url.pathname.endsWith('/peek')) {
      return Response.json({ last: await this.peek(year) });
    }
    return new Response('Not found', { status: 404 });
  }
}

export function pad(n: number, width = 3): string {
  return String(n).padStart(width, '0');
}

export function formatInvoiceNumber(prefix: string, year: number, seq: number): string {
  return `${prefix}/${year}/${pad(seq, 3)}`;
}
