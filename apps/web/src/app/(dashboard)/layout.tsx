'use client';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, clearToken, getToken } from '@/lib/api';
import {
  LayoutDashboard,
  FileText,
  Users,
  Repeat,
  Settings,
  LogOut,
  Wallet,
  ChevronUp,
} from 'lucide-react';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/invoices', label: 'Invoices', icon: FileText },
  { href: '/clients', label: 'Clients', icon: Users },
  { href: '/recurring', label: 'Recurring', icon: Repeat },
  { href: '/payments', label: 'Payments', icon: Wallet },
  { href: '/settings', label: 'Settings', icon: Settings },
] as const;

interface MeResponse {
  user: { id: string; name: string; email: string; role: string; lastLoginAt: number | null };
  workspace: { id: string; name: string; plan: string };
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
    } else {
      setAuthed(true);
    }
  }, [router]);

  const { data } = useQuery({
    queryKey: ['me'],
    queryFn: () => api<MeResponse>('/v1/auth/me'),
    enabled: authed,
    staleTime: 60_000,
    retry: false,
  });

  // If /me ever 401s (stale token), kick to login
  useEffect(() => {
    if (data === undefined) return;
  }, [data]);

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
        <ProfileMenu
          name={data?.user.name ?? 'Loading…'}
          email={data?.user.email ?? ''}
          workspaceName={data?.workspace.name ?? ''}
          plan={data?.workspace.plan ?? ''}
          onSignOut={() => { clearToken(); router.push('/login'); }}
        />
      </aside>
      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  );
}

function ProfileMenu({
  name,
  email,
  workspaceName,
  plan,
  onSignOut,
}: {
  name: string;
  email: string;
  workspaceName: string;
  plan: string;
  onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || '·';

  return (
    <div className="relative m-3 border-t border-white/10 pt-3">
      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-2 bg-white text-slate-800 rounded-md shadow-lg p-3 text-sm">
          <div className="font-semibold">{name}</div>
          <div className="text-xs text-slate-500 break-all">{email}</div>
          {workspaceName && (
            <div className="mt-2 text-xs">
              <span className="font-medium">Workspace:</span> {workspaceName}
              {plan && <span className="ml-1 text-slate-400">({plan})</span>}
            </div>
          )}
          <button
            onClick={onSignOut}
            className="mt-3 w-full inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-md bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700"
          >
            <LogOut className="size-3.5" /> Sign out
          </button>
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-2 py-2 rounded-md hover:bg-white/5 transition"
      >
        <div className="w-8 h-8 rounded-full bg-kodspot-mint text-kodspot font-bold text-xs flex items-center justify-center shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <div className="text-sm font-medium truncate">{name}</div>
          <div className="text-[10px] text-white/60 truncate">{email}</div>
        </div>
        <ChevronUp
          className={`size-4 text-white/60 transition-transform ${open ? '' : 'rotate-180'}`}
        />
      </button>
    </div>
  );
}
