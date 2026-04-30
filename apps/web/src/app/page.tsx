import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 bg-gradient-to-b from-white to-slate-50">
      <div className="max-w-2xl text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-kodspot/10 text-kodspot text-xs font-semibold uppercase tracking-wide mb-6">
          <span className="size-1.5 rounded-full bg-kodspot animate-pulse" />
          Edge-native · Cloudflare Workers
        </div>
        <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-kodspot">
          Kodspot <span className="text-kodspot-mint">Flow</span>
        </h1>
        <p className="mt-4 text-lg text-slate-600">
          Invoicing, recurring billing, reminders & finance — automated end-to-end.
        </p>
        <div className="mt-10 flex gap-4 justify-center">
          <Link
            href="/login"
            className="px-6 py-3 rounded-lg bg-kodspot text-white font-semibold hover:bg-kodspot-accent transition"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="px-6 py-3 rounded-lg border border-kodspot text-kodspot font-semibold hover:bg-kodspot/5 transition"
          >
            Create workspace
          </Link>
        </div>
      </div>
      <footer className="mt-20 text-xs text-slate-400">
        © {new Date().getFullYear()} Kodspot. Operations. Verified.
      </footer>
    </main>
  );
}
