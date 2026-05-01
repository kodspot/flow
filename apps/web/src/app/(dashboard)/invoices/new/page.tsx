'use client';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { rupeesToPaise, formatINRCompact } from '@kodspot/shared/money';

interface Client { id: string; name: string; company: string | null; }

interface ItemRow {
  description: string;
  period: string;
  rateLabel: string;
  rateRupees: string;
  days: string;
  amountRupees: string;
}

const blankItem = (): ItemRow => ({
  description: '',
  period: '',
  rateLabel: '',
  rateRupees: '',
  days: '',
  amountRupees: '',
});

export default function NewInvoicePage() {
  const router = useRouter();
  const { data: clientData } = useQuery({
    queryKey: ['clients'],
    queryFn: () => api<{ clients: Client[] }>('/v1/clients'),
  });

  const [clientId, setClientId] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [placeOfSupply, setPlaceOfSupply] = useState('Karnataka (29)');
  const [gstApplicable, setGstApplicable] = useState(false);
  const [gstRatePercent, setGstRatePercent] = useState(18);
  const [gstNote, setGstNote] = useState(
    'This transaction is exempt from GST under Section 22 of the Central Goods and Services Tax Act, 2017 as the aggregate turnover of KODSPOT is below the prescribed threshold limit of ₹20 lakh. No GST will be charged or collected. HSN Code: 998313 (IT Services).',
  );
  const [notes, setNotes] = useState('Note: Invoice is generated at the end of every month.');
  const [items, setItems] = useState<ItemRow[]>([blankItem()]);

  const subtotal = items.reduce((s, it) => s + (Number(it.amountRupees) || 0), 0);
  const gstAmount = gstApplicable ? Math.round(subtotal * gstRatePercent) / 100 : 0;
  const total = subtotal + gstAmount;

  const m = useMutation({
    mutationFn: async () => {
      const payload = {
        clientId,
        invoiceDate,
        placeOfSupply,
        gstApplicable,
        gstRatePercent: gstApplicable ? gstRatePercent : 0,
        gstNote: gstApplicable ? null : gstNote,
        notes,
        items: items.map((it) => ({
          description: it.description,
          period: it.period || null,
          rateLabel: it.rateLabel || null,
          ratePaise: it.rateRupees ? rupeesToPaise(Number(it.rateRupees)) : null,
          days: it.days ? Number(it.days) : null,
          quantity: 1,
          amountPaise: rupeesToPaise(Number(it.amountRupees) || 0),
        })),
      };
      return api<{ id: string; invoiceNumber: string }>('/v1/invoices', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    onSuccess: (res) => {
      toast.success(`Created ${res.invoiceNumber}`);
      router.push(`/invoices/${res.id}`);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  function setItem(i: number, patch: Partial<ItemRow>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (!clientId) return toast.error('Select a client'); m.mutate(); }}
      className="space-y-6 max-w-5xl"
    >
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold">New invoice</h1>
        <button type="submit" disabled={m.isPending} className="shrink-0 px-4 py-2 rounded-md bg-kodspot text-white font-semibold disabled:opacity-50 text-sm">
          {m.isPending ? 'Creating…' : 'Create invoice'}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 bg-white border rounded-xl p-5">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Client *</label>
          <select required value={clientId} onChange={(e) => setClientId(e.target.value)} className="w-full px-3 py-2 border rounded-md text-sm">
            <option value="">Select client…</option>
            {clientData?.clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}{c.company ? ` — ${c.company}` : ''}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Invoice date *</label>
          <input type="date" required value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className="w-full px-3 py-2 border rounded-md text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Place of supply</label>
          <input value={placeOfSupply} onChange={(e) => setPlaceOfSupply(e.target.value)} className="w-full px-3 py-2 border rounded-md text-sm" />
        </div>
      </div>

      <div className="bg-white border rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Items</h2>
          <button type="button" onClick={() => setItems((p) => [...p, blankItem()])} className="inline-flex items-center gap-1 text-sm text-kodspot font-semibold">
            <Plus className="size-4" /> Add item
          </button>
        </div>
        <div className="space-y-3">
          {items.map((it, i) => (
            <div key={i} className="flex flex-col gap-2 p-3 border rounded-lg bg-slate-50">
              <div className="flex gap-2">
                <input placeholder="Description *" required value={it.description} onChange={(e) => setItem(i, { description: e.target.value })} className="flex-1 px-3 py-2 border rounded-md text-sm bg-white" />
                <button type="button" onClick={() => setItems((p) => p.filter((_, idx) => idx !== i))} className="shrink-0 p-2 text-rose-600 hover:bg-rose-100 rounded">
                  <Trash2 className="size-4" />
                </button>
              </div>
              <input placeholder="Period (e.g. 17 Apr – 30 Apr 2026)" value={it.period} onChange={(e) => setItem(i, { period: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm bg-white" />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <input placeholder="Rate label (e.g. ₹12k/mo)" value={it.rateLabel} onChange={(e) => setItem(i, { rateLabel: e.target.value })} className="col-span-2 sm:col-span-1 px-3 py-2 border rounded-md text-sm bg-white" />
                <input type="number" placeholder="Days" value={it.days} onChange={(e) => setItem(i, { days: e.target.value })} className="px-3 py-2 border rounded-md text-sm bg-white" />
                <input type="number" step="0.01" placeholder="Amount ₹ *" required value={it.amountRupees} onChange={(e) => setItem(i, { amountRupees: e.target.value })} className="px-3 py-2 border rounded-md text-sm bg-white" />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 flex justify-end">
          <div className="w-full sm:w-72 space-y-1 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>{formatINRCompact(rupeesToPaise(subtotal))}</span></div>
            <div className="flex justify-between items-center">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={gstApplicable} onChange={(e) => setGstApplicable(e.target.checked)} /> GST
              </label>
              {gstApplicable && (
                <input type="number" value={gstRatePercent} onChange={(e) => setGstRatePercent(Number(e.target.value))} className="w-16 px-2 py-1 border rounded text-xs text-right" />
              )}
              <span>{formatINRCompact(rupeesToPaise(gstAmount))}</span>
            </div>
            <div className="flex justify-between font-bold text-kodspot pt-2 border-t"><span>Total</span><span>{formatINRCompact(rupeesToPaise(total))}</span></div>
          </div>
        </div>
      </div>

      {!gstApplicable && (
        <div className="bg-white border rounded-xl p-5">
          <label className="block text-xs font-medium text-slate-600 mb-1">GST declaration note</label>
          <textarea rows={3} value={gstNote} onChange={(e) => setGstNote(e.target.value)} className="w-full px-3 py-2 border rounded-md text-sm" />
        </div>
      )}

      <div className="bg-white border rounded-xl p-5">
        <label className="block text-xs font-medium text-slate-600 mb-1">Notes (visible on invoice)</label>
        <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full px-3 py-2 border rounded-md text-sm" />
      </div>
    </form>
  );
}
