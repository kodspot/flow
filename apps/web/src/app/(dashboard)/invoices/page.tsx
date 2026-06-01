'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import Link from 'next/link';
import { Plus, Search } from 'lucide-react';
import { formatINRCompact } from '@kodspot/shared/money';
import { useMemo, useState } from 'react';

interface Invoice {
  id: string;
  invoiceNumber: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  totalPaise: number;
  invoiceDate: number;
  clientId: string;
}

interface Client {
  id: string;
  name: string;
}

const STATUS_COLOR: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  sent: 'bg-blue-100 text-blue-700',
  paid: 'bg-emerald-100 text-emerald-700',
  overdue: 'bg-rose-100 text-rose-700',
  cancelled: 'bg-slate-100 text-slate-500',
};

const STATUS_FILTERS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function InvoicesPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['invoices', statusFilter],
    queryFn: () =>
      api<{ invoices: Invoice[] }>(
        statusFilter === 'all' ? '/v1/invoices' : `/v1/invoices?status=${statusFilter}`,
      ),
  });

  const { data: clientsData } = useQuery({
    queryKey: ['clients'],
    queryFn: () => api<{ clients: Client[] }>('/v1/clients'),
  });

  const clientNameById = useMemo(() => {
    const m = new Map<string, string>();
    clientsData?.clients.forEach((c) => m.set(c.id, c.name));
    return m;
  }, [clientsData]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data.invoices;
    return data.invoices.filter((inv) => {
      const num = inv.invoiceNumber.toLowerCase();
      const name = (clientNameById.get(inv.clientId) ?? '').toLowerCase();
      return num.includes(q) || name.includes(q);
    });
  }, [data, search, clientNameById]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold">Invoices</h1>
        <Link
          href="/invoices/new"
          className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-md bg-kodspot text-white font-semibold hover:bg-kodspot-accent text-sm self-start sm:self-auto"
        >
          <Plus className="size-4" /> New invoice
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by invoice # or client…"
            className="w-full pl-9 pr-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-kodspot/30"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition ${
                statusFilter === f.value
                  ? 'bg-kodspot text-white border-kodspot'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-md px-4 py-3 text-sm">
          Failed to load invoices: {(error as Error).message}
        </div>
      )}

      {/* Mobile cards */}
      <div className="sm:hidden space-y-3">
        {isLoading && <SkeletonCards />}
        {!isLoading && filtered.length === 0 && (
          <div className="text-center text-slate-400 py-12">
            {data?.invoices.length === 0
              ? 'No invoices yet — create your first one'
              : 'No invoices match your filters'}
          </div>
        )}
        {!isLoading &&
          filtered.map((inv) => (
            <Link
              key={inv.id}
              href={`/invoices/${inv.id}`}
              className="block bg-white border rounded-xl p-4 hover:bg-slate-50"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-mono text-kodspot font-semibold text-sm">{inv.invoiceNumber}</span>
                <span className={`px-2 py-0.5 rounded text-xs font-semibold shrink-0 ${STATUS_COLOR[inv.status]}`}>
                  {inv.status}
                </span>
              </div>
              <div className="text-xs text-slate-500 mt-1 truncate">
                {clientNameById.get(inv.clientId) ?? '—'}
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  {new Date(inv.invoiceDate).toLocaleDateString('en-IN')}
                </span>
                <span className="font-semibold text-sm">{formatINRCompact(inv.totalPaise)}</span>
              </div>
            </Link>
          ))}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block bg-white border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Invoice #</th>
                <th className="px-4 py-3 text-left">Client</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <SkeletonRows />}
              {!isLoading &&
                filtered.map((inv) => (
                  <tr key={inv.id} className="border-t hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-kodspot font-semibold">{inv.invoiceNumber}</td>
                    <td className="px-4 py-3 text-slate-700">{clientNameById.get(inv.clientId) ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {new Date(inv.invoiceDate).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${STATUS_COLOR[inv.status]}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{formatINRCompact(inv.totalPaise)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/invoices/${inv.id}`} className="text-kodspot font-semibold hover:underline">
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                    {data?.invoices.length === 0
                      ? 'No invoices yet — create your first one'
                      : 'No invoices match your filters'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SkeletonCards() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-white border rounded-xl p-4 animate-pulse space-y-2">
          <div className="h-4 w-24 bg-slate-200 rounded" />
          <div className="h-3 w-32 bg-slate-100 rounded" />
          <div className="h-3 w-20 bg-slate-100 rounded" />
        </div>
      ))}
    </>
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i} className="border-t">
          {Array.from({ length: 6 }).map((__, j) => (
            <td key={j} className="px-4 py-3">
              <div className="h-3 bg-slate-100 rounded animate-pulse" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
