import { rupeesToPaise, paiseToRupees } from '@kodspot/shared/money';
import {
  composeInvoiceInternalNotes,
  defaultInvoiceTableMeta,
  getDefaultInvoiceColumnLabel,
  INVOICE_RESERVED_ROW_VALUE_KEYS,
  isCustomInvoiceColumnKey,
  parseInvoiceInternalNotes,
  type InvoiceExtraTableConfig,
  type InvoiceTableColumnConfig,
} from '@kodspot/shared/invoiceTables';

export interface InvoiceFormItem {
  description: string;
  period: string;
  rateLabel: string;
  rateRupees: string;
  days: string;
  quantity: string;
  amountRupees: string;
  customValues: Record<string, string>;
}

export interface InvoiceFormValues {
  clientId: string;
  invoiceDate: string;
  placeOfSupply: string;
  gstApplicable: boolean;
  gstRatePercent: number;
  gstNote: string;
  notes: string;
  internalNotesPlain: string;
  columns: InvoiceTableColumnConfig[];
  extraTables: InvoiceExtraTableConfig[];
  items: InvoiceFormItem[];
}

export interface InvoicePayload {
  clientId: string;
  invoiceDate: string;
  placeOfSupply: string;
  gstApplicable: boolean;
  gstRatePercent: number;
  gstNote: string | null;
  notes: string;
  internalNotes: string | null;
  items: Array<{
    description: string;
    period: string | null;
    rateLabel: string | null;
    ratePaise: number | null;
    days: number | null;
    quantity: number;
    amountPaise: number;
  }>;
  /** Set once per intended creation; the API returns the existing invoice on a repeat. */
  idempotencyKey?: string;
}

/** Invoice + items as returned by GET /v1/invoices/:id (fields the form needs). */
export interface InvoiceSource {
  clientId: string;
  invoiceDate: number;
  placeOfSupply: string | null;
  gstApplicable: boolean;
  gstRatePercent: number; // basis points x100 in DB
  gstNote: string | null;
  notes: string | null;
  internalNotes?: string | null;
}

export interface InvoiceSourceItem {
  /** Row order; column values in the table metadata are matched to items by this order. */
  position?: number;
  description: string;
  period: string | null;
  rateLabel: string | null;
  ratePaise: number | null;
  days: number | null;
  quantity: number | null;
  amountPaise: number;
}

export const blankItem = (): InvoiceFormItem => ({
  description: '',
  period: '',
  rateLabel: '',
  rateRupees: '',
  days: '',
  quantity: '1',
  amountRupees: '',
  customValues: {},
});

export const defaultGstNote =
  'This transaction is exempt from GST under Section 22 of the Central Goods and Services Tax Act, 2017 as the aggregate turnover of KODSPOT is below the prescribed threshold limit of Rs 20 lakh. No GST will be charged or collected. HSN Code: 998313 (IT Services).';

export const defaultNotes = 'Note: Invoice is generated at the end of every month.';

export function normalizeExtraTables(tables: InvoiceExtraTableConfig[]): InvoiceExtraTableConfig[] {
  return tables.map((t, idx) => ({
    id: t.id || `table_${idx + 1}`,
    title: t.title || `Additional Table ${idx + 1}`,
    headers: t.headers.length > 0 ? t.headers : ['Column 1'],
    rows: t.rows.map((row) => {
      const next = [...row];
      while (next.length < (t.headers.length || 1)) next.push('');
      return next.slice(0, t.headers.length || 1);
    }),
  }));
}

export function syncItemCustomValues(
  items: InvoiceFormItem[],
  columns: InvoiceTableColumnConfig[],
): InvoiceFormItem[] {
  const customKeys = columns.filter((c) => isCustomInvoiceColumnKey(c.key)).map((c) => c.key);
  return items.map((it) => {
    const next: Record<string, string> = {};
    customKeys.forEach((k) => {
      next[k] = it.customValues[k] ?? '';
    });
    return { ...it, customValues: next };
  });
}

export function clampNonNegativeNumber(value: string, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}

