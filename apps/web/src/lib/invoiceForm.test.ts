import { describe, expect, it } from 'vitest';
import { parseInvoiceInternalNotes } from '@kodspot/shared/invoiceTables';
import {
  blankItem,
  columnValueCount,
  emptyInvoiceForm,
  formValuesToPayload,
  invoiceToCopyFormValues,
  invoiceToFormValues,
  newIdempotencyKey,
  todayIsoDate,
  type InvoiceFormValues,
  type InvoicePayload,
  type InvoiceSource,
  type InvoiceSourceItem,
} from './invoiceForm';

/** What the API stores for a payload and returns from GET /v1/invoices/:id. */
function saved(payload: InvoicePayload): { invoice: InvoiceSource; items: InvoiceSourceItem[] } {
  return {
    invoice: {
      clientId: payload.clientId,
      invoiceDate: Date.parse(`${payload.invoiceDate}T00:00:00.000Z`),
      placeOfSupply: payload.placeOfSupply,
      gstApplicable: payload.gstApplicable,
      gstRatePercent: Math.round(payload.gstRatePercent * 100),
      gstNote: payload.gstNote,
      notes: payload.notes,
      internalNotes: payload.internalNotes,
    },
    items: payload.items.map((it, position) => ({ ...it, position })),
  };
}

function formWithHiddenColumns(): InvoiceFormValues {
  const base = emptyInvoiceForm();
  return {
    ...base,
    clientId: 'client_1',
    invoiceDate: '2026-10-01',
    columns: [
      ...base.columns.map((c) =>
        ['days', 'quantity', 'period', 'rateLabel'].includes(c.key) ? { ...c, enabled: false } : c,
      ),
      { key: 'custom:col_1', label: 'PO number', enabled: false },
    ],
    items: [
      {
        ...blankItem(),
        description: 'Retainer',
        period: 'Oct 2026',
        rateLabel: '₹5,000/day',
        rateRupees: '5000',
        days: '10 days',
        quantity: '2 nos',
        amountRupees: '50000',
        customValues: { 'custom:col_1': 'PO-77' },
      },
      { ...blankItem(), description: 'Hosting', amountRupees: '1200', customValues: { 'custom:col_1': '' } },
    ],
  };
}

describe('hidden columns keep their values', () => {
  it('are saved unchanged while marked hidden', () => {
    const payload = formValuesToPayload(formWithHiddenColumns());
    expect(payload.items[0]).toMatchObject({ period: 'Oct 2026', rateLabel: '₹5,000/day', ratePaise: 500000, days: 10, quantity: 2 });

    const meta = parseInvoiceInternalNotes(payload.internalNotes).tableMeta;
    expect(meta.columns.filter((c) => !c.enabled).map((c) => c.key)).toEqual(
      expect.arrayContaining(['period', 'rateLabel', 'days', 'quantity', 'custom:col_1']),
    );
    expect(meta.customRowValues[0]).toMatchObject({ 'custom:days_display': '10 days', 'custom:quantity_display': '2 nos', 'custom:col_1': 'PO-77' });
  });

  it('come back unchanged when the invoice is reopened, and re-saving is stable', () => {
    const original = formWithHiddenColumns();
    const first = formValuesToPayload(original);
    const reopened = invoiceToFormValues(saved(first).invoice, saved(first).items);

    expect(reopened.columns).toEqual(parseInvoiceInternalNotes(first.internalNotes).tableMeta.columns);
    expect(reopened.items).toEqual(original.items);
    expect(formValuesToPayload(reopened)).toEqual(first);
  });

  it('do not change totals: only Amount feeds the subtotal', () => {
    const payload = formValuesToPayload(formWithHiddenColumns());
    expect(payload.items.reduce((s, it) => s + it.amountPaise, 0)).toBe(5_120_000);
  });

  it('are counted per column for the "values kept" note', () => {
    const { items } = formWithHiddenColumns();
    expect(columnValueCount('days', items)).toBe(1);
    expect(columnValueCount('quantity', items)).toBe(1); // default "1" is not a kept value
    expect(columnValueCount('rateLabel', items)).toBe(1);
    expect(columnValueCount('custom:col_1', items)).toBe(1);
    expect(columnValueCount('period', [blankItem()])).toBe(0);
  });
});

describe('invoiceToCopyFormValues', () => {
  const source = saved(formValuesToPayload({ ...formWithHiddenColumns(), extraTables: [{ id: 't1', title: 'Milestones', headers: ['Phase'], rows: [['Design']] }] }));
  const now = new Date(2026, 10, 20, 9, 30);

  it('copies everything from the source except the invoice date, which becomes today', () => {
    const edit = invoiceToFormValues(source.invoice, source.items);
    const { values, clientMissing } = invoiceToCopyFormValues(source.invoice, source.items, new Set(['client_1']), now);

    expect(clientMissing).toBe(false);
    expect(values).toEqual({ ...edit, invoiceDate: '2026-11-20' });
    expect(values.extraTables).toEqual([{ id: 't1', title: 'Milestones', headers: ['Phase'], rows: [['Design']] }]);
  });

  it('produces a create payload with no identity, number, status, payment or PDF fields', () => {
    const { values } = invoiceToCopyFormValues(source.invoice, source.items, new Set(['client_1']), now);
    const payload = formValuesToPayload(values);
    expect(Object.keys(payload).sort()).toEqual(
      ['clientId', 'gstApplicable', 'gstNote', 'gstRatePercent', 'internalNotes', 'invoiceDate', 'items', 'notes', 'placeOfSupply'],
    );
  });

  it('keeps hidden columns and their values in the copy', () => {
    const { values } = invoiceToCopyFormValues(source.invoice, source.items, new Set(['client_1']), now);
    expect(values.columns.find((c) => c.key === 'days')?.enabled).toBe(false);
    expect(values.items[0]).toMatchObject({ days: '10 days', quantity: '2 nos', customValues: { 'custom:col_1': 'PO-77' } });
  });

  it('clears a customer that no longer exists', () => {
    const { values, clientMissing } = invoiceToCopyFormValues(source.invoice, source.items, new Set(['someone_else']), now);
    expect(clientMissing).toBe(true);
    expect(values.clientId).toBe('');
  });
});

describe('item order', () => {
  it('follows position so per-row column values stay with their item', () => {
    const src = saved(formValuesToPayload(formWithHiddenColumns()));
    const shuffled = [...src.items].reverse();
    const values = invoiceToFormValues(src.invoice, shuffled);
    expect(values.items.map((it) => it.description)).toEqual(['Retainer', 'Hosting']);
    expect(values.items[0]!.customValues['custom:col_1']).toBe('PO-77');
  });
});

describe('dates and keys', () => {
  it('uses the local calendar date, not UTC', () => {
    // 01:00 local on 1 Jan is still 31 Dec in UTC for zones ahead of UTC (e.g. IST).
    expect(todayIsoDate(new Date(2026, 0, 1, 1, 0))).toBe('2026-01-01');
  });

  it('generates a distinct key per intended creation', () => {
    const keys = new Set(Array.from({ length: 200 }, () => newIdempotencyKey()));
    expect(keys.size).toBe(200);
    for (const k of keys) expect(k.length).toBeLessThanOrEqual(100); // API schema limit
  });
});
