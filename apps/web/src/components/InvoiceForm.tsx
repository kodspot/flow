'use client';
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Plus, Trash2 } from 'lucide-react';
import { rupeesToPaise, paiseToRupees, formatINRCompact } from '@kodspot/shared/money';
import {
  composeInvoiceInternalNotes,
  defaultInvoiceTableMeta,
  getDefaultInvoiceColumnLabel,
  isCustomInvoiceColumnKey,
  newCustomInvoiceColumnKey,
  parseInvoiceInternalNotes,
  type InvoiceExtraTableConfig,
  type InvoiceTableColumnConfig,
} from '@kodspot/shared/invoiceTables';

interface Client {
  id: string;
  name: string;
  company: string | null;
}

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

function normalizeExtraTables(tables: InvoiceExtraTableConfig[]): InvoiceExtraTableConfig[] {
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

function syncItemCustomValues(
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

function clampNonNegativeNumber(value: string, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}

export function emptyInvoiceForm(): InvoiceFormValues {
  return {
    clientId: '',
    invoiceDate: new Date().toISOString().slice(0, 10),
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
export function invoiceToFormValues(
  inv: {
    clientId: string;
    invoiceDate: number;
    placeOfSupply: string | null;
    gstApplicable: boolean;
    gstRatePercent: number; // basis points x100 in DB
    gstNote: string | null;
    notes: string | null;
    internalNotes?: string | null;
  },
  items: Array<{
    description: string;
    period: string | null;
    rateLabel: string | null;
    ratePaise: number | null;
    days: number | null;
    quantity: number | null;
    amountPaise: number;
  }>,
): InvoiceFormValues {
  const parsed = parseInvoiceInternalNotes(inv.internalNotes);
  const columns = parsed.tableMeta.columns;
  const hydratedItems =
    items.length > 0
      ? items.map((it, idx) => {
          const next = blankItem();
          next.description = it.description;
          next.period = it.period ?? '';
          next.rateLabel = it.rateLabel ?? '';
          next.rateRupees = it.ratePaise != null ? String(paiseToRupees(it.ratePaise)) : '';
          next.days = it.days != null ? String(it.days) : '';
          next.quantity = String(it.quantity ?? 1);
          next.amountRupees = String(paiseToRupees(it.amountPaise));

          columns.forEach((c) => {
            if (isCustomInvoiceColumnKey(c.key)) {
              next.customValues[c.key] = parsed.tableMeta.customRowValues[idx]?.[c.key] ?? '';
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

export function formValuesToPayload(v: InvoiceFormValues): InvoicePayload {
  const columns = v.columns.map((c) => ({
    key: c.key,
    label: c.label.trim() || getDefaultInvoiceColumnLabel(c.key),
    enabled: c.enabled,
  }));

  const customRowValues = v.items.map((it) => {
    const row: Record<string, string> = {};
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
      days: it.days ? clampNonNegativeNumber(it.days, 0) : null,
      quantity: clampNonNegativeNumber(it.quantity, 1),
      amountPaise: rupeesToPaise(clampNonNegativeNumber(it.amountRupees, 0)),
    })),
  };
}

interface Props {
  initial: InvoiceFormValues;
  submitLabel: string;
  submitting: boolean;
  onSubmit: (payload: InvoicePayload) => void;
  extraAction?: React.ReactNode;
  title: string;
}

export function InvoiceForm({ initial, submitLabel, submitting, onSubmit, extraAction, title }: Props) {
  const { data: clientData, isLoading: clientsLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: () => api<{ clients: Client[] }>('/v1/clients'),
  });

  const [v, setV] = useState<InvoiceFormValues>(initial);

  useEffect(() => {
    setV({
      ...initial,
      items: syncItemCustomValues(initial.items, initial.columns),
      extraTables: normalizeExtraTables(initial.extraTables),
    });
  }, [initial]);

  const customColumns = useMemo(
    () => v.columns.filter((c) => isCustomInvoiceColumnKey(c.key)),
    [v.columns],
  );

  const subtotal = v.items.reduce((s, it) => s + (Number(it.amountRupees) || 0), 0);
  const gstAmount = v.gstApplicable ? Math.round(subtotal * v.gstRatePercent) / 100 : 0;
  const total = subtotal + gstAmount;

  function setItem(i: number, patch: Partial<InvoiceFormItem>) {
    setV((prev) => ({
      ...prev,
      items: prev.items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)),
    }));
  }

  function setItemCustomValue(i: number, key: string, value: string) {
    setV((prev) => ({
      ...prev,
      items: prev.items.map((it, idx) =>
        idx === i
          ? { ...it, customValues: { ...it.customValues, [key]: value } }
          : it,
      ),
    }));
  }

  function addCustomColumn() {
    setV((prev) => {
      const key = newCustomInvoiceColumnKey(prev.columns.map((c) => c.key));
      const nextColumns = [...prev.columns, { key, label: 'Custom', enabled: true }];
      return {
        ...prev,
        columns: nextColumns,
        items: prev.items.map((it) => ({
          ...it,
          customValues: { ...it.customValues, [key]: '' },
        })),
      };
    });
  }

  function removeCustomColumn(key: string) {
    setV((prev) => ({
      ...prev,
      columns: prev.columns.filter((c) => c.key !== key),
      items: prev.items.map((it) => {
        const next = { ...it.customValues };
        delete next[key];
        return { ...it, customValues: next };
      }),
    }));
  }

  function updateColumn(index: number, patch: Partial<InvoiceTableColumnConfig>) {
    setV((prev) => ({
      ...prev,
      columns: prev.columns.map((c, idx) => (idx === index ? { ...c, ...patch } : c)),
    }));
  }

  function addExtraTable() {
    setV((prev) => {
      const id = `table_${Date.now()}`;
      return {
        ...prev,
        extraTables: [
          ...prev.extraTables,
          { id, title: 'Additional Table', headers: ['Column 1', 'Column 2'], rows: [['', '']] },
        ],
      };
    });
  }

  function updateExtraTable(
    tableId: string,
    updater: (table: InvoiceExtraTableConfig) => InvoiceExtraTableConfig,
  ) {
    setV((prev) => ({
      ...prev,
      extraTables: prev.extraTables.map((t) => (t.id === tableId ? updater(t) : t)),
    }));
  }

  function removeExtraTable(tableId: string) {
    setV((prev) => ({
      ...prev,
      extraTables: prev.extraTables.filter((t) => t.id !== tableId),
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!v.clientId) return;
    const normalizedItems = syncItemCustomValues(v.items, v.columns);
    onSubmit(formValuesToPayload({ ...v, items: normalizedItems }));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold">{title}</h1>
        <div className="flex items-center gap-2">
          {extraAction}
          <button
            type="submit"
            disabled={submitting}
            className="shrink-0 px-4 py-2 rounded-md bg-kodspot text-white font-semibold disabled:opacity-50 text-sm"
          >
            {submitting ? 'Saving...' : submitLabel}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 bg-white border rounded-xl p-5">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Client *</label>
          <select
            required
            value={v.clientId}
            onChange={(e) => setV((p) => ({ ...p, clientId: e.target.value }))}
            disabled={clientsLoading}
            className="w-full px-3 py-2 border rounded-md text-sm"
          >
            <option value="">{clientsLoading ? 'Loading clients...' : 'Select client...'}</option>
            {clientData?.clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.company ? ` - ${c.company}` : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Invoice date *</label>
          <input
            type="date"
            required
            value={v.invoiceDate}
            onChange={(e) => setV((p) => ({ ...p, invoiceDate: e.target.value }))}
            className="w-full px-3 py-2 border rounded-md text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Place of supply</label>
          <input
            value={v.placeOfSupply}
            onChange={(e) => setV((p) => ({ ...p, placeOfSupply: e.target.value }))}
            className="w-full px-3 py-2 border rounded-md text-sm"
          />
        </div>
      </div>

      <div className="bg-white border rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Line-item Columns</h2>
          <button
            type="button"
            onClick={addCustomColumn}
            className="inline-flex items-center gap-1 text-sm text-kodspot font-semibold"
          >
            <Plus className="size-4" /> Add custom column
          </button>
        </div>

        <div className="space-y-2">
          {v.columns.map((col, idx) => {
            const locked = col.key === 'description' || col.key === 'amount';
            return (
              <div key={col.key} className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2 items-center p-3 border rounded-md bg-slate-50">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Header label</label>
                  <input
                    value={col.label}
                    onChange={(e) => updateColumn(idx, { label: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md text-sm bg-white"
                  />
                  <div className="text-[11px] text-slate-500 mt-1">{col.key}</div>
                </div>
                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={col.enabled}
                    disabled={locked}
                    onChange={(e) => updateColumn(idx, { enabled: e.target.checked || locked })}
                  />
                  Visible
                </label>
                {isCustomInvoiceColumnKey(col.key) ? (
                  <button
                    type="button"
                    onClick={() => removeCustomColumn(col.key)}
                    className="px-3 py-2 rounded-md border text-sm text-rose-600 hover:bg-rose-50"
                  >
                    Remove
                  </button>
                ) : (
                  <span className="text-xs text-slate-500 text-right">Built-in</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white border rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Items</h2>
          <button
            type="button"
            onClick={() => setV((p) => ({ ...p, items: [...p.items, blankItem()] }))}
            className="inline-flex items-center gap-1 text-sm text-kodspot font-semibold"
          >
            <Plus className="size-4" /> Add item
          </button>
        </div>

        <div className="space-y-3">
          {v.items.map((it, i) => (
            <div key={i} className="flex flex-col gap-3 p-3 border rounded-lg bg-slate-50">
              <div className="flex gap-2">
                <input
                  placeholder="Item name / description *"
                  required
                  value={it.description}
                  onChange={(e) => setItem(i, { description: e.target.value })}
                  className="flex-1 px-3 py-2 border rounded-md text-sm bg-white"
                />
                <button
                  type="button"
                  onClick={() => setV((p) => ({ ...p, items: p.items.filter((_, idx) => idx !== i) }))}
                  disabled={v.items.length === 1}
                  className="shrink-0 p-2 text-rose-600 hover:bg-rose-100 rounded disabled:opacity-30"
                  title={v.items.length === 1 ? 'At least one item required' : 'Remove item'}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2">
                <input
                  placeholder="Period"
                  value={it.period}
                  onChange={(e) => setItem(i, { period: e.target.value })}
                  className="px-3 py-2 border rounded-md text-sm bg-white"
                />
                <input
                  placeholder="Rate label"
                  value={it.rateLabel}
                  onChange={(e) => setItem(i, { rateLabel: e.target.value })}
                  className="px-3 py-2 border rounded-md text-sm bg-white"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Rate Rs"
                  value={it.rateRupees}
                  onChange={(e) => setItem(i, { rateRupees: e.target.value })}
                  className="px-3 py-2 border rounded-md text-sm bg-white"
                />
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Days"
                  value={it.days}
                  onChange={(e) => setItem(i, { days: e.target.value })}
                  className="px-3 py-2 border rounded-md text-sm bg-white"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Quantity"
                  value={it.quantity}
                  onChange={(e) => setItem(i, { quantity: e.target.value })}
                  className="px-3 py-2 border rounded-md text-sm bg-white"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Amount Rs *"
                  required
                  value={it.amountRupees}
                  onChange={(e) => setItem(i, { amountRupees: e.target.value })}
                  className="px-3 py-2 border rounded-md text-sm bg-white"
                />
              </div>

              {customColumns.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {customColumns.map((col) => (
                    <input
                      key={col.key}
                      placeholder={col.label || 'Custom value'}
                      value={it.customValues[col.key] ?? ''}
                      onChange={(e) => setItemCustomValue(i, col.key, e.target.value)}
                      className="px-3 py-2 border rounded-md text-sm bg-white"
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-5 flex justify-end">
          <div className="w-full sm:w-80 space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatINRCompact(rupeesToPaise(subtotal))}</span>
            </div>
            <div className="flex justify-between items-center gap-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={v.gstApplicable}
                  onChange={(e) => setV((p) => ({ ...p, gstApplicable: e.target.checked }))}
                />
                GST
              </label>
              {v.gstApplicable && (
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={v.gstRatePercent}
                  onChange={(e) =>
                    setV((p) => ({
                      ...p,
                      gstRatePercent: clampNonNegativeNumber(e.target.value, 0),
                    }))
                  }
                  className="w-20 px-2 py-1 border rounded text-xs text-right"
                />
              )}
              <span>{formatINRCompact(rupeesToPaise(gstAmount))}</span>
            </div>
            <div className="flex justify-between font-bold text-kodspot pt-2 border-t">
              <span>Total</span>
              <span>{formatINRCompact(rupeesToPaise(total))}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Additional Tables</h2>
          <button
            type="button"
            onClick={addExtraTable}
            className="inline-flex items-center gap-1 text-sm text-kodspot font-semibold"
          >
            <Plus className="size-4" /> Add table
          </button>
        </div>

        {v.extraTables.length === 0 && (
          <div className="text-sm text-slate-500 border border-dashed rounded-md p-3">
            Add an extra table for milestones, deliverables, or any custom breakdown.
          </div>
        )}

        {v.extraTables.map((table) => (
          <div key={table.id} className="border rounded-lg p-3 space-y-3 bg-slate-50">
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={table.title}
                onChange={(e) =>
                  updateExtraTable(table.id, (t) => ({
                    ...t,
                    title: e.target.value,
                  }))
                }
                placeholder="Table title"
                className="flex-1 px-3 py-2 border rounded-md text-sm bg-white"
              />
              <button
                type="button"
                onClick={() => removeExtraTable(table.id)}
                className="px-3 py-2 rounded-md border text-sm text-rose-600 hover:bg-rose-50"
              >
                Remove table
              </button>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-600">Headers</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                {table.headers.map((header, headerIdx) => (
                  <div key={`${table.id}-header-${headerIdx}`} className="flex gap-1">
                    <input
                      value={header}
                      onChange={(e) =>
                        updateExtraTable(table.id, (t) => ({
                          ...t,
                          headers: t.headers.map((h, idx) => (idx === headerIdx ? e.target.value : h)),
                        }))
                      }
                      className="flex-1 px-3 py-2 border rounded-md text-sm bg-white"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        updateExtraTable(table.id, (t) => {
                          if (t.headers.length <= 1) return t;
                          const headers = t.headers.filter((_, idx) => idx !== headerIdx);
                          const rows = t.rows.map((row) => row.filter((_, idx) => idx !== headerIdx));
                          return { ...t, headers, rows };
                        })
                      }
                      disabled={table.headers.length <= 1}
                      className="px-2 rounded-md border text-rose-600 disabled:opacity-30"
                      title="Remove column"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() =>
                  updateExtraTable(table.id, (t) => {
                    if (t.headers.length >= 8) return t;
                    const nextHeaders = [...t.headers, `Column ${t.headers.length + 1}`];
                    const rows = t.rows.map((row) => [...row, '']);
                    return { ...t, headers: nextHeaders, rows };
                  })
                }
                className="inline-flex items-center gap-1 text-xs text-kodspot font-semibold"
              >
                <Plus className="size-3" /> Add header
              </button>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-600">Rows</div>
              {table.rows.map((row, rowIdx) => (
                <div key={`${table.id}-row-${rowIdx}`} className="flex gap-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 flex-1">
                    {table.headers.map((_, colIdx) => (
                      <input
                        key={`${table.id}-cell-${rowIdx}-${colIdx}`}
                        value={row[colIdx] ?? ''}
                        onChange={(e) =>
                          updateExtraTable(table.id, (t) => ({
                            ...t,
                            rows: t.rows.map((r, idx) =>
                              idx === rowIdx
                                ? r.map((cell, cellIdx) => (cellIdx === colIdx ? e.target.value : cell))
                                : r,
                            ),
                          }))
                        }
                        className="px-3 py-2 border rounded-md text-sm bg-white"
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      updateExtraTable(table.id, (t) => ({
                        ...t,
                        rows: t.rows.filter((_, idx) => idx !== rowIdx),
                      }))
                    }
                    className="px-2 rounded-md border text-rose-600 hover:bg-rose-50"
                    title="Remove row"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  updateExtraTable(table.id, (t) => ({
                    ...t,
                    rows: [...t.rows, t.headers.map(() => '')],
                  }))
                }
                className="inline-flex items-center gap-1 text-xs text-kodspot font-semibold"
              >
                <Plus className="size-3" /> Add row
              </button>
            </div>
          </div>
        ))}
      </div>

      {!v.gstApplicable && (
        <div className="bg-white border rounded-xl p-5">
          <label className="block text-xs font-medium text-slate-600 mb-1">GST declaration note</label>
          <textarea
            rows={3}
            value={v.gstNote}
            onChange={(e) => setV((p) => ({ ...p, gstNote: e.target.value }))}
            className="w-full px-3 py-2 border rounded-md text-sm"
          />
        </div>
      )}

      <div className="bg-white border rounded-xl p-5">
        <label className="block text-xs font-medium text-slate-600 mb-1">Notes (visible on invoice)</label>
        <textarea
          rows={2}
          value={v.notes}
          onChange={(e) => setV((p) => ({ ...p, notes: e.target.value }))}
          className="w-full px-3 py-2 border rounded-md text-sm"
        />
      </div>
    </form>
  );
}
