'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, fetchAssetBlobUrl } from '@/lib/api';
import { formatINRCompact } from '@kodspot/shared/money';
import { toast } from 'sonner';
import {
  Download,
  Eye,
  Pencil,
  Trash2,
  Undo2,
  Send,
  CheckCircle2,
  Ban,
} from 'lucide-react';
import { ConfirmDialog } from '@/components/ConfirmDialog';

interface InvoiceItem {
  id: string;
  description: string;
  period: string | null;
  rateLabel: string | null;
  days: number | null;
  amountPaise: number;
}
interface Invoice {
  invoiceNumber: string;
  invoiceDate: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  subtotalPaise: number;
  totalPaise: number;
  pdfR2Key: string | null;
}

const STATUS_COLOR: Record<Invoice['status'], string> = {
  draft: 'bg-slate-100 text-slate-700',
  sent: 'bg-blue-100 text-blue-700',
  paid: 'bg-emerald-100 text-emerald-700',
  overdue: 'bg-rose-100 text-rose-700',
  cancelled: 'bg-slate-100 text-slate-500',
};

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => api<{ invoice: Invoice; items: InvoiceItem[] }>(`/v1/invoices/${id}`),
  });

  const setStatus = useMutation({
    mutationFn: (status: Invoice['status']) =>
      api(`/v1/invoices/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoice', id] });
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const del = useMutation({
    mutationFn: () => api(`/v1/invoices/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Invoice deleted');
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      router.push('/invoices');
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const generatePdf = useMutation({
    mutationFn: () => api<{ pdfKey: string }>(`/v1/invoices/${id}/pdf`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoice', id] }),
    onError: (e) => toast.error((e as Error).message),
  });

  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  async function openPreview() {
    setPreviewBusy(true);
    try {
      const url = await fetchAssetBlobUrl(`/v1/invoices/${id}/preview`);
      setPreviewBlobUrl(url);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPreviewBusy(false);
    }
  }

  async function downloadPdf() {
    try {
      toast.message('Generating fresh PDF…');
      await api(`/v1/invoices/${id}/pdf`, { method: 'POST' });
      const url = await fetchAssetBlobUrl(`/v1/invoices/${id}/pdf/download`);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${data?.invoice.invoiceNumber.replace(/\//g, '-') ?? 'invoice'}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      qc.invalidateQueries({ queryKey: ['invoice', id] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  useEffect(() => () => { if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl); }, [previewBlobUrl]);

  if (isLoading || !data) return <div className="text-slate-500">Loading…</div>;
  const { invoice, items } = data;
  const isDraft = invoice.status === 'draft';
  const isSentOrOverdue = invoice.status === 'sent' || invoice.status === 'overdue';

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-mono text-kodspot">{invoice.invoiceNumber}</h1>
          <p className="text-sm text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
            <span>{new Date(invoice.invoiceDate).toLocaleDateString('en-IN')}</span>
            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${STATUS_COLOR[invoice.status]}`}>
              {invoice.status}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isDraft && (
            <Link
              href={`/invoices/${id}/edit`}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md border text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Pencil className="size-4" /> Edit
            </Link>
          )}
          <button
            onClick={openPreview}
            disabled={previewBusy}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md border text-sm font-semibold disabled:opacity-50"
          >
            <Eye className="size-4" /> {previewBusy ? 'Opening…' : 'Preview'}
          </button>
          <button
            onClick={downloadPdf}
            disabled={generatePdf.isPending}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-kodspot text-white text-sm font-semibold disabled:opacity-50"
          >
            <Download className="size-4" /> Download PDF
          </button>
          {isDraft && (
            <button
              onClick={() => setStatus.mutate('sent')}
              disabled={setStatus.isPending}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-blue-600 text-white text-sm font-semibold disabled:opacity-50"
            >
              <Send className="size-4" /> Mark sent
            </button>
          )}
          {isSentOrOverdue && (
            <button
              onClick={() => setStatus.mutate('paid')}
              disabled={setStatus.isPending}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50"
            >
              <CheckCircle2 className="size-4" /> Mark paid
            </button>
          )}
          {!isDraft && invoice.status !== 'cancelled' && invoice.status !== 'paid' && (
            <button
              onClick={() => setStatus.mutate('draft')}
              disabled={setStatus.isPending}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md border text-sm font-semibold text-slate-700 hover:bg-slate-50"
              title="Revert to draft to edit"
            >
              <Undo2 className="size-4" /> Revert to draft
            </button>
          )}
          {!isDraft && invoice.status !== 'cancelled' && (
            <button
              onClick={() => setConfirmCancel(true)}
              disabled={setStatus.isPending}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md border text-sm font-semibold text-rose-600 hover:bg-rose-50"
            >
              <Ban className="size-4" /> Cancel
            </button>
          )}
          {isDraft && (
            <button
              onClick={() => setConfirmDelete(true)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md border text-sm font-semibold text-rose-600 hover:bg-rose-50"
            >
              <Trash2 className="size-4" /> Delete
            </button>
          )}
        </div>
      </div>

      <div className="bg-white border rounded-xl p-4 sm:p-6">
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <div className="text-xs uppercase text-slate-500">Subtotal</div>
            <div className="text-xl font-bold">{formatINRCompact(invoice.subtotalPaise)}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-slate-500">Total</div>
            <div className="text-xl font-bold text-kodspot">{formatINRCompact(invoice.totalPaise)}</div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[480px]">
            <thead className="bg-slate-50 text-xs uppercase">
              <tr>
                <th className="px-3 py-2 text-left">Description</th>
                <th className="px-3 py-2">Period</th>
                <th className="px-3 py-2">Rate</th>
                <th className="px-3 py-2">Days</th>
                <th className="px-3 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-t">
                  <td className="px-3 py-2">{it.description}</td>
                  <td className="px-3 py-2 text-center">{it.period ?? '—'}</td>
                  <td className="px-3 py-2 text-center">{it.rateLabel ?? '—'}</td>
                  <td className="px-3 py-2 text-center">{it.days ?? '—'}</td>
                  <td className="px-3 py-2 text-right">{formatINRCompact(it.amountPaise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this invoice?"
        message={
          <>
            Invoice <b className="font-mono">{invoice.invoiceNumber}</b> will be permanently
            removed. Only drafts can be deleted; sent or paid invoices must be cancelled
            instead to preserve your audit trail.
          </>
        }
        confirmLabel="Delete invoice"
        variant="danger"
        busy={del.isPending}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => del.mutate()}
      />

      <ConfirmDialog
        open={confirmCancel}
        title="Cancel this invoice?"
        message={
          <>
            Cancelling marks <b className="font-mono">{invoice.invoiceNumber}</b> as void.
            It will still appear in your records but will not be counted in pending totals.
          </>
        }
        confirmLabel="Cancel invoice"
        variant="danger"
        busy={setStatus.isPending}
        onCancel={() => setConfirmCancel(false)}
        onConfirm={() => {
          setStatus.mutate('cancelled');
          setConfirmCancel(false);
        }}
      />
    </div>
  );
}
