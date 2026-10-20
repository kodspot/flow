'use client';
import { useEffect } from 'react';
import { useBodyScrollLock } from '@/lib/useBodyScrollLock';

interface Props {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'default';
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  busy = false,
  onConfirm,
  onCancel,
}: Props) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onCancel();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel]);

  useBodyScrollLock(open);

  if (!open) return null;

  const confirmCls =
    variant === 'danger'
      ? 'bg-rose-600 hover:bg-rose-700 text-white'
      : 'bg-kodspot hover:bg-kodspot-accent text-white';

  return (
    <div
      className="fixed inset-0 z-50 flex overflow-y-auto overscroll-contain px-[max(1rem,env(safe-area-inset-left))] pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] bg-black/50"
      onClick={() => !busy && onCancel()}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="m-auto bg-white rounded-xl shadow-xl w-full max-w-md p-5 sm:p-6 space-y-4"
      >
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        <div className="text-sm text-slate-600">{message}</div>
        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="px-4 py-2.5 sm:py-2 rounded-md border text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={`px-4 py-2.5 sm:py-2 rounded-md text-sm font-semibold disabled:opacity-50 ${confirmCls}`}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
