'use client';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (password !== confirm) {
      toast.error('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await api('/v1/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      });
      toast.success('Password updated. Please sign in.');
      router.push('/login');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4 bg-slate-50">
        <div className="w-full max-w-sm bg-white p-6 sm:p-8 rounded-xl shadow-sm border space-y-3 text-center">
          <h1 className="text-xl font-bold text-kodspot">Invalid link</h1>
          <p className="text-sm text-slate-500">
            This reset link is missing a token. Please request a new one.
          </p>
          <Link
            href="/forgot-password"
            className="inline-block mt-2 text-sm text-kodspot font-semibold hover:underline"
          >
            Request new link
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-slate-50">
      <form onSubmit={onSubmit} className="w-full max-w-sm bg-white p-6 sm:p-8 rounded-xl shadow-sm border space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-kodspot">Reset password</h1>
          <p className="text-sm text-slate-500 mt-1">Choose a strong new password.</p>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">New password</label>
          <input
            type="password"
            required
            minLength={8}
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-kodspot/30"
          />
          <p className="text-xs text-slate-400">At least 8 characters.</p>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Confirm new password</label>
          <input
            type="password"
            required
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-kodspot/30"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded-md bg-kodspot text-white font-semibold hover:bg-kodspot-accent disabled:opacity-50"
        >
          {loading ? 'Updating…' : 'Update password'}
        </button>
        <p className="text-sm text-center text-slate-500">
          <Link href="/login" className="text-kodspot font-semibold">
            Back to sign in
          </Link>
        </p>
      </form>
    </main>
  );
}
