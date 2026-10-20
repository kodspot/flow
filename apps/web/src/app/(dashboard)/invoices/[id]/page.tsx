'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api, fetchAssetBlobUrl } from '@/lib/api';
import { formatINRCompact } from '@kodspot/shared/money';
import {
  INVOICE_RESERVED_ROW_VALUE_KEYS,
  isCustomInvoiceColumnKey,
  parseInvoiceInternalNotes,
} from '@kodspot/shared/invoiceTables';
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
  Copy,
} from 'lucide-react';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { LoadError } from '@/components/LoadError';

interface InvoiceItem {
  id: string;
  position: number;
  description: string;
  period: string | null;
  rateLabel: string | null;
  ratePaise: number | null;
  days: number | null;
  quantity: number | null;
  amountPaise: number;
}
interface Invoice {
  invoiceNumber: string;
  clientId: string;
  clientSnapshot: string;
  invoiceDate: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  subtotalPaise: number;
  totalPaise: number;
  pdfR2Key: string | null;
  internalNotes: string | null;
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

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => api<{ invoice: Invoice; items: InvoiceItem[] }>(`/v1/invoices/${id}`),
  });

  const { data: clientsData } = useQuery({
    queryKey: ['clients'],
    queryFn: () => api<{ clients: Array<{ id: string; name: string; company: string | null }> }>('/v1/clients'),
  });

  // Current customer record (as the list page shows it); falls back to the copy saved on the invoice.
  const billedTo = useMemo(() => {
    if (!data) return null;
    const live = clientsData?.clients.find((c) => c.id === data.invoice.clientId);
    if (live) return { name: live.name, company: live.company };
    try {
      const snap = JSON.parse(data.invoice.clientSnapshot) as { name?: string; company?: string | null };
      return snap.name ? { name: snap.name, company: snap.company ?? null } : null;
    } catch {
      return null;
    }
  }, [data, clientsData]);

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

  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewLink, setPreviewLink] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const pdfLock = useRef(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  async function openPreview() {
    if (previewBusy) return;
    setPreviewLink(null);
    // Open the tab within the tap itself: Safari blocks tabs opened after an await as pop-ups.
    const win = window.open('', '_blank');
    if (win) {
      try {
        win.opener = null;
        win.document.title = 'Loading invoice preview…';
        if (win.document.body) win.document.body.textContent = 'Loading invoice preview…';
      } catch {
        // Placeholder text only; the preview still loads below.
      }
    }
    setPreviewBusy(true);
    try {
      const url = await fetchAssetBlobUrl(`/v1/invoices/${id}/preview`);
      setPreviewBlobUrl(url);
      if (win && !win.closed) win.location.replace(url);
      // Blocked or closed: stay in the app (a Home Screen app has no Back button) and offer a link.
      else setPreviewLink(url);
    } catch (e) {
      win?.close();
      toast.error((e as Error).message);
    } finally {
      setPreviewBusy(false);
    }
  }

  async function downloadPdf() {
    // Each run regenerates the PDF, so ignore taps while one is in progress.
    if (pdfLock.current) return;
    pdfLock.current = true;
    setPdfBusy(true);
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
    } finally {
      pdfLock.current = false;
      setPdfBusy(false);
    }
  }

  useEffect(() => () => { if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl); }, [previewBlobUrl]);

  if (error && !data) {
    return <LoadError title="Couldn't load this invoice" error={error} onRetry={() => refetch()} />;
  }
  if (isLoading || !data) return <div className="text-slate-500">Loading…</div>;
  const { invoice } = data;
  // Column values in the table metadata are matched to items by position.
  const items = [...data.items].sort((a, b) => a.position - b.position);
  const tableMeta = parseInvoiceInternalNotes(invoice.internalNotes).tableMeta;
  const visibleColumns = tableMeta.columns.filter((c) => c.enabled);
  const showSno = visibleColumns.some((c) => c.key === 'sno');
  const detailColumns = visibleColumns.filter(
    (c) => c.key !== 'sno' && c.key !== 'description' && c.key !== 'amount',
  );
  const isDraft = invoice.status === 'draft';
  const isSentOrOverdue = invoice.status === 'sent' || invoice.status === 'overdue';

  function getCellValue(item: InvoiceItem, rowIndex: number, key: string): string {
    const rowValues = tableMeta.customRowValues[rowIndex] ?? {};
    if (key === 'sno') return String(rowIndex + 1);
    if (key === 'description') return item.description;
    if (key === 'period') return item.period ?? '—';
    // Same fallback as the PDF: the printed rate text, else the rate amount.
    if (key === 'rateLabel') {
      return item.rateLabel ?? (item.ratePaise != null ? formatINRCompact(item.ratePaise) : '—');
    }
    if (key === 'days') {
      return rowValues[INVOICE_RESERVED_ROW_VALUE_KEYS.daysDisplay] ||
        (item.days != null ? String(item.days) : '—');
    }
    if (key === 'quantity') {
      return rowValues[INVOICE_RESERVED_ROW_VALUE_KEYS.quantityDisplay] ||
        String(item.quantity ?? 1);
    }
    if (key === 'amount') return formatINRCompact(item.amountPaise);
    if (isCustomInvoiceColumnKey(key)) {
      return rowValues[key] ?? '—';
    }
    return '—';
  }

  function getCellClass(key: string): string {
    if (key === 'amount') return 'text-right';
    if (key === 'description' || isCustomInvoiceColumnKey(key)) return 'text-left';
    return 'text-center';
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-mono text-kodspot">{invoice.invoiceNumber}</h1>
          {billedTo && (
            <p className="text-sm text-slate-700 mt-1 break-words">
              <span className="text-slate-500">Billed to </span>
              <span className="font-semibold">{billedTo.name}</span>
              {billedTo.company && <span className="text-slate-500"> · {billedTo.company}</span>}
            </p>
          )}
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
            disabled={pdfBusy}
            aria-busy={pdfBusy}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-kodspot text-white text-sm font-semibold disabled:opacity-50"
          >
            <Download className="size-4" /> {pdfBusy ? 'Preparing PDF…' : 'Download PDF'}
          </button>
          <Link
            href={`/invoices/${id}/copy`}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md border text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Copy className="size-4" /> Create a copy
          </Link>
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

      {previewLink && (
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          <span>The preview couldn&apos;t open in a new tab automatically.</span>
          <a
            href={previewLink}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2.5 sm:py-2 rounded-md bg-kodspot text-white font-semibold hover:bg-kodspot-accent"
          >
            Open preview
          </a>
        </div>
      )}

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
        {/* Mobile: stacked items so the amount is always visible */}
        <ul className="sm:hidden border-t divide-y text-sm">
          {items.map((it, rowIndex) => (
            <li key={it.id} className="py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 font-medium break-words">
                  {showSno && <span className="text-slate-400 mr-1.5">{rowIndex + 1}.</span>}
                  {it.description}
                </div>
                <div className="shrink-0 font-semibold">{formatINRCompact(it.amountPaise)}</div>
              </div>
              {detailColumns.length > 0 && (
                <dl className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  {detailColumns.map((col) => (
                    <div key={`${it.id}-${col.key}`} className="min-w-0 break-words">
                      <dt className="inline text-slate-500">{col.label}: </dt>
                      <dd className="inline text-slate-700">{getCellValue(it, rowIndex, col.key)}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </li>
          ))}
        </ul>

        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm min-w-[480px]">
            <thead className="bg-slate-50 text-xs uppercase">
              <tr>
                {visibleColumns.map((col) => (
                  <th key={col.key} className={`px-3 py-2 ${getCellClass(col.key)}`}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((it, rowIndex) => (
                <tr key={it.id} className="border-t">
                  {visibleColumns.map((col) => (
                    <td key={`${it.id}-${col.key}`} className={`px-3 py-2 ${getCellClass(col.key)}`}>
                      {getCellValue(it, rowIndex, col.key)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {tableMeta.extraTables.length > 0 && (
          <div className="space-y-4 mt-6">
            {tableMeta.extraTables.map((table) => (
              <div key={table.id} className="overflow-x-auto">
                <h3 className="text-sm font-semibold text-slate-700 mb-2">{table.title}</h3>
                <table className="w-full text-sm min-w-[420px] border border-slate-200 rounded-lg overflow-hidden">
                  <thead className="bg-slate-50 text-xs uppercase">
                    <tr>
                      {table.headers.map((header, idx) => (
                        <th key={`${table.id}-h-${idx}`} className="px-3 py-2 text-left">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {table.rows.map((row, rowIdx) => (
                      <tr key={`${table.id}-r-${rowIdx}`} className="border-t">
                        {table.headers.map((_, cellIdx) => (
                          <td key={`${table.id}-c-${rowIdx}-${cellIdx}`} className="px-3 py-2">
                            {row[cellIdx] || '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {table.rows.length === 0 && (
                      <tr className="border-t">
                        <td colSpan={table.headers.length} className="px-3 py-3 text-slate-400 text-sm text-center">
                          No rows
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
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
