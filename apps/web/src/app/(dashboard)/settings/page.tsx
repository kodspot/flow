'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { api, fetchAssetBlobUrl } from '@/lib/api';
import { toast } from 'sonner';

type Profile = {
  legalName?: string;
  brandName?: string;
  tagline?: string | null;
  email?: string | null;
  phone?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string;
  gstNumber?: string | null;
  panNumber?: string | null;
  udyamNumber?: string | null;
  bankAccountName?: string | null;
  bankName?: string | null;
  bankBranch?: string | null;
  bankIfsc?: string | null;
  bankAccountNumber?: string | null;
  upiId?: string | null;
  signatoryName?: string | null;
  signatoryDesignation?: string | null;
  invoiceNumberPrefix?: string;
  defaultPlaceOfSupply?: string | null;
  defaultGstNote?: string | null;
  defaultInvoiceNotes?: string | null;
  defaultDueDays?: number;
  logoR2Key?: string | null;
  signatureR2Key?: string | null;
  upiQrR2Key?: string | null;
};

type FieldGroup = {
  title: string;
  fields: Array<{ key: keyof Profile; label: string; type?: 'text' | 'textarea' | 'number' }>;
};

const GROUPS: FieldGroup[] = [
  {
    title: 'Identity',
    fields: [
      { key: 'legalName', label: 'Legal Name' },
      { key: 'brandName', label: 'Brand Name' },
      { key: 'tagline', label: 'Tagline' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
    ],
  },
  {
    title: 'Address',
    fields: [
      { key: 'addressLine1', label: 'Address Line 1' },
      { key: 'addressLine2', label: 'Address Line 2' },
      { key: 'city', label: 'City' },
      { key: 'state', label: 'State' },
      { key: 'postalCode', label: 'Postal Code' },
      { key: 'country', label: 'Country' },
    ],
  },
  {
    title: 'Tax & Registrations',
    fields: [
      { key: 'gstNumber', label: 'GSTIN' },
      { key: 'udyamNumber', label: 'Udyam Number' },
      { key: 'panNumber', label: 'PAN' },
    ],
  },
  {
    title: 'Bank Details',
    fields: [
      { key: 'bankAccountName', label: 'Account Name' },
      { key: 'bankName', label: 'Bank Name' },
      { key: 'bankBranch', label: 'Branch' },
      { key: 'bankIfsc', label: 'IFSC' },
      { key: 'bankAccountNumber', label: 'Account Number' },
      { key: 'upiId', label: 'UPI ID' },
    ],
  },
  {
    title: 'Signatory',
    fields: [
      { key: 'signatoryName', label: 'Signatory Name' },
      { key: 'signatoryDesignation', label: 'Designation' },
    ],
  },
  {
    title: 'Invoice Defaults',
    fields: [
      { key: 'invoiceNumberPrefix', label: 'Invoice Prefix' },
      { key: 'defaultPlaceOfSupply', label: 'Default Place of Supply' },
      { key: 'defaultDueDays', label: 'Default Due Days', type: 'number' },
      { key: 'defaultGstNote', label: 'Default GST Declaration Note', type: 'textarea' },
      { key: 'defaultInvoiceNotes', label: 'Default Invoice Footer Note', type: 'textarea' },
    ],
  },
];

export default function SettingsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api<{ profile: Profile }>('/v1/settings/company'),
  });
  const [form, setForm] = useState<Profile>({});

  useEffect(() => { if (data?.profile) setForm(data.profile); }, [data]);

  const save = useMutation({
    mutationFn: () => api('/v1/settings/company', { method: 'PUT', body: JSON.stringify(form) }),
    onSuccess: () => { toast.success('Saved'); qc.invalidateQueries({ queryKey: ['settings'] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const seed = useMutation({
    mutationFn: () => api<{ ok: boolean; fieldsUpdated: number }>('/v1/settings/seed-kodspot', { method: 'POST' }),
    onSuccess: (res) => {
      toast.success(`Filled ${res.fieldsUpdated} field(s) with KODSPOT defaults`);
      qc.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const setField = <K extends keyof Profile>(k: K, v: Profile[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  if (isLoading) return <div>Loading…</div>;

  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Company settings</h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => seed.mutate()}
            disabled={seed.isPending}
            className="px-4 py-2 rounded-md border border-slate-300 text-sm font-medium disabled:opacity-50"
            title="Fill blank fields with verified KODSPOT defaults"
          >
            {seed.isPending ? 'Filling…' : 'Use KODSPOT defaults'}
          </button>
          <button
            type="submit"
            disabled={save.isPending}
            className="px-5 py-2 rounded-md bg-kodspot text-white font-semibold disabled:opacity-50"
          >
            {save.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <BrandingPanel
        logoKey={data?.profile?.logoR2Key ?? null}
        signatureKey={data?.profile?.signatureR2Key ?? null}
      />

      {GROUPS.map((group) => (
        <fieldset key={group.title} className="bg-white border rounded-xl p-6">
          <legend className="px-2 text-sm font-semibold text-slate-700">{group.title}</legend>
          <div className="grid grid-cols-2 gap-4">
            {group.fields.map(({ key, label, type }) => (
              <div key={String(key)} className={type === 'textarea' ? 'col-span-2' : ''}>
                <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
                {type === 'textarea' ? (
                  <textarea
                    rows={3}
                    value={(form[key] as string) ?? ''}
                    onChange={(e) => setField(key, e.target.value as Profile[typeof key])}
                    className="w-full px-3 py-2 border rounded-md text-sm"
                  />
                ) : type === 'number' ? (
                  <input
                    type="number"
                    value={(form[key] as number) ?? 0}
                    onChange={(e) => setField(key, Number(e.target.value) as Profile[typeof key])}
                    className="w-full px-3 py-2 border rounded-md text-sm"
                  />
                ) : (
                  <input
                    type="text"
                    value={(form[key] as string) ?? ''}
                    onChange={(e) => setField(key, e.target.value as Profile[typeof key])}
                    className="w-full px-3 py-2 border rounded-md text-sm"
                  />
                )}
              </div>
            ))}
          </div>
        </fieldset>
      ))}
    </form>
  );
}

function BrandingPanel({ logoKey, signatureKey }: { logoKey: string | null; signatureKey: string | null }) {
  return (
    <div className="bg-white border rounded-xl p-6 grid grid-cols-2 gap-6">
      <AssetUploader kind="logo" label="Logo" assetKey={logoKey} hint="PNG/SVG, square recommended, max 2 MB" />
      <AssetUploader kind="signature" label="Signature" assetKey={signatureKey} hint="Transparent PNG preferred, max 2 MB" />
    </div>
  );
}

function AssetUploader({
  kind,
  label,
  assetKey,
  hint,
}: {
  kind: 'logo' | 'signature' | 'upi-qr';
  label: string;
  assetKey: string | null;
  hint?: string;
}) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    let createdUrl: string | null = null;
    setPreviewUrl(null);
    if (assetKey) {
      fetchAssetBlobUrl(`/v1/settings/asset?key=${encodeURIComponent(assetKey)}`)
        .then((url) => { if (alive) { setPreviewUrl(url); createdUrl = url; } })
        .catch(() => {});
    }
    return () => {
      alive = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [assetKey]);

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      return api(`/v1/settings/upload/${kind}`, { method: 'POST', body: fd });
    },
    onSuccess: () => {
      toast.success(`${label} uploaded`);
      qc.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const remove = useMutation({
    mutationFn: () => api(`/v1/settings/asset/${kind}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(`${label} removed`);
      qc.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-2">{label}</label>
      <div className="flex items-center gap-4">
        <div className="w-24 h-24 border rounded-md flex items-center justify-center bg-slate-50 overflow-hidden">
          {previewUrl ? (
            <img src={previewUrl} alt={label} className="max-w-full max-h-full object-contain" />
          ) : (
            <span className="text-xs text-slate-400">No {label.toLowerCase()}</span>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload.mutate(f);
              if (inputRef.current) inputRef.current.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={upload.isPending}
            className="px-3 py-1.5 text-xs rounded-md border border-slate-300 hover:bg-slate-50 disabled:opacity-50"
          >
            {upload.isPending ? 'Uploading…' : assetKey ? 'Replace' : 'Upload'}
          </button>
          {assetKey && (
            <button
              type="button"
              onClick={() => remove.mutate()}
              disabled={remove.isPending}
              className="px-3 py-1.5 text-xs rounded-md text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              Remove
            </button>
          )}
          {hint && <span className="text-[10px] text-slate-500">{hint}</span>}
        </div>
      </div>
    </div>
  );
}
