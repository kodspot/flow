import Link from 'next/link';
import { ApiError } from '@/lib/api';

/** Shown when a page's data fails to load (missing, deleted, other workspace, or offline). */
export function LoadError({
  title,
  error,
  onRetry,
}: {
  title: string;
  error: unknown;
  onRetry?: () => void;
}) {
  const message =
    error instanceof ApiError && error.status === 404
      ? "This invoice doesn't exist or has been deleted."
      : error instanceof Error
        ? error.message
        : 'Something went wrong.';
  return (
    <div role="alert" className="max-w-xl bg-white border rounded-xl p-5 sm:p-6 space-y-3">
      <h1 className="text-lg font-bold text-slate-900">{title}</h1>
      <p className="text-sm text-slate-600">{message}</p>
      <div className="flex flex-wrap gap-2">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="px-4 py-2.5 sm:py-2 rounded-md bg-kodspot text-white text-sm font-semibold hover:bg-kodspot-accent"
          >
            Try again
          </button>
        )}
        <Link
          href="/invoices"
          className="px-4 py-2.5 sm:py-2 rounded-md border text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Back to invoices
        </Link>
      </div>
    </div>
  );
}