function parseFirstIntegerFromText(value: string): number | null {
  const m = value.match(/\d+/);
  if (!m) return null;
  const n = Number(m[0]);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

/** Local calendar date as YYYY-MM-DD (the date input's format). */
export function todayIsoDate(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function emptyInvoiceForm(): InvoiceFormValues {
  return {
    clientId: '',
    invoiceDate: todayIsoDate(),
    placeOfSupply: 'Karnataka (29)',
    gstApplicable: false,
    gstRatePercent: 18,
    gstNote: defaultGstNote,
    notes: defaultNotes,
    internalNotesPlain: '',
    columns: defaultInvoiceTableMeta().columns,
    extraTables: [],
    items: [blankItem()],
  };
}

/** Convert API InvoiceItem rows + Invoice to a form values object for editing. */
export function invoiceToFormValues(inv: InvoiceSource, items: InvoiceSourceItem[]): InvoiceFormValues {
  const parsed = parseInvoiceInternalNotes(inv.internalNotes);
  const columns = parsed.tableMeta.columns;
  const ordered = [...items].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const hydratedItems =
    ordered.length > 0
      ? ordered.map((it, idx) => {
          const next = blankItem();
          const rowValues = parsed.tableMeta.customRowValues[idx] ?? {};
          next.description = it.description;
          next.period = it.period ?? '';
          next.rateLabel = it.rateLabel ?? '';
          next.rateRupees = it.ratePaise != null ? String(paiseToRupees(it.ratePaise)) : '';
          next.days =
            rowValues[INVOICE_RESERVED_ROW_VALUE_KEYS.daysDisplay] ??
            (it.days != null ? String(it.days) : '');
          next.quantity =
            rowValues[INVOICE_RESERVED_ROW_VALUE_KEYS.quantityDisplay] ??
            String(it.quantity ?? 1);
          next.amountRupees = String(paiseToRupees(it.amountPaise));

          columns.forEach((c) => {
            if (isCustomInvoiceColumnKey(c.key)) {
              next.customValues[c.key] = rowValues[c.key] ?? '';
            }
          });
          return next;
        })
      : [blankItem()];

  return {
    clientId: inv.clientId,
    invoiceDate: new Date(inv.invoiceDate).toISOString().slice(0, 10),
    placeOfSupply: inv.placeOfSupply ?? 'Karnataka (29)',
    gstApplicable: inv.gstApplicable,
    gstRatePercent: inv.gstRatePercent / 100,
    gstNote: inv.gstNote ?? defaultGstNote,
    notes: inv.notes ?? '',
    internalNotesPlain: parsed.plainText ?? '',
    columns,
    extraTables: normalizeExtraTables(parsed.tableMeta.extraTables),
    items: syncItemCustomValues(hydratedItems, columns),
  };
}

/**
 * Form values for a new invoice copied from an existing one. Reuses the edit mapping, so
 * customer, items, column settings (hidden columns and their values included), additional
 * tables, tax settings and notes carry over unchanged. Only the invoice date is reset to
 * today. Identity, number, status, payments and PDFs are never part of the form, so the
 * normal create path assigns all of them fresh. A customer that no longer exists is cleared.
 */
export function invoiceToCopyFormValues(
  inv: InvoiceSource,
  items: InvoiceSourceItem[],
  activeClientIds: ReadonlySet<string>,
  now: Date = new Date(),
): { values: InvoiceFormValues; clientMissing: boolean } {
  const values = invoiceToFormValues(inv, items);
  const clientMissing = !activeClientIds.has(values.clientId);
  return {
    values: {
      ...values,
      clientId: clientMissing ? '' : values.clientId,
      invoiceDate: todayIsoDate(now),
    },
    clientMissing,
  };
}

/**
 * How many items hold a value in a column. Used to say "values kept" when a column is hidden.
 * Quantity counts only when it differs from the default of 1.
 */
export function columnValueCount(key: string, items: InvoiceFormItem[]): number {
  return items.filter((it) => {
    if (key === 'period') return it.period.trim() !== '';
    if (key === 'rateLabel') return it.rateLabel.trim() !== '' || it.rateRupees.trim() !== '';
    if (key === 'days') return it.days.trim() !== '';
    if (key === 'quantity') return it.quantity.trim() !== '' && it.quantity.trim() !== '1';
    if (isCustomInvoiceColumnKey(key)) return (it.customValues[key] ?? '').trim() !== '';
    return false;
  }).length;
}

export function formValuesToPayload(v: InvoiceFormValues): InvoicePayload {
  const columns = v.columns.map((c) => ({
    key: c.key,
    label: c.label.trim() || getDefaultInvoiceColumnLabel(c.key),
    enabled: c.enabled,
  }));

  const customRowValues = v.items.map((it) => {
    const row: Record<string, string> = {};
    const daysDisplay = it.days.trim();
    const quantityDisplay = it.quantity.trim();
    if (daysDisplay) row[INVOICE_RESERVED_ROW_VALUE_KEYS.daysDisplay] = daysDisplay;
    if (quantityDisplay) row[INVOICE_RESERVED_ROW_VALUE_KEYS.quantityDisplay] = quantityDisplay;

    columns.forEach((c) => {
      if (!isCustomInvoiceColumnKey(c.key)) return;
      const raw = it.customValues[c.key] ?? '';
      const trimmed = raw.trim();
      if (trimmed) row[c.key] = trimmed;
    });
    return row;
  });

  const internalNotes = composeInvoiceInternalNotes(v.internalNotesPlain, {
    version: 1,
    columns,
    customRowValues,
    extraTables: v.extraTables,
  });

  return {
    clientId: v.clientId,
    invoiceDate: v.invoiceDate,
    placeOfSupply: v.placeOfSupply,
    gstApplicable: v.gstApplicable,
    gstRatePercent: v.gstApplicable ? v.gstRatePercent : 0,
    gstNote: v.gstApplicable ? null : v.gstNote,
    notes: v.notes,
    internalNotes,
    items: v.items.map((it) => ({
      description: it.description,
      period: it.period || null,
      rateLabel: it.rateLabel || null,
      ratePaise: it.rateRupees ? rupeesToPaise(clampNonNegativeNumber(it.rateRupees, 0)) : null,
      days: parseFirstIntegerFromText(it.days),
      quantity: parseFirstIntegerFromText(it.quantity) ?? 1,
      amountPaise: rupeesToPaise(clampNonNegativeNumber(it.amountRupees, 0)),
    })),
  };
}

/** One key per intended creation (a visit to New or Copy); reused for every retry from it. */
export function newIdempotencyKey(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === 'function') return `web-${c.randomUUID()}`;
  // Non-secure contexts (e.g. LAN IP during development) lack randomUUID.
  const bytes = new Uint8Array(16);
  if (c?.getRandomValues) c.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return `web-${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}
