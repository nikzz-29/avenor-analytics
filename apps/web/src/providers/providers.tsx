'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { createContext, useCallback, useContext, useState } from 'react';
const ToastContext = createContext<(message: string, error?: boolean) => void>(() => {});
export const useToast = () => useContext(ToastContext);
export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 1, staleTime: 20_000, refetchOnWindowFocus: false } },
      }),
  );
  const [toast, setToast] = useState<{ message: string; error: boolean } | null>(null);
  const notify = useCallback((message: string, error = false) => {
    setToast({ message, error });
    setTimeout(() => setToast(null), 6000);
  }, []);
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={client}>
        <ToastContext.Provider value={notify}>
          {children}
          {toast && (
            <div
              className={`toast ${toast.error ? 'toast-error' : ''}`}
              role={toast.error ? 'alert' : 'status'}
            >
              {toast.message}
              <button aria-label="Dismiss notification" onClick={() => setToast(null)}>
                ×
              </button>
            </div>
          )}
        </ToastContext.Provider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
