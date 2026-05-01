import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: 40, textAlign: 'center' }}>
      <div style={{ maxWidth: 480, margin: '60px auto' }}>
        <h1 style={{ fontSize: 64, fontWeight: 800, color: '#0b2138', margin: 0 }}>404</h1>
        <p style={{ fontSize: 18, color: '#475569', marginTop: 8 }}>Page not found</p>
        <Link
          href="/"
          style={{
            display: 'inline-block',
            marginTop: 24,
            padding: '10px 20px',
            borderRadius: 6,
            background: '#0b2138',
            color: 'white',
            textDecoration: 'none',
            fontWeight: 600,
          }}
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
