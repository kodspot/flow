'use client';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api';
import { newIdempotencyKey, type InvoicePayload } from '@/lib/invoiceForm';

type Created = { id: string; invoiceNumber: string };

/** The invoice an earlier attempt from this page created, when the API reports a key conflict. */
export function conflictingInvoice(error: unknown): Created | null {
  if (!(error instanceof ApiError) || error.status !== 409) return null;
  const body = error.body as { code?: string; invoice?: Partial<Created> } | null;
  if (body?.code !== 'idempotency_conflict') return null;
  const inv = body.invoice;
  return inv?.id && inv.invoiceNumber ? { id: inv.id, invoiceNumber: inv.invoiceNumber } : null;
}

export interface CreateConflict {
  invoice: Created;
  payload: InvoicePayload;
}

/**
 * Creates an invoice with one idempotency key per page visit. Repeats with the same details
 * (double taps, retries after a lost response) resolve to one invoice. If an earlier attempt
 * was saved and the details have since changed, the API refuses (409) and this exposes it as
 * `conflict` instead of treating the earlier invoice as a save of the new details.
 */
export function useCreateInvoice() {
  const router = useRouter();
  const qc = useQueryClient();
  const [key, setKey] = useState(newIdempotencyKey);
  const [conflict, setConflict] = useState<CreateConflict | null>(null);

  const m = useMutation({
    mutationFn: ({ payload, key }: { payload: InvoicePayload; key: string }) =>
      api<Created>('/v1/invoices', {
        method: 'POST',
        body: JSON.stringify({ ...payload, idempotencyKey: key }),
      }),
    onSuccess: (res) => {
      setConflict(null);
      toast.success(`Created ${res.invoiceNumber}`);
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      router.push(`/invoices/${res.id}`);
    },
    onError: (e, vars) => {
      const existing = conflictingInvoice(e);
      if (existing) {
        setConflict({ invoice: existing, payload: vars.payload });
        toast.warning('Not saved. See the message above the form.');
        return;
      }
      toast.error((e as Error).message);
    },
  });

  return {
    pending: m.isPending,
    conflict,
    /** Submit the form's details with this visit's key. Rejects (form keeps values) on failure. */
    submit: (payload: InvoicePayload) => m.mutateAsync({ payload, key }),
    /** Deliberately create a further invoice from the conflicting details, with a new key. */
    createSeparate: () => {
      if (!conflict) return;
      const next = newIdempotencyKey();
      setKey(next);
      m.mutate({ payload: conflict.payload, key: next });
    },
  };
}
