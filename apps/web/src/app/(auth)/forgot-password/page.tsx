'use client';
import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api('/v1/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-slate-50">
      <div className="w-full max-w-sm bg-white p-8 rounded-xl shadow-sm border space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-kodspot">Forgot password</h1>
          <p className="text-sm text-slate-500 mt-1">
            We'll email you a secure link to reset it.
          </p>
        </div>

        {sent ? (
          <div className="space-y-4">
            <div className="rounded-md bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-900">
              If an account exists for <b>{email}</b>, a password reset link has been sent. Please
              check your inbox (and spam folder). The link expires in 30 minutes.
            </div>
            <Link
              href="/login"
              className="block text-center text-sm text-kodspot font-semibold hover:underline"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-kodspot/30"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-md bg-kodspot text-white font-semibold hover:bg-kodspot-accent disabled:opacity-50"
            >
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
            <p className="text-sm text-center text-slate-500">
              Remembered it?{' '}
              <Link href="/login" className="text-kodspot font-semibold">
                Sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
