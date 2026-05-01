'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, fetchAssetBlobUrl } from '@/lib/api';
import { formatINRCompact } from '@kodspot/shared/money';
import { toast } from 'sonner';
import { Download, FileCheck, Eye } from 'lucide-react';

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
  status: string;
  subtotalPaise: number;
  totalPaise: number;
  pdfR2Key: string | null;
}

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => api<{ invoice: Invoice; items: InvoiceItem[] }>(`/v1/invoices/${id}`),
  });

  const generatePdf = useMutation({
    mutationFn: () => api<{ pdfKey: string }>(`/v1/invoices/${id}/pdf`, { method: 'POST' }),
    onSuccess: () => { toast.success('PDF generated'); qc.invalidateQueries({ queryKey: ['invoice', id] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const markPaid = useMutation({
    mutationFn: () => api(`/v1/invoices/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'paid' }) }),
    onSuccess: () => { toast.success('Marked paid'); qc.invalidateQueries({ queryKey: ['invoice', id] }); },
  });

  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);

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
      // Always regenerate so the download reflects the latest template/data,
      // not a stale cached R2 object from a prior render.
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

  if (isLoading || !data) return <div>Loading…</div>;
  const { invoice, items } = data;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-mono text-kodspot">{invoice.invoiceNumber}</h1>
          <p className="text-sm text-slate-500">
            {new Date(invoice.invoiceDate).toLocaleDateString('en-IN')} · Status: <b>{invoice.status}</b>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={openPreview}
            disabled={previewBusy}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md border text-sm font-semibold disabled:opacity-50"
          >
            <Eye className="size-4" /> {previewBusy ? 'Opening…' : 'Preview HTML'}
          </button>
          <button
            onClick={() => generatePdf.mutate()}
            disabled={generatePdf.isPending}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-kodspot text-white text-sm font-semibold disabled:opacity-50"
          >
            <Download className="size-4" /> {generatePdf.isPending ? 'Generating…' : 'Generate PDF'}
          </button>
          {invoice.pdfR2Key && (
            <button
              onClick={downloadPdf}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-emerald-600 text-white text-sm font-semibold"
            >
              <Download className="size-4" /> Download PDF
            </button>
          )}
          {invoice.status !== 'paid' && (
            <button onClick={() => markPaid.mutate()} className="inline-flex items-center gap-2 px-3 py-2 rounded-md border text-sm font-semibold">
              <FileCheck className="size-4" /> Mark paid
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
              <tr><th className="px-3 py-2 text-left">Description</th><th className="px-3 py-2">Period</th><th className="px-3 py-2">Rate</th><th className="px-3 py-2">Days</th><th className="px-3 py-2 text-right">Amount</th></tr>
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
    </div>
  );
}
