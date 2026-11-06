'use client';
import { useEffect } from 'react';

/**
 * Registers the PWA service worker on supported clients. No-op in dev.
 */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    if (window.location.hostname === 'localhost') return;
    const onLoad = () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .catch(() => {
          // ignore — SW is progressive enhancement
        });
    };
    // This effect usually runs after the page has already loaded, when `load` won't fire again.
    if (document.readyState === 'complete') {
      onLoad();
      return;
    }
    window.addEventListener('load', onLoad);
    return () => window.removeEventListener('load', onLoad);
  }, []);
  return null;
}
