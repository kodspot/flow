'use client';
import { useEffect } from 'react';

/** Prevent the page behind an open drawer/modal from scrolling (incl. iOS Safari 16+). */
export function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [locked]);
}
