'use client';
import { ErrorState } from '@/components/ui/states';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <ErrorState
      error={new Error('This view could not be loaded. Please try again.')}
      retry={reset}
    />
  );
}
