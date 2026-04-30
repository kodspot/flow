'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { formatINRCompact } from '@kodspot/shared/money';

interface Invoice {
  id: string; invoiceNumber: string; status: string; totalPaise: number; invoiceDate: number;
  clientId: string;
}

const STATUS_COLOR: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  sent: 'bg-blue-100 text-blue-700',
  paid: 'bg-emerald-100 text-emerald-700',
  overdue: 'bg-rose-100 text-rose-700',
  cancelled: 'bg-slate-100 text-slate-500',
};

export default function InvoicesPage() {
  const { data } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => api<{ invoices: Invoice[] }>('/v1/invoices'),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Invoices</h1>
        <Link href="/invoices/new" className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-kodspot text-white font-semibold hover:bg-kodspot-accent">
          <Plus className="size-4" /> New invoice
        </Link>
      </div>

      <div className="bg-white border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Invoice #</th>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {data?.invoices.map((inv) => (
              <tr key={inv.id} className="border-t hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-kodspot font-semibold">{inv.invoiceNumber}</td>
                <td className="px-4 py-3 text-slate-600">{new Date(inv.invoiceDate).toLocaleDateString('en-IN')}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${STATUS_COLOR[inv.status]}`}>{inv.status}</span>
                </td>
                <td className="px-4 py-3 text-right font-semibold">{formatINRCompact(inv.totalPaise)}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/invoices/${inv.id}`} className="text-kodspot font-semibold hover:underline">Open</Link>
                </td>
              </tr>
            ))}
            {data?.invoices.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-400">No invoices yet — create your first one</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
