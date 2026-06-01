'use client';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import {
  InvoiceForm,
  emptyInvoiceForm,
  type InvoicePayload,
} from '@/components/InvoiceForm';

export default function NewInvoicePage() {
  const router = useRouter();
  const m = useMutation({
    mutationFn: (payload: InvoicePayload) =>
      api<{ id: string; invoiceNumber: string }>('/v1/invoices', {
        method: 'POST',
        body: JSON.stringify(payload),
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
      initial={emptyInvoiceForm()}
      submitLabel="Create invoice"
      submitting={m.isPending}
      onSubmit={(payload) => {
        if (!payload.clientId) return toast.error('Select a client');
        m.mutate(payload);
      }}
    />
  );
}
