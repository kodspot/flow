'use client';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { InvoiceForm } from '@/components/InvoiceForm';
import { CreateConflictNotice } from '@/components/CreateConflictNotice';
import { emptyInvoiceForm, type CompanyInvoiceDefaults } from '@/lib/invoiceForm';
import { useCreateInvoice } from '@/lib/useCreateInvoice';

export default function NewInvoicePage() {
  // Company settings supply the default place of supply, GST note and footer note.
  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: () => api<{ profile: CompanyInvoiceDefaults | null }>('/v1/settings/company'),
  });
  const ready = settings.isSuccess || settings.isError; // fall back to built-ins if it fails
  const initial = useMemo(
    () => (ready ? emptyInvoiceForm(settings.data?.profile ?? {}) : null),
    // Built once when settings first resolve; the form only reads `initial` on mount.
    [ready],
  );
  // One key per visit: repeated taps and retries create at most one invoice.
  const create = useCreateInvoice();

  if (!initial) return <div className="text-slate-500">Loading…</div>;

  return (
    <InvoiceForm
      title="New invoice"
      initial={initial}
      submitLabel="Create invoice"
      submitting={create.pending}
      notice={
        create.conflict && (
          <CreateConflictNotice
            conflict={create.conflict}
            busy={create.pending}
            onCreateSeparate={create.createSeparate}
          />
        )
      }
      onSubmit={(payload) => {
        if (!payload.clientId) return void toast.error('Select a client');
        return create.submit(payload);
      }}
    />
  );
}
