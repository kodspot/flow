'use client';
import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { InvoiceForm } from '@/components/InvoiceForm';
import { LoadError } from '@/components/LoadError';
import {
  invoiceToFormValues,
  type InvoicePayload,
  type InvoiceSource,
  type InvoiceSourceItem,
} from '@/lib/invoiceForm';

interface Invoice extends InvoiceSource {
  invoiceNumber: string;
  status: string;
}

export default function EditInvoicePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => api<{ invoice: Invoice; items: InvoiceSourceItem[] }>(`/v1/invoices/${id}`),
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

  // Built once per loaded invoice; the form reads it only on mount, so refetches never wipe edits.
  const initial = useMemo(
    () => (data ? invoiceToFormValues(data.invoice, data.items) : null),
    [data],
  );

  if (error && !data) {
    return <LoadError title="Couldn't load this invoice" error={error} onRetry={() => refetch()} />;
  }
  if (isLoading || !data || !initial) {
    return <div className="text-slate-500">Loading invoice…</div>;
  }

  if (data.invoice.status !== 'draft') {
    return (
      <div className="max-w-xl bg-white border rounded-xl p-6 space-y-3">
        <h1 className="text-xl font-bold text-kodspot">{data.invoice.invoiceNumber}</h1>
        <p className="text-sm text-slate-600">
          This invoice has status <b>{data.invoice.status}</b> and can no longer be edited.
          To make changes, first revert it to <b>draft</b> from the invoice page, or create a copy.
        </p>
        <div className="flex flex-wrap gap-4">
          <Link
            href={`/invoices/${id}`}
            className="inline-block text-sm font-semibold text-kodspot hover:underline"
          >
            ← Back to invoice
          </Link>
          <Link
            href={`/invoices/${id}/copy`}
            className="inline-block text-sm font-semibold text-kodspot hover:underline"
          >
            Create a copy
          </Link>
        </div>
      </div>
    );
  }

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
        if (!payload.clientId) return void toast.error('Select a client');
        return m.mutateAsync(payload);
      }}
    />
  );
}
