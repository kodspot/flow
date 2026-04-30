'use client';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { clearToken, getToken } from '@/lib/api';
import { LayoutDashboard, FileText, Users, Repeat, Settings, LogOut, Wallet } from 'lucide-react';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/invoices', label: 'Invoices', icon: FileText },
  { href: '/clients', label: 'Clients', icon: Users },
  { href: '/recurring', label: 'Recurring', icon: Repeat },
  { href: '/payments', label: 'Payments', icon: Wallet },
  { href: '/settings', label: 'Settings', icon: Settings },
] as const;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!getToken()) router.replace('/login');
  }, [router]);

  return (
    <div className="min-h-screen flex bg-slate-50">
      <aside className="w-60 bg-kodspot text-white flex flex-col">
        <div className="p-5 border-b border-white/10">
          <div className="text-xl font-bold tracking-tight">Kodspot Flow</div>
          <div className="text-[10px] uppercase tracking-widest text-kodspot-mint mt-0.5">
            Operations. Verified.
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition ${
                  active ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            );
          })}
        </nav>
        <button
          onClick={() => { clearToken(); router.push('/login'); }}
          className="m-3 flex items-center gap-2 px-3 py-2 rounded-md text-sm text-white/70 hover:text-white hover:bg-white/5"
        >
          <LogOut className="size-4" /> Sign out
        </button>
      </aside>
      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  );
}
