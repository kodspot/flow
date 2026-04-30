'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export default function SettingsPage() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api<{ profile: any }>('/v1/settings/company'),
  });
  const [form, setForm] = useState<any>({});

  useEffect(() => { if (data?.profile) setForm(data.profile); }, [data]);

  const m = useMutation({
    mutationFn: () => api('/v1/settings/company', { method: 'PUT', body: JSON.stringify(form) }),
    onSuccess: () => { toast.success('Saved'); qc.invalidateQueries({ queryKey: ['settings'] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const fields: Array<[string, string]> = [
    ['legalName', 'Legal Name'], ['brandName', 'Brand Name'], ['tagline', 'Tagline'],
    ['email', 'Email'], ['phone', 'Phone'],
    ['addressLine1', 'Address Line 1'], ['addressLine2', 'Address Line 2'],
    ['city', 'City'], ['state', 'State'], ['postalCode', 'Postal Code'], ['country', 'Country'],
    ['gstNumber', 'GSTIN'], ['udyamNumber', 'Udyam'], ['panNumber', 'PAN'],
    ['bankAccountName', 'Bank Account Name'], ['bankName', 'Bank Name'], ['bankBranch', 'Branch'],
    ['bankIfsc', 'IFSC'], ['bankAccountNumber', 'Account Number'], ['upiId', 'UPI ID'],
    ['signatoryName', 'Signatory Name'], ['signatoryDesignation', 'Designation'],
    ['invoiceNumberPrefix', 'Invoice Prefix'], ['defaultPlaceOfSupply', 'Default Place of Supply'],
  ];

  if (!data) return <div>Loading…</div>;

  return (
    <form onSubmit={(e) => { e.preventDefault(); m.mutate(); }} className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Company settings</h1>
        <button type="submit" disabled={m.isPending} className="px-5 py-2 rounded-md bg-kodspot text-white font-semibold disabled:opacity-50">
          {m.isPending ? 'Saving…' : 'Save'}
        </button>
      </div>
      <div className="bg-white border rounded-xl p-6 grid grid-cols-2 gap-4">
        {fields.map(([k, label]) => (
          <div key={k}>
            <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
            <input
              value={form[k] ?? ''}
              onChange={(e) => setForm((f: any) => ({ ...f, [k]: e.target.value }))}
              className="w-full px-3 py-2 border rounded-md text-sm"
            />
          </div>
        ))}
        <div className="col-span-2">
          <label className="block text-xs font-medium text-slate-600 mb-1">Default GST declaration note</label>
          <textarea
            rows={3}
            value={form.defaultGstNote ?? ''}
            onChange={(e) => setForm((f: any) => ({ ...f, defaultGstNote: e.target.value }))}
            className="w-full px-3 py-2 border rounded-md text-sm"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-slate-600 mb-1">Default invoice notes</label>
          <textarea
            rows={2}
            value={form.defaultInvoiceNotes ?? ''}
            onChange={(e) => setForm((f: any) => ({ ...f, defaultInvoiceNotes: e.target.value }))}
            className="w-full px-3 py-2 border rounded-md text-sm"
          />
        </div>
      </div>
    </form>
  );
}
