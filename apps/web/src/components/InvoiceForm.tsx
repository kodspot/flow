'use client';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Plus, Trash2 } from 'lucide-react';
import { rupeesToPaise, paiseToRupees, formatINRCompact } from '@kodspot/shared/money';

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
  amountRupees: string;
}

export interface InvoiceFormValues {
  clientId: string;
  invoiceDate: string;
  placeOfSupply: string;
  gstApplicable: boolean;
  gstRatePercent: number;
  gstNote: string;
  notes: string;
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
  amountRupees: '',
});

export const defaultGstNote =
  'This transaction is exempt from GST under Section 22 of the Central Goods and Services Tax Act, 2017 as the aggregate turnover of KODSPOT is below the prescribed threshold limit of ₹20 lakh. No GST will be charged or collected. HSN Code: 998313 (IT Services).';

export const defaultNotes = 'Note: Invoice is generated at the end of every month.';

export function emptyInvoiceForm(): InvoiceFormValues {
  return {
    clientId: '',
    invoiceDate: new Date().toISOString().slice(0, 10),
    placeOfSupply: 'Karnataka (29)',
    gstApplicable: false,
    gstRatePercent: 18,
    gstNote: defaultGstNote,
    notes: defaultNotes,
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
    gstRatePercent: number; // basis points x100 in DB (we store * 100)
    gstNote: string | null;
    notes: string | null;
  },
  items: Array<{
    description: string;
    period: string | null;
    rateLabel: string | null;
    ratePaise: number | null;
    days: number | null;
    amountPaise: number;
  }>,
): InvoiceFormValues {
  return {
    clientId: inv.clientId,
    invoiceDate: new Date(inv.invoiceDate).toISOString().slice(0, 10),
    placeOfSupply: inv.placeOfSupply ?? 'Karnataka (29)',
    gstApplicable: inv.gstApplicable,
    gstRatePercent: inv.gstRatePercent / 100,
    gstNote: inv.gstNote ?? defaultGstNote,
    notes: inv.notes ?? '',
    items:
      items.length > 0
        ? items.map((it) => ({
            description: it.description,
            period: it.period ?? '',
            rateLabel: it.rateLabel ?? '',
            rateRupees: it.ratePaise != null ? String(paiseToRupees(it.ratePaise)) : '',
            days: it.days != null ? String(it.days) : '',
            amountRupees: String(paiseToRupees(it.amountPaise)),
          }))
        : [blankItem()],
  };
}

export function formValuesToPayload(v: InvoiceFormValues): InvoicePayload {
  return {
    clientId: v.clientId,
    invoiceDate: v.invoiceDate,
    placeOfSupply: v.placeOfSupply,
    gstApplicable: v.gstApplicable,
    gstRatePercent: v.gstApplicable ? v.gstRatePercent : 0,
    gstNote: v.gstApplicable ? null : v.gstNote,
    notes: v.notes,
    items: v.items.map((it) => ({
      description: it.description,
      period: it.period || null,
      rateLabel: it.rateLabel || null,
      ratePaise: it.rateRupees ? rupeesToPaise(Number(it.rateRupees)) : null,
      days: it.days ? Number(it.days) : null,
      quantity: 1,
      amountPaise: rupeesToPaise(Number(it.amountRupees) || 0),
    })),
  };
}

interface Props {
  initial: InvoiceFormValues;
  submitLabel: string;
  submitting: boolean;
  onSubmit: (payload: InvoicePayload) => void;
  /** Optional extra action (e.g. Cancel button) shown next to submit. */
  extraAction?: React.ReactNode;
  title: string;
}

export function InvoiceForm({ initial, submitLabel, submitting, onSubmit, extraAction, title }: Props) {
  const { data: clientData, isLoading: clientsLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: () => api<{ clients: Client[] }>('/v1/clients'),
  });

  const [v, setV] = useState<InvoiceFormValues>(initial);
  // Re-seed when initial changes (e.g. edit page loads data after mount)
  useEffect(() => {
    setV(initial);
  }, [initial]);

  const subtotal = v.items.reduce((s, it) => s + (Number(it.amountRupees) || 0), 0);
  const gstAmount = v.gstApplicable ? Math.round(subtotal * v.gstRatePercent) / 100 : 0;
  const total = subtotal + gstAmount;

  function setItem(i: number, patch: Partial<InvoiceFormItem>) {
    setV((prev) => ({
      ...prev,
      items: prev.items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)),
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!v.clientId) return;
    onSubmit(formValuesToPayload(v));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold">{title}</h1>
        <div className="flex items-center gap-2">
          {extraAction}
          <button
            type="submit"
            disabled={submitting}
            className="shrink-0 px-4 py-2 rounded-md bg-kodspot text-white font-semibold disabled:opacity-50 text-sm"
          >
            {submitting ? 'Saving…' : submitLabel}
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
            <option value="">{clientsLoading ? 'Loading clients…' : 'Select client…'}</option>
            {clientData?.clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}{c.company ? ` — ${c.company}` : ''}
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
            <div key={i} className="flex flex-col gap-2 p-3 border rounded-lg bg-slate-50">
              <div className="flex gap-2">
                <input
                  placeholder="Description *"
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
              <input
                placeholder="Period (e.g. 17 Apr – 30 Apr 2026)"
                value={it.period}
                onChange={(e) => setItem(i, { period: e.target.value })}
                className="w-full px-3 py-2 border rounded-md text-sm bg-white"
              />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <input
                  placeholder="Rate label (e.g. ₹12k/mo)"
                  value={it.rateLabel}
                  onChange={(e) => setItem(i, { rateLabel: e.target.value })}
                  className="col-span-2 sm:col-span-1 px-3 py-2 border rounded-md text-sm bg-white"
                />
                <input
                  type="number"
                  placeholder="Days"
                  value={it.days}
                  onChange={(e) => setItem(i, { days: e.target.value })}
                  className="px-3 py-2 border rounded-md text-sm bg-white"
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Amount ₹ *"
                  required
                  value={it.amountRupees}
                  onChange={(e) => setItem(i, { amountRupees: e.target.value })}
                  className="px-3 py-2 border rounded-md text-sm bg-white"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 flex justify-end">
          <div className="w-full sm:w-72 space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatINRCompact(rupeesToPaise(subtotal))}</span>
            </div>
            <div className="flex justify-between items-center">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={v.gstApplicable}
                  onChange={(e) => setV((p) => ({ ...p, gstApplicable: e.target.checked }))}
                />{' '}
                GST
              </label>
              {v.gstApplicable && (
                <input
                  type="number"
                  value={v.gstRatePercent}
                  onChange={(e) => setV((p) => ({ ...p, gstRatePercent: Number(e.target.value) }))}
                  className="w-16 px-2 py-1 border rounded text-xs text-right"
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
