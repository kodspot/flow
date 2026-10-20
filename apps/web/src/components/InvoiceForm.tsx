'use client';
import { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Plus, Trash2 } from 'lucide-react';
import { rupeesToPaise, formatINRCompact } from '@kodspot/shared/money';
import {
  getDefaultInvoiceColumnLabel,
  isCustomInvoiceColumnKey,
  newCustomInvoiceColumnKey,
  type InvoiceExtraTableConfig,
  type InvoiceTableColumnConfig,
} from '@kodspot/shared/invoiceTables';
import {
  blankItem,
  clampNonNegativeNumber,
  columnValueCount,
  formValuesToPayload,
  normalizeExtraTables,
  syncItemCustomValues,
  type InvoiceFormItem,
  type InvoiceFormValues,
  type InvoicePayload,
} from '@/lib/invoiceForm';

interface Client {
  id: string;
  name: string;
  company: string | null;
}

interface Props {
  /** Read once on mount; remount (change `key`) to load different values. */
  initial: InvoiceFormValues;
  submitLabel: string;
  submitting: boolean;
  /** Reject to keep the form as-is for a retry; the caller reports the error. */
  onSubmit: (payload: InvoicePayload) => void | Promise<unknown>;
  extraAction?: React.ReactNode;
  title: string;
  notice?: React.ReactNode;
  /** Highlight period descriptions that still match `initial` (used when copying). */
  reviewPeriods?: boolean;
}

const inputCls = 'w-full px-3 py-2 border rounded-md text-base sm:text-sm bg-white';
const labelCls = 'block text-xs font-medium text-slate-600 mb-1';

