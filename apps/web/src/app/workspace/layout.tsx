import { WorkspaceProvider } from '@/features/workspace-context';
import { Shell } from '@/features/shell';
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceProvider>
      <Shell>{children}</Shell>
    </WorkspaceProvider>
  );
}
