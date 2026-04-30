'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatINRCompact } from '@kodspot/shared/money';
import Link from 'next/link';
import { Plus } from 'lucide-react';

interface Stats {
  total: { count: number; amount: number };
  draft: { count: number; amount: number };
  sent: { count: number; amount: number };
  paid: { count: number; amount: number };
  overdue: { count: number; amount: number };
  cancelled: { count: number; amount: number };
}

export default function DashboardPage() {
  const { data } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api<{ stats: Stats }>('/v1/invoices/dashboard'),
  });
  const s = data?.stats;

  const cards = [
    { label: 'Total invoiced', count: s?.total.count ?? 0, amount: s?.total.amount ?? 0, color: 'bg-kodspot text-white' },
    { label: 'Paid', count: s?.paid.count ?? 0, amount: s?.paid.amount ?? 0, color: 'bg-emerald-50 text-emerald-700' },
    { label: 'Pending', count: (s?.sent.count ?? 0) + (s?.draft.count ?? 0), amount: (s?.sent.amount ?? 0) + (s?.draft.amount ?? 0), color: 'bg-amber-50 text-amber-700' },
    { label: 'Overdue', count: s?.overdue.count ?? 0, amount: s?.overdue.amount ?? 0, color: 'bg-rose-50 text-rose-700' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-slate-500">Live overview of your invoicing.</p>
        </div>
        <Link href="/invoices/new" className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-kodspot text-white font-semibold hover:bg-kodspot-accent">
          <Plus className="size-4" /> New invoice
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className={`p-5 rounded-xl border ${c.color}`}>
            <div className="text-xs uppercase tracking-wide opacity-80">{c.label}</div>
            <div className="text-2xl font-bold mt-2">{formatINRCompact(c.amount)}</div>
            <div className="text-xs mt-1 opacity-80">{c.count} invoice{c.count === 1 ? '' : 's'}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border p-6">
        <h2 className="text-lg font-semibold mb-1">Welcome 👋</h2>
        <p className="text-sm text-slate-500">
          Add a client → create your first invoice → download PDF. Your invoices follow the
          KOD/INV/{new Date().getFullYear()}/NNN format automatically.
        </p>
      </div>
    </div>
  );
}
