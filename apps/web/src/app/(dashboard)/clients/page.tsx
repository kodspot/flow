'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';

interface Client {
  id: string; name: string; company: string | null; email: string | null; phone: string | null;
  city: string | null; state: string | null; gstNumber: string | null;
}

export default function ClientsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data } = useQuery({
    queryKey: ['clients'],
    queryFn: () => api<{ clients: Client[] }>('/v1/clients'),
  });

  const del = useMutation({
    mutationFn: (id: string) => api(`/v1/clients/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients'] }); toast.success('Client deleted'); },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Clients</h1>
        <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-kodspot text-white font-semibold hover:bg-kodspot-accent">
          <Plus className="size-4" /> Add client
        </button>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-3">
        {data?.clients.length === 0 && (
          <div className="text-center text-slate-400 py-12">No clients yet</div>
        )}
        {data?.clients.map((c) => (
          <div key={c.id} className="bg-white border rounded-xl p-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-semibold text-sm truncate">{c.name}</div>
              {c.company && <div className="text-xs text-slate-500 truncate">{c.company}</div>}
              {c.email && <div className="text-xs text-slate-400 truncate mt-0.5">{c.email}</div>}
              {c.city && <div className="text-xs text-slate-400">{c.city}{c.state ? `, ${c.state}` : ''}</div>}
            </div>
            <button onClick={() => del.mutate(c.id)} className="shrink-0 text-rose-500 hover:text-rose-700 p-1.5 rounded hover:bg-rose-50">
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block bg-white border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Company</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">City</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data?.clients.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3 text-slate-600">{c.company ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{c.email ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{c.city ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => del.mutate(c.id)} className="text-rose-600 hover:text-rose-700 p-1">
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {data?.clients.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-400">No clients yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {open && <ClientForm onClose={() => setOpen(false)} />}
    </div>
  );
}

function ClientForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: '', company: '', email: '', phone: '', whatsappPhone: '',
    addressLine1: '', addressLine2: '', city: '', state: '', postalCode: '', country: 'India', gstNumber: '',
  });
  const m = useMutation({
    mutationFn: () => api('/v1/clients', { method: 'POST', body: JSON.stringify(form) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients'] }); toast.success('Client added'); onClose(); },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => { e.preventDefault(); m.mutate(); }}
        className="bg-white rounded-xl p-6 w-full max-w-2xl space-y-4 max-h-[90vh] overflow-auto"
      >
        <h2 className="text-xl font-bold">Add client</h2>
        <div className="grid grid-cols-2 gap-3">
          {(['name', 'company', 'email', 'phone', 'whatsappPhone', 'addressLine1', 'addressLine2', 'city', 'state', 'postalCode', 'country', 'gstNumber'] as const).map((k) => (
            <div key={k} className={k === 'addressLine1' || k === 'addressLine2' ? 'col-span-2' : ''}>
              <label className="block text-xs font-medium text-slate-600 mb-1 capitalize">{k.replace(/([A-Z])/g, ' $1')}</label>
              <input
                value={form[k]}
                onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
                required={k === 'name'}
                className="w-full px-3 py-2 border rounded-md text-sm"
              />
            </div>
          ))}
        </div>
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-md border text-sm">Cancel</button>
          <button type="submit" disabled={m.isPending} className="px-4 py-2 rounded-md bg-kodspot text-white text-sm font-semibold disabled:opacity-50">
            {m.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
}
