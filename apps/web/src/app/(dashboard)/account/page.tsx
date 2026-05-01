'use client';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { UserCircle, KeyRound, ShieldCheck } from 'lucide-react';

interface MeResponse {
  user: { id: string; name: string; email: string; role: string; lastLoginAt: number | null };
  workspace: { id: string; name: string; plan: string };
}

export default function AccountPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => api<MeResponse>('/v1/auth/me'),
    staleTime: 60_000,
  });

  const [name, setName] = useState('');
  useEffect(() => {
    if (data?.user.name) setName(data.user.name);
  }, [data?.user.name]);

  const updateProfile = useMutation({
    mutationFn: () => api('/v1/auth/profile', { method: 'PATCH', body: JSON.stringify({ name }) }),
    onSuccess: () => {
      toast.success('Profile updated');
      qc.invalidateQueries({ queryKey: ['me'] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const changePassword = useMutation({
    mutationFn: () =>
      api('/v1/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      }),
    onSuccess: () => {
      toast.success('Password updated');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    },
    onError: (e) => toast.error((e as Error).message),
  });

  function onSubmitPassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) return toast.error('New password must be at least 8 characters');
    if (newPassword !== confirmPassword) return toast.error('Passwords do not match');
    if (newPassword === currentPassword) return toast.error('New password must be different');
    changePassword.mutate();
  }

  if (isLoading || !data) return <div className="text-slate-500">Loading…</div>;

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-kodspot">My account</h1>
        <p className="text-sm text-slate-500 mt-1">Manage your profile and security settings.</p>
      </div>

      {/* Identity */}
      <section className="bg-white border rounded-xl p-6 space-y-4">
        <header className="flex items-center gap-3">
          <UserCircle className="size-5 text-kodspot" />
          <h2 className="font-semibold text-slate-800">Profile</h2>
        </header>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-slate-700">Display name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-kodspot/30"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              value={data.user.email}
              disabled
              className="mt-1 w-full px-3 py-2 border rounded-md text-sm bg-slate-50 text-slate-500"
            />
            <p className="text-xs text-slate-400 mt-1">
              Email changes are not supported yet — contact support to update.
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Role</label>
            <input
              type="text"
              value={data.user.role}
              disabled
              className="mt-1 w-full px-3 py-2 border rounded-md text-sm bg-slate-50 text-slate-500 capitalize"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Workspace</label>
            <input
              type="text"
              value={`${data.workspace.name} · ${data.workspace.plan}`}
              disabled
              className="mt-1 w-full px-3 py-2 border rounded-md text-sm bg-slate-50 text-slate-500 capitalize"
            />
          </div>
        </div>
        <div className="flex justify-end">
          <button
            onClick={() => updateProfile.mutate()}
            disabled={updateProfile.isPending || !name.trim() || name === data.user.name}
            className="px-4 py-2 rounded-md bg-kodspot text-white text-sm font-semibold hover:bg-kodspot-accent disabled:opacity-50"
          >
            {updateProfile.isPending ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </section>

      {/* Password */}
      <section className="bg-white border rounded-xl p-6 space-y-4">
        <header className="flex items-center gap-3">
          <KeyRound className="size-5 text-kodspot" />
          <h2 className="font-semibold text-slate-800">Change password</h2>
        </header>
        <form onSubmit={onSubmitPassword} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="text-sm font-medium text-slate-700">Current password</label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="mt-1 w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-kodspot/30"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">New password</label>
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="mt-1 w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-kodspot/30"
            />
            <p className="text-xs text-slate-400 mt-1">At least 8 characters.</p>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Confirm new password</label>
            <input
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-kodspot/30"
            />
          </div>
          <div className="md:col-span-2 flex justify-end">
            <button
              type="submit"
              disabled={changePassword.isPending}
              className="px-4 py-2 rounded-md bg-kodspot text-white text-sm font-semibold hover:bg-kodspot-accent disabled:opacity-50"
            >
              {changePassword.isPending ? 'Updating…' : 'Update password'}
            </button>
          </div>
        </form>
      </section>

      {/* Security info */}
      <section className="bg-white border rounded-xl p-6 space-y-3">
        <header className="flex items-center gap-3">
          <ShieldCheck className="size-5 text-kodspot" />
          <h2 className="font-semibold text-slate-800">Security</h2>
        </header>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <dt className="text-slate-500">Last sign-in</dt>
          <dd className="text-slate-800">
            {data.user.lastLoginAt
              ? new Date(data.user.lastLoginAt).toLocaleString('en-IN')
              : '—'}
          </dd>
          <dt className="text-slate-500">Account ID</dt>
          <dd className="text-slate-800 font-mono text-xs">{data.user.id}</dd>
        </dl>
        <p className="text-xs text-slate-400">
          Changing your password does not invalidate existing sessions on other devices. Sign out
          from each device individually if needed.
        </p>
      </section>
    </div>
  );
}
