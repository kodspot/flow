'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2, Pencil } from 'lucide-react';
import { ConfirmDialog } from '@/components/ConfirmDialog';

interface Client {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  whatsappPhone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  gstNumber: string | null;
}

type ClientFormState = {
  name: string;
  company: string;
  email: string;
  phone: string;
  whatsappPhone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  gstNumber: string;
};

const emptyForm: ClientFormState = {
  name: '',
  company: '',
  email: '',
  phone: '',
  whatsappPhone: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  postalCode: '',
  country: 'India',
  gstNumber: '',
};

function clientToForm(c: Client): ClientFormState {
  return {
    name: c.name ?? '',
    company: c.company ?? '',
    email: c.email ?? '',
    phone: c.phone ?? '',
    whatsappPhone: c.whatsappPhone ?? '',
    addressLine1: c.addressLine1 ?? '',
    addressLine2: c.addressLine2 ?? '',
    city: c.city ?? '',
    state: c.state ?? '',
    postalCode: c.postalCode ?? '',
    country: c.country ?? 'India',
    gstNumber: c.gstNumber ?? '',
  };
}

export default function ClientsPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Client | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: () => api<{ clients: Client[] }>('/v1/clients'),
  });

  const del = useMutation({
    mutationFn: (id: string) => api(`/v1/clients/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Client deleted');
      setDeleteTarget(null);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold">Clients</h1>
        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-md bg-kodspot text-white font-semibold hover:bg-kodspot-accent text-sm"
        >
          <Plus className="size-4" /> Add client
        </button>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-3">
        {isLoading && <div className="text-center text-slate-400 py-12">Loading…</div>}
        {!isLoading && data?.clients.length === 0 && (
          <div className="text-center text-slate-400 py-12">No clients yet</div>
        )}
        {data?.clients.map((c) => (
          <div key={c.id} className="bg-white border rounded-xl p-4 flex items-start justify-between gap-3">
            <button
              onClick={() => setEditing(c)}
              className="min-w-0 flex-1 text-left"
            >
              <div className="font-semibold text-sm truncate">{c.name}</div>
              {c.company && <div className="text-xs text-slate-500 truncate">{c.company}</div>}
              {c.email && <div className="text-xs text-slate-400 truncate mt-0.5">{c.email}</div>}
              {c.city && (
                <div className="text-xs text-slate-400">
                  {c.city}
                  {c.state ? `, ${c.state}` : ''}
                </div>
              )}
            </button>
            <div className="flex flex-col gap-1 shrink-0">
              <button
                onClick={() => setEditing(c)}
                className="text-slate-500 hover:text-kodspot p-1.5 rounded hover:bg-slate-100"
                title="Edit"
              >
                <Pencil className="size-4" />
              </button>
              <button
                onClick={() => setDeleteTarget(c)}
                className="text-rose-500 hover:text-rose-700 p-1.5 rounded hover:bg-rose-50"
                title="Delete"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
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
              {isLoading && (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-400">Loading…</td></tr>
              )}
              {!isLoading && data?.clients.map((c) => (
                <tr key={c.id} className="border-t hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3 text-slate-600">{c.company ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{c.email ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{c.city ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1">
                      <button
                        onClick={() => setEditing(c)}
                        className="text-slate-500 hover:text-kodspot p-1 rounded hover:bg-slate-100"
                        title="Edit"
                      >
                        <Pencil className="size-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(c)}
                        className="text-rose-600 hover:text-rose-700 p-1 rounded hover:bg-rose-50"
                        title="Delete"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && data?.clients.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-400">No clients yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {creating && (
        <ClientFormModal
          mode="create"
          initial={emptyForm}
          onClose={() => setCreating(false)}
        />
      )}

      {editing && (
        <ClientFormModal
          mode="edit"
          clientId={editing.id}
          initial={clientToForm(editing)}
          onClose={() => setEditing(null)}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete this client?"
        message={
          deleteTarget && (
            <>
              <b>{deleteTarget.name}</b> will be removed from your client list.
              Existing invoices for this client will remain intact (they keep a snapshot of the client's
              details at the time of creation).
            </>
          )
        }
        confirmLabel="Delete client"
        variant="danger"
        busy={del.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && del.mutate(deleteTarget.id)}
      />
    </div>
  );
}

function ClientFormModal({
  mode,
  initial,
  clientId,
  onClose,
}: {
  mode: 'create' | 'edit';
  initial: ClientFormState;
  clientId?: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<ClientFormState>(initial);

  const m = useMutation({
    mutationFn: () => {
      // Normalize empty strings to null so zod's optional/email validators don't reject them.
      const payload: Record<string, string | null> = {};
      for (const [k, v] of Object.entries(form)) {
        payload[k] = v.trim() === '' ? null : v.trim();
      }
      // Name is required and must remain a string
      payload.name = form.name.trim();
      return mode === 'create'
        ? api('/v1/clients', { method: 'POST', body: JSON.stringify(payload) })
        : api(`/v1/clients/${clientId}`, { method: 'PATCH', body: JSON.stringify(payload) });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] });
      toast.success(mode === 'create' ? 'Client added' : 'Client updated');
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const fields: Array<{ key: keyof ClientFormState; label: string; full?: boolean }> = [
    { key: 'name', label: 'Name *' },
    { key: 'company', label: 'Company' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'whatsappPhone', label: 'WhatsApp phone' },
    { key: 'gstNumber', label: 'GSTIN' },
    { key: 'addressLine1', label: 'Address line 1', full: true },
    { key: 'addressLine2', label: 'Address line 2', full: true },
    { key: 'city', label: 'City' },
    { key: 'state', label: 'State' },
    { key: 'postalCode', label: 'Postal code' },
    { key: 'country', label: 'Country' },
  ];

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (!form.name.trim()) return toast.error('Name is required');
          m.mutate();
        }}
        className="bg-white rounded-xl p-5 sm:p-6 w-full max-w-2xl space-y-4 max-h-[90vh] overflow-auto shadow-xl"
      >
        <h2 className="text-lg sm:text-xl font-bold">
          {mode === 'create' ? 'Add client' : 'Edit client'}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {fields.map(({ key, label, full }) => (
            <div key={key} className={full ? 'sm:col-span-2' : ''}>
              <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
              <input
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                required={key === 'name'}
                className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-kodspot/30"
              />
            </div>
          ))}
        </div>
        <div className="flex gap-2 justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-md border text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={m.isPending}
            className="px-4 py-2 rounded-md bg-kodspot text-white text-sm font-semibold hover:bg-kodspot-accent disabled:opacity-50"
          >
            {m.isPending ? 'Saving…' : mode === 'create' ? 'Add client' : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
