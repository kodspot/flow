'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, setToken } from '@/lib/api';
import { toast } from 'sonner';

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '', workspaceName: 'Kodspot' });
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api<{ token: string }>('/v1/auth/signup', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setToken(res.token);
      toast.success('Workspace created');
      router.push('/dashboard');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-slate-50">
      <form onSubmit={onSubmit} className="w-full max-w-sm bg-white p-8 rounded-xl shadow-sm border space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-kodspot">Create workspace</h1>
          <p className="text-sm text-slate-500 mt-1">Start invoicing in 60 seconds</p>
        </div>
        {(['workspaceName', 'name', 'email', 'password'] as const).map((k) => (
          <div key={k} className="space-y-1.5">
            <label className="text-sm font-medium capitalize">{k.replace(/([A-Z])/g, ' $1')}</label>
            <input
              required
              type={k === 'password' ? 'password' : k === 'email' ? 'email' : 'text'}
              value={form[k]}
              onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
              className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-kodspot/30"
            />
          </div>
        ))}
        <button
          type="submit" disabled={loading}
          className="w-full py-2.5 rounded-md bg-kodspot text-white font-semibold hover:bg-kodspot-accent disabled:opacity-50"
        >
          {loading ? 'Creating…' : 'Create workspace'}
        </button>
        <p className="text-sm text-center text-slate-500">
          Already have one?{' '}
          <Link href="/login" className="text-kodspot font-semibold">Sign in</Link>
        </p>
      </form>
    </main>
  );
}