export function InvoiceForm({
  initial,
  submitLabel,
  submitting,
  onSubmit,
  extraAction,
  title,
  notice,
  reviewPeriods = false,
}: Props) {
  const { data: clientData, isLoading: clientsLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: () => api<{ clients: Client[] }>('/v1/clients'),
  });

  const [v, setV] = useState<InvoiceFormValues>(() => ({
    ...initial,
    items: syncItemCustomValues(initial.items, initial.columns),
    extraTables: normalizeExtraTables(initial.extraTables),
  }));
  const [initialPeriods] = useState(() => initial.items.map((it) => it.period));

  // Synchronous guard: a double tap fires twice before `submitting` re-renders the button.
  const submitLock = useRef(false);
  const [pending, setPending] = useState(false);
  const busy = submitting || pending;

  const customColumns = useMemo(
    () => v.columns.filter((c) => isCustomInvoiceColumnKey(c.key)),
    [v.columns],
  );

  const column = (key: string) => v.columns.find((c) => c.key === key);
  const isShown = (key: string) => column(key)?.enabled ?? false;
  const labelOf = (key: string) => column(key)?.label.trim() || getDefaultInvoiceColumnLabel(key);

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitLock.current || !v.clientId) return;
    submitLock.current = true;
    setPending(true);
    try {
      const normalizedItems = syncItemCustomValues(v.items, v.columns);
      await onSubmit(formValuesToPayload({ ...v, items: normalizedItems }));
    } catch {
      // The caller reports the error; values stay in the form so the user can retry.
    } finally {
      submitLock.current = false;
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold">{title}</h1>
        <div className="flex items-center gap-2">
          {extraAction}
          <button
            type="submit"
            disabled={busy}
            className="shrink-0 px-4 py-2 rounded-md bg-kodspot text-white font-semibold disabled:opacity-50 text-sm"
          >
            {busy ? 'Saving...' : submitLabel}
          </button>
        </div>
      </div>

      {notice}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 bg-white border rounded-xl p-4 sm:p-5">
        <div>
          <label htmlFor="invoice-client" className={labelCls}>Client *</label>
          <select
            id="invoice-client"
            required
            value={v.clientId}
            onChange={(e) => setV((p) => ({ ...p, clientId: e.target.value }))}
            disabled={clientsLoading}
            className="w-full px-3 py-2 border rounded-md text-base sm:text-sm"
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
          <label htmlFor="invoice-date" className={labelCls}>Invoice date *</label>
          <input
            id="invoice-date"
            type="date"
            required
            value={v.invoiceDate}
            onChange={(e) => setV((p) => ({ ...p, invoiceDate: e.target.value }))}
            className="w-full px-3 py-2 border rounded-md text-base sm:text-sm"
          />
        </div>
        <div>
          <label htmlFor="invoice-place" className={labelCls}>Place of supply</label>
          <input
            id="invoice-place"
            value={v.placeOfSupply}
            onChange={(e) => setV((p) => ({ ...p, placeOfSupply: e.target.value }))}
            className="w-full px-3 py-2 border rounded-md text-base sm:text-sm"
          />
        </div>
      </div>

      <div className="bg-white border rounded-xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Line-item Columns</h2>
          <button
            type="button"
            onClick={addCustomColumn}
            className="inline-flex items-center gap-1 py-2 -my-2 text-sm text-kodspot font-semibold"
          >
            <Plus className="size-4" /> Add custom column
          </button>
        </div>

        <div className="space-y-2">
          {v.columns.map((col, idx) => {
            const locked = col.key === 'description' || col.key === 'amount';
            const keptValues = col.enabled ? 0 : columnValueCount(col.key, v.items);
            return (
              <div key={col.key} className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto_auto] gap-2 items-center p-3 border rounded-md bg-slate-50">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Header label</label>
                  <input
                    value={col.label}
                    onChange={(e) => updateColumn(idx, { label: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md text-base sm:text-sm bg-white"
                  />
                  <div className="text-[11px] text-slate-500 mt-1">{col.key}</div>
                  {keptValues > 0 && (
                    <div className="text-xs text-amber-700 mt-1">
                      Hidden on the invoice. {keptValues} item{keptValues === 1 ? '' : 's'} keep
                      {keptValues === 1 ? 's' : ''} a value; tick Visible to see or edit it.
                    </div>
                  )}
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

      <div className="bg-white border rounded-xl p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Items</h2>
          <button
            type="button"
            onClick={() => setV((p) => ({ ...p, items: [...p.items, blankItem()] }))}
            className="inline-flex items-center gap-1 py-2 -my-2 text-sm text-kodspot font-semibold"
          >
            <Plus className="size-4" /> Add item
          </button>
        </div>

        <div className="space-y-3">
          {v.items.map((it, i) => {
            const id = (key: string) => `item-${i}-${key.replace(/[^a-z0-9_-]/gi, '_')}`;
            const periodNeedsReview =
              reviewPeriods && it.period.trim() !== '' && it.period === initialPeriods[i];
            return (
              <div key={i} className="flex flex-col gap-3 p-3 border rounded-lg bg-slate-50">
                <div className="flex items-end gap-2">
                  <div className="flex-1 min-w-0">
                    <label htmlFor={id('description')} className={labelCls}>
                      Item {i + 1}: {labelOf('description')} *
                    </label>
                    <input
                      id={id('description')}
                      required
                      value={it.description}
                      onChange={(e) => setItem(i, { description: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setV((p) => ({ ...p, items: p.items.filter((_, idx) => idx !== i) }))}
                    disabled={v.items.length === 1}
                    aria-label={`Remove item ${i + 1}`}
                    className="shrink-0 p-3 sm:p-2 text-rose-600 hover:bg-rose-100 rounded disabled:opacity-30"
                    title={v.items.length === 1 ? 'At least one item required' : 'Remove item'}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>

                {/* Only columns ticked Visible get inputs; hidden columns keep their values. */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2">
                  {isShown('period') && (
                    <div>
                      <label htmlFor={id('period')} className={labelCls}>{labelOf('period')}</label>
                      <input
                        id={id('period')}
                        placeholder="e.g. 1–31 Oct 2026"
                        value={it.period}
                        onChange={(e) => setItem(i, { period: e.target.value })}
                        aria-describedby={periodNeedsReview ? id('period-review') : undefined}
                        className={`${inputCls} ${periodNeedsReview ? 'border-amber-400 bg-amber-50' : ''}`}
                      />
                      {periodNeedsReview && (
                        <p id={id('period-review')} className="text-xs text-amber-700 mt-1">
                          Copied as-is. Check this period.
                        </p>
                      )}
                    </div>
                  )}
                  {isShown('rateLabel') && (
                    <>
                      <div>
                        <label htmlFor={id('rateLabel')} className={labelCls}>{labelOf('rateLabel')} (as printed)</label>
                        <input
                          id={id('rateLabel')}
                          placeholder="e.g. ₹12,000/month"
                          value={it.rateLabel}
                          onChange={(e) => setItem(i, { rateLabel: e.target.value })}
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label htmlFor={id('rateRupees')} className={labelCls}>{labelOf('rateLabel')} ₹ (if no text)</label>
                        <input
                          id={id('rateRupees')}
                          type="number"
                          min="0"
                          step="0.01"
                          value={it.rateRupees}
                          onChange={(e) => setItem(i, { rateRupees: e.target.value })}
                          className={inputCls}
                        />
                      </div>
                    </>
                  )}
                  {isShown('days') && (
                    <div>
                      <label htmlFor={id('days')} className={labelCls}>{labelOf('days')}</label>
                      <input
                        id={id('days')}
                        type="text"
                        placeholder="e.g. 10 or 10 days"
                        value={it.days}
                        onChange={(e) => setItem(i, { days: e.target.value })}
                        className={inputCls}
                      />
                    </div>
                  )}
                  {isShown('quantity') && (
                    <div>
                      <label htmlFor={id('quantity')} className={labelCls}>{labelOf('quantity')}</label>
                      <input
                        id={id('quantity')}
                        type="text"
                        placeholder="e.g. 10 nos"
                        value={it.quantity}
                        onChange={(e) => setItem(i, { quantity: e.target.value })}
                        className={inputCls}
                      />
                    </div>
                  )}
                  {customColumns.filter((col) => col.enabled).map((col) => (
                    <div key={col.key}>
                      <label htmlFor={id(col.key)} className={labelCls}>{labelOf(col.key)}</label>
                      <input
                        id={id(col.key)}
                        value={it.customValues[col.key] ?? ''}
                        onChange={(e) => setItemCustomValue(i, col.key, e.target.value)}
                        className={inputCls}
                      />
                    </div>
                  ))}
                  <div>
                    <label htmlFor={id('amount')} className={labelCls}>{labelOf('amount')} ₹ *</label>
                    <input
                      id={id('amount')}
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      required
                      value={it.amountRupees}
                      onChange={(e) => setItem(i, { amountRupees: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                </div>
              </div>
            );
          })}
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
                  aria-label="GST rate percent"
                  value={v.gstRatePercent}
                  onChange={(e) =>
                    setV((p) => ({
                      ...p,
                      gstRatePercent: clampNonNegativeNumber(e.target.value, 0),
                    }))
                  }
                  className="w-20 px-2 py-1 border rounded text-base sm:text-xs text-right"
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

      <div className="bg-white border rounded-xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Additional Tables</h2>
          <button
            type="button"
            onClick={addExtraTable}
            className="inline-flex items-center gap-1 py-2 -my-2 text-sm text-kodspot font-semibold"
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
                aria-label="Table title"
                className="flex-1 px-3 py-2 border rounded-md text-base sm:text-sm bg-white"
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
                      aria-label={`Header ${headerIdx + 1}`}
                      className="flex-1 min-w-0 px-3 py-2 border rounded-md text-base sm:text-sm bg-white"
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
                      className="shrink-0 px-3 sm:px-2 rounded-md border text-rose-600 disabled:opacity-30"
                      title="Remove column"
                      aria-label="Remove column"
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
                className="inline-flex items-center gap-1 py-2 sm:py-0 text-xs text-kodspot font-semibold"
              >
                <Plus className="size-3" /> Add header
              </button>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-600">Rows</div>
              {table.rows.map((row, rowIdx) => (
                <div key={`${table.id}-row-${rowIdx}`} className="flex gap-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 flex-1 min-w-0">
                    {table.headers.map((header, colIdx) => (
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
                        aria-label={`Row ${rowIdx + 1}, ${header || `column ${colIdx + 1}`}`}
                        className="px-3 py-2 border rounded-md text-base sm:text-sm bg-white"
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
                    className="shrink-0 px-3 sm:px-2 rounded-md border text-rose-600 hover:bg-rose-50"
                    title="Remove row"
                    aria-label="Remove row"
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
                className="inline-flex items-center gap-1 py-2 sm:py-0 text-xs text-kodspot font-semibold"
              >
                <Plus className="size-3" /> Add row
              </button>
            </div>
          </div>
        ))}
      </div>

      {!v.gstApplicable && (
        <div className="bg-white border rounded-xl p-4 sm:p-5">
          <label htmlFor="invoice-gst-note" className={labelCls}>GST declaration note</label>
          <textarea
            id="invoice-gst-note"
            rows={3}
            value={v.gstNote}
            onChange={(e) => setV((p) => ({ ...p, gstNote: e.target.value }))}
            className="w-full px-3 py-2 border rounded-md text-base sm:text-sm"
          />
        </div>
      )}

      <div className="bg-white border rounded-xl p-4 sm:p-5">
        <label htmlFor="invoice-notes" className={labelCls}>Notes (visible on invoice)</label>
        <textarea
          id="invoice-notes"
          rows={2}
          value={v.notes}
          onChange={(e) => setV((p) => ({ ...p, notes: e.target.value }))}
          className="w-full px-3 py-2 border rounded-md text-base sm:text-sm"
        />
      </div>
    </form>
  );
}
