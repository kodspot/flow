'use client';
import { useState } from 'react';
import { toast } from 'sonner';
import { InvoiceForm } from '@/components/InvoiceForm';
import { CreateConflictNotice } from '@/components/CreateConflictNotice';
import { emptyInvoiceForm } from '@/lib/invoiceForm';
import { useCreateInvoice } from '@/lib/useCreateInvoice';

export default function NewInvoicePage() {
  const [initial] = useState(emptyInvoiceForm);
  // One key per visit: repeated taps and retries create at most one invoice.
  const create = useCreateInvoice();

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
