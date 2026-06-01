import { z } from 'zod';

export const INVOICE_META_MARKER = '[[FLOW_META_V1]]';

export const INVOICE_BUILTIN_COLUMN_KEYS = [
  'sno',
  'description',
  'period',
  'rateLabel',
  'days',
  'quantity',
  'amount',
] as const;

export type InvoiceBuiltinColumnKey = (typeof INVOICE_BUILTIN_COLUMN_KEYS)[number];

export interface InvoiceTableColumnConfig {
  key: string;
  label: string;
  enabled: boolean;
}

export interface InvoiceExtraTableConfig {
  id: string;
  title: string;
  headers: string[];
  rows: string[][];
}

export interface InvoiceTableMeta {
  version: 1;
  columns: InvoiceTableColumnConfig[];
  customRowValues: Array<Record<string, string>>;
  extraTables: InvoiceExtraTableConfig[];
}

const BUILTIN_LABELS: Record<InvoiceBuiltinColumnKey, string> = {
  sno: 'S.No',
  description: 'Item Name',
  period: 'Period',
  rateLabel: 'Rate',
  days: 'Days',
  quantity: 'Quantity',
  amount: 'Amount',
};

const columnKeySchema = z
  .string()
  .regex(/^(sno|description|period|rateLabel|days|quantity|amount|custom:[a-z0-9_-]{1,24})$/);

const invoiceTableColumnSchema = z.object({
  key: columnKeySchema,
  label: z.string().min(1).max(40),
  enabled: z.boolean().default(true),
});

const invoiceExtraTableSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9_-]{1,32}$/),
    title: z.string().min(1).max(60),
    headers: z.array(z.string().min(1).max(30)).min(1).max(8),
    rows: z.array(z.array(z.string().max(200)).max(8)).max(60),
  })
  .superRefine((table, ctx) => {
    table.rows.forEach((row, idx) => {
      if (row.length !== table.headers.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Row ${idx + 1} must have exactly ${table.headers.length} cells`,
          path: ['rows', idx],
        });
      }
    });
  });

const invoiceTableMetaSchema = z.object({
  version: z.literal(1).default(1),
  columns: z.array(invoiceTableColumnSchema).min(1).max(8),
  customRowValues: z.array(z.record(z.string().max(200))).max(400).default([]),
  extraTables: z.array(invoiceExtraTableSchema).max(4).default([]),
});

export function isCustomInvoiceColumnKey(key: string): key is `custom:${string}` {
  return key.startsWith('custom:');
}

export function getDefaultInvoiceColumnLabel(key: string): string {
  if ((INVOICE_BUILTIN_COLUMN_KEYS as readonly string[]).includes(key)) {
    return BUILTIN_LABELS[key as InvoiceBuiltinColumnKey];
  }
  return 'Custom';
}

export function defaultInvoiceTableColumns(): InvoiceTableColumnConfig[] {
  return [
    { key: 'sno', label: BUILTIN_LABELS.sno, enabled: true },
    { key: 'description', label: BUILTIN_LABELS.description, enabled: true },
    { key: 'period', label: BUILTIN_LABELS.period, enabled: true },
    { key: 'rateLabel', label: BUILTIN_LABELS.rateLabel, enabled: true },
    { key: 'days', label: BUILTIN_LABELS.days, enabled: true },
    { key: 'quantity', label: BUILTIN_LABELS.quantity, enabled: true },
    { key: 'amount', label: BUILTIN_LABELS.amount, enabled: true },
  ];
}

export function defaultInvoiceTableMeta(): InvoiceTableMeta {
  return {
    version: 1,
    columns: defaultInvoiceTableColumns(),
    customRowValues: [],
    extraTables: [],
  };
}

function normalizeColumns(input: InvoiceTableColumnConfig[]): InvoiceTableColumnConfig[] {
  const out: InvoiceTableColumnConfig[] = [];
  const seen = new Set<string>();

  for (const c of input) {
    const key = c.key.trim();
    const parsedKey = columnKeySchema.safeParse(key);
    if (!parsedKey.success || seen.has(key)) continue;
    seen.add(key);

    out.push({
      key,
      label: c.label.trim() || getDefaultInvoiceColumnLabel(key),
      enabled: Boolean(c.enabled),
    });
  }

  // Ensure invoice stays usable even if a malformed payload disables essentials.
  const essentials: InvoiceBuiltinColumnKey[] = ['description', 'amount'];
  for (const key of essentials) {
    const idx = out.findIndex((c) => c.key === key);
    if (idx === -1) {
      out.push({ key, label: BUILTIN_LABELS[key], enabled: true });
    } else {
      const prev = out[idx]!;
      out[idx] = { key: prev.key, label: prev.label, enabled: true };
    }
  }

  if (out.length === 0) return defaultInvoiceTableColumns();

  if (out.length > 8) {
    const essentialsSet = new Set<string>(essentials);
    const keptEssentials = out.filter((c) => essentialsSet.has(c.key));
    const others = out.filter((c) => !essentialsSet.has(c.key)).slice(0, 8 - keptEssentials.length);
    return [...keptEssentials, ...others];
  }

  return out;
}

export function sanitizeInvoiceTableMeta(input: unknown): InvoiceTableMeta {
  const parsed = invoiceTableMetaSchema.safeParse(input);
  if (!parsed.success) return defaultInvoiceTableMeta();

  const columns = normalizeColumns(parsed.data.columns);
  const customKeys = new Set(columns.filter((c) => isCustomInvoiceColumnKey(c.key)).map((c) => c.key));

  const customRowValues = parsed.data.customRowValues.slice(0, 400).map((row) => {
    const next: Record<string, string> = {};
    for (const [k, v] of Object.entries(row)) {
      if (!customKeys.has(k)) continue;
      next[k] = String(v).slice(0, 200);
    }
    return next;
  });

  const extraTables = parsed.data.extraTables.map((t) => ({
    id: t.id,
    title: t.title.trim(),
    headers: t.headers.map((h) => h.trim()).filter(Boolean),
    rows: t.rows.map((r) => r.map((c) => c.trim())),
  }));

  return {
    version: 1,
    columns,
    customRowValues,
    extraTables,
  };
}

export interface ParsedInvoiceInternalNotes {
  plainText: string | null;
  tableMeta: InvoiceTableMeta;
}

export function parseInvoiceInternalNotes(raw: string | null | undefined): ParsedInvoiceInternalNotes {
  if (!raw || raw.trim().length === 0) {
    return { plainText: null, tableMeta: defaultInvoiceTableMeta() };
  }

  const idx = raw.indexOf(INVOICE_META_MARKER);
  if (idx < 0) {
    return { plainText: raw.trim(), tableMeta: defaultInvoiceTableMeta() };
  }

  const plainText = raw.slice(0, idx).trim() || null;
  const jsonPart = raw.slice(idx + INVOICE_META_MARKER.length).trim();
  if (!jsonPart) {
    return { plainText, tableMeta: defaultInvoiceTableMeta() };
  }

  try {
    const parsed = JSON.parse(jsonPart) as unknown;
    return { plainText, tableMeta: sanitizeInvoiceTableMeta(parsed) };
  } catch {
    return { plainText, tableMeta: defaultInvoiceTableMeta() };
  }
}

export function composeInvoiceInternalNotes(
  plainText: string | null | undefined,
  tableMeta: unknown,
): string {
  const safeMeta = sanitizeInvoiceTableMeta(tableMeta);
  const prefix = plainText?.trim();
  const encoded = `${INVOICE_META_MARKER}${JSON.stringify(safeMeta)}`;
  return prefix ? `${prefix}\n\n${encoded}` : encoded;
}

export function newCustomInvoiceColumnKey(existingKeys: string[]): `custom:${string}` {
  const taken = new Set(existingKeys);
  let i = 1;
  while (taken.has(`custom:col_${i}`)) i += 1;
  return `custom:col_${i}`;
}
