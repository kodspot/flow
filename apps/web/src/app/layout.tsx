import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from './providers';
import { PwaRegister } from './pwa-register';

const SITE_URL = 'https://flow.kodspot.co.in';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Kodspot Flow — Invoice Automation',
    template: '%s · Kodspot Flow',
  },
  description: 'Edge-native invoicing & finance automation for Kodspot.',
  applicationName: 'Kodspot Flow',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Kodspot Flow',
    statusBarStyle: 'black-translucent',
  },
  formatDetection: { telephone: false, email: false, address: false },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-16x16.png', type: 'image/png', sizes: '16x16' },
      { url: '/favicon-32x32.png', type: 'image/png', sizes: '32x32' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
    shortcut: ['/favicon.ico'],
  },
  openGraph: {
    type: 'website',
    siteName: 'Kodspot Flow',
    title: 'Kodspot Flow — Invoice Automation',
    description: 'Edge-native invoicing & finance automation for Kodspot.',
    url: SITE_URL,
    locale: 'en_IN',
    images: [{ url: '/android-chrome-512x512.png', width: 512, height: 512, alt: 'Kodspot Flow' }],
  },
  twitter: {
    card: 'summary',
    title: 'Kodspot Flow',
    description: 'Edge-native invoicing & finance automation for Kodspot.',
    images: ['/android-chrome-512x512.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
  referrer: 'strict-origin-when-cross-origin',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0b2138' },
  ],
  colorScheme: 'light',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
        <PwaRegister />
      </body>
    </html>
  );
}
