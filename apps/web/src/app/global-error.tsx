'use client';
import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('App error:', error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: '40px', color: '#0f172a' }}>
        <div style={{ maxWidth: 480, margin: '60px auto', textAlign: 'center' }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#0b2138' }}>Something went wrong</h1>
          <p style={{ marginTop: 12, color: '#475569' }}>
            We hit an unexpected error. The team has been notified.
          </p>
          {error.digest ? (
            <p style={{ marginTop: 8, fontSize: 12, color: '#94a3b8', fontFamily: 'monospace' }}>
              ref: {error.digest}
            </p>
          ) : null}
          <button
            onClick={reset}
            style={{
              marginTop: 24,
              padding: '10px 20px',
              borderRadius: 6,
              background: '#0b2138',
              color: 'white',
              border: 'none',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
