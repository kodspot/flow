import Link from 'next/link';
import type { CreateConflict } from '@/lib/useCreateInvoice';

/** Shown when an earlier attempt from this page was saved but the details have since changed. */
export function CreateConflictNotice({
  conflict,
  busy,
  onCreateSeparate,
}: {
  conflict: CreateConflict;
  busy: boolean;
  onCreateSeparate: () => void;
}) {
  const { invoice } = conflict;
  return (
    <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 space-y-3">
      <p>
        <b>Your latest changes were not saved.</b> An earlier attempt from this page, whose result
        didn&apos;t reach you, was saved as <b className="font-mono">{invoice.invoiceNumber}</b> with
        the details as they were then.
      </p>
      <p>
        Open it to check it and, while it is a draft, edit it. Only create another invoice if you
        really need a second one.
      </p>
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/invoices/${invoice.id}`}
          className="px-4 py-2.5 sm:py-2 rounded-md bg-kodspot text-white text-sm font-semibold hover:bg-kodspot-accent"
        >
          Open {invoice.invoiceNumber}
        </Link>
        <button
          type="button"
          disabled={busy}
          onClick={onCreateSeparate}
          className="px-4 py-2.5 sm:py-2 rounded-md border border-amber-400 bg-white text-sm font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
        >
          Create another invoice with these details
        </button>
      </div>
    </div>
  );
}
