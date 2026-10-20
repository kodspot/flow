'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { Toaster } from 'sonner';

export function Providers({ children }: { children: React.ReactNode }) {
  const [qc] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } }));
  return (
    <QueryClientProvider client={qc}>
      {children}
      <Toaster
        richColors
        position="top-right"
        mobileOffset={{
          top: 'calc(16px + env(safe-area-inset-top, 0px))',
          right: 'calc(16px + env(safe-area-inset-right, 0px))',
          left: 'calc(16px + env(safe-area-inset-left, 0px))',
        }}
      />
    </QueryClientProvider>
  );
}
