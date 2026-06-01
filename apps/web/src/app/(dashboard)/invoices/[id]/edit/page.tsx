'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import {
  InvoiceForm,
  invoiceToFormValues,
  emptyInvoiceForm,
  type InvoicePayload,
} from '@/components/InvoiceForm';

interface InvoiceItem {
  id: string;
  description: string;
  period: string | null;
  rateLabel: string | null;
  ratePaise: number | null;
  days: number | null;
  amountPaise: number;
}
interface Invoice {
  invoiceNumber: string;
  status: string;
  clientId: string;
  invoiceDate: number;
  placeOfSupply: string | null;
  gstApplicable: boolean;
  gstRatePercent: number;
  gstNote: string | null;
  notes: string | null;
}

export default function EditInvoicePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => api<{ invoice: Invoice; items: InvoiceItem[] }>(`/v1/invoices/${id}`),
  });

  const m = useMutation({
    mutationFn: (payload: InvoicePayload) =>
      api<{ id: string }>(`/v1/invoices/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      toast.success('Invoice updated');
      qc.invalidateQueries({ queryKey: ['invoice', id] });
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      router.push(`/invoices/${id}`);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (isLoading || !data) {
    return <div className="text-slate-500">Loading invoice…</div>;
  }

  if (data.invoice.status !== 'draft') {
    return (
      <div className="max-w-xl bg-white border rounded-xl p-6 space-y-3">
        <h1 className="text-xl font-bold text-kodspot">{data.invoice.invoiceNumber}</h1>
        <p className="text-sm text-slate-600">
          This invoice has status <b>{data.invoice.status}</b> and can no longer be edited.
          To make changes, first revert it to <b>draft</b> from the invoice page.
        </p>
        <Link
          href={`/invoices/${id}`}
          className="inline-block text-sm font-semibold text-kodspot hover:underline"
        >
          ← Back to invoice
        </Link>
      </div>
    );
  }

  const initial = data ? invoiceToFormValues(data.invoice, data.items) : emptyInvoiceForm();

  return (
    <InvoiceForm
      title={`Edit ${data.invoice.invoiceNumber}`}
      initial={initial}
      submitLabel="Save changes"
      submitting={m.isPending}
      extraAction={
        <Link
          href={`/invoices/${id}`}
          className="px-3 py-2 rounded-md border text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </Link>
      }
      onSubmit={(payload) => {
        if (!payload.clientId) return toast.error('Select a client');
        m.mutate(payload);
      }}
    />
  );
}
