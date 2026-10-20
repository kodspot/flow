'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { Toaster } from 'sonner';
import { ApiError } from '@/lib/api';

export function Providers({ children }: { children: React.ReactNode }) {
  const [qc] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            // 4xx answers (not found, no access) won't change on retry; show them straight away.
            retry: (failureCount, error) =>
              !(error instanceof ApiError && error.status >= 400 && error.status < 500) && failureCount < 3,
          },
        },
      }),
  );
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
