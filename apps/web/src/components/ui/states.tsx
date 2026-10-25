import { AlertCircle, Inbox, LoaderCircle } from 'lucide-react';
import { Button } from './button';
export function Loading({ label = 'Loading your workspace…' }: { label?: string }) {
  return (
    <div className="loading-state" role="status">
      <LoaderCircle className="spin" size={22} />
      <span>{label}</span>
    </div>
  );
}
export function ErrorState({ error, retry }: { error: Error; retry?: () => void }) {
  return (
    <div className="state error-state" role="alert">
      <AlertCircle size={24} />
      <h3>Something needs attention</h3>
      <p>{error.message}</p>
      {retry && (
        <Button variant="outline" onClick={retry}>
          Try again
        </Button>
      )}
    </div>
  );
}
export function Empty({
  title = 'No data yet',
  description = 'Import a dataset to start exploring.',
  children,
}: {
  title?: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="state">
      <Inbox size={28} />
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  );
}
