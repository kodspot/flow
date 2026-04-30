import { DurableObject } from 'cloudflare:workers';

/**
 * One DO instance per workspace (`idFromName(workspaceId)`).
 * Atomic, race-free invoice numbering across the edge.
 *
 * State stored in the DO's built-in SQLite:
 *   counters(year INTEGER PRIMARY KEY, last INTEGER)
 */
export class InvoiceCounter extends DurableObject {
  constructor(state: DurableObjectState, env: unknown) {
    super(state, env as never);
    this.ctx.storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS counters (year INTEGER PRIMARY KEY, last INTEGER NOT NULL)`,
    );
  }

  async next(year: number): Promise<{ year: number; sequence: number }> {
    return await this.ctx.blockConcurrencyWhile(async () => {
      const rows = this.ctx.storage.sql
        .exec<{ last: number }>('SELECT last FROM counters WHERE year = ?', year)
        .toArray();
      const next = (rows[0]?.last ?? 0) + 1;
      this.ctx.storage.sql.exec(
        `INSERT INTO counters(year, last) VALUES(?, ?) ON CONFLICT(year) DO UPDATE SET last = excluded.last`,
        year,
        next,
      );
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
