'use client';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { InvoiceForm } from '@/components/InvoiceForm';
import { emptyInvoiceForm, newIdempotencyKey, type InvoicePayload } from '@/lib/invoiceForm';

export default function NewInvoicePage() {
  const router = useRouter();
  const [initial] = useState(emptyInvoiceForm);
  // One key per visit: repeated taps and retries create at most one invoice.
  const [idempotencyKey] = useState(newIdempotencyKey);
  const m = useMutation({
    mutationFn: (payload: InvoicePayload) =>
      api<{ id: string; invoiceNumber: string }>('/v1/invoices', {
        method: 'POST',
        body: JSON.stringify({ ...payload, idempotencyKey }),
      }),
    onSuccess: (res) => {
      toast.success(`Created ${res.invoiceNumber}`);
      router.push(`/invoices/${res.id}`);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <InvoiceForm
      title="New invoice"
      initial={initial}
      submitLabel="Create invoice"
      submitting={m.isPending}
      onSubmit={(payload) => {
        if (!payload.clientId) return void toast.error('Select a client');
        return m.mutateAsync(payload);
      }}
    />
  );
}
