'use client';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { InvoiceForm } from '@/components/InvoiceForm';
import { LoadError } from '@/components/LoadError';
import { CreateConflictNotice } from '@/components/CreateConflictNotice';
import { useCreateInvoice } from '@/lib/useCreateInvoice';
import {
  invoiceToCopyFormValues,
  type InvoiceSource,
  type InvoiceSourceItem,
} from '@/lib/invoiceForm';

interface Invoice extends InvoiceSource {
  invoiceNumber: string;
  status: string;
}

/**
 * New invoice pre-filled from an existing one. Saving goes through the normal create
 * request, which assigns a new id, the next invoice number and draft status. The source
 * invoice is only read, never written.
 */
export default function CopyInvoicePage() {
  const { id } = useParams<{ id: string }>();
  // One key per visit: repeated taps and retries create one copy; opening Copy again creates another.
  const create = useCreateInvoice();

  const source = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => api<{ invoice: Invoice; items: InvoiceSourceItem[] }>(`/v1/invoices/${id}`),
  });
  const clients = useQuery({
    queryKey: ['clients'],
    queryFn: () => api<{ clients: Array<{ id: string }> }>('/v1/clients'),
  });

  const copy = useMemo(() => {
    if (!source.data || !clients.data) return null;
    const active = new Set(clients.data.clients.map((c) => c.id));
    return invoiceToCopyFormValues(source.data.invoice, source.data.items, active);
  }, [source.data, clients.data]);

  const loadError = (source.error && !source.data) || (clients.error && !clients.data);
  if (loadError) {
    return (
      <LoadError
        title="Couldn't load the invoice to copy"
        error={source.error ?? clients.error}
        onRetry={() => {
          source.refetch();
          clients.refetch();
        }}
      />
    );
  }
  if (!source.data || !copy) return <div className="text-slate-500">Loading invoice…</div>;

  const src = source.data.invoice;

  return (
    <InvoiceForm
      title={`New invoice from ${src.invoiceNumber}`}
      initial={copy.values}
      submitLabel="Create invoice"
      submitting={create.pending}
      reviewPeriods
      notice={
        <>
          {create.conflict && (
            <CreateConflictNotice
              conflict={create.conflict}
              busy={create.pending}
              onCreateSeparate={create.createSeparate}
            />
          )}
          <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 space-y-1">
            <p>
              Copying <b className="font-mono">{src.invoiceNumber}</b> ({src.status}). Nothing is
              saved until you press <b>Create invoice</b>. The original invoice stays unchanged.
            </p>
            <p>
              This creates a separate <b>draft</b>, and a new invoice number is assigned when it is
              saved. It is not sent automatically.
            </p>
            <p>
              The invoice date is set to today. Review it and each item&apos;s period before saving.
            </p>
            {copy.clientMissing && (
              <p className="text-amber-800 font-medium">
                The original customer no longer exists. Choose a customer for this invoice.
              </p>
            )}
          </div>
        </>
      }
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
        return create.submit(payload);
      }}
    />
  );
}
