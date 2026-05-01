'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, setToken } from '@/lib/api';
import { toast } from 'sonner';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api<{ token: string }>('/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setToken(res.token);
      toast.success('Welcome back');
      router.push('/dashboard');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-slate-50">
      <form onSubmit={onSubmit} className="w-full max-w-sm bg-white p-6 sm:p-8 rounded-xl shadow-sm border space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-kodspot">Sign in</h1>
          <p className="text-sm text-slate-500 mt-1">Welcome back to Kodspot Flow</p>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Email</label>
          <input
            type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-kodspot/30"
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Password</label>
            <Link href="/forgot-password" className="text-xs text-kodspot font-semibold hover:underline">
              Forgot password?
            </Link>
          </div>
          <input
            type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-kodspot/30"
          />
        </div>
        <button
          type="submit" disabled={loading}
          className="w-full py-2.5 rounded-md bg-kodspot text-white font-semibold hover:bg-kodspot-accent disabled:opacity-50"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="text-sm text-center text-slate-500">
          New here?{' '}
          <Link href="/signup" className="text-kodspot font-semibold">Create workspace</Link>
        </p>
      </form>
    </main>
  );
}
