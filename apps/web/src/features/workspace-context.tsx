'use client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Fragment, createContext, useContext, useEffect, useState } from 'react';
import { ApiError, api, type User, type Workspace } from '@/lib/api';
import { Loading, ErrorState } from '@/components/ui/states';
import { Button } from '@/components/ui/button';
import { useTheme } from 'next-themes';
import { canLeaveWorkspace } from '@/hooks/use-unsaved-changes';
import { useToast } from '@/providers/providers';

type Context = {
  user: User;
  workspaces: Workspace[];
  workspace: Workspace;
  choose: (id: string) => boolean;
  base: string;
  canEdit: boolean;
  locale: string;
  dateFormat: string;
};
const WorkspaceContext = createContext<Context | null>(null);
export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error('Workspace provider missing');
  return context;
}
export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { setTheme } = useTheme();
  const router = useRouter();
  const client = useQueryClient();
  const toast = useToast();
  const me = useQuery({ queryKey: ['me'], queryFn: () => api<User>('/auth/me'), retry: false });
  const workspaces = useQuery({
    queryKey: ['workspaces'],
    queryFn: () => api<Workspace[]>('/workspaces'),
    enabled: !!me.data,
  });
  const [selected, setSelected] = useState<string | null>(() =>
    typeof window === 'undefined' ? null : localStorage.getItem('avenor_workspace'),
  );
  const [name, setName] = useState('My workspace');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (me.error instanceof ApiError && me.error.status === 401) router.replace('/sign-in');
  }, [me.error, router]);
  useEffect(() => {
    if (me.data?.preferences.theme && !localStorage.getItem('theme'))
      setTheme(me.data.preferences.theme);
  }, [me.data?.preferences.theme, setTheme]);
  const choose = (id: string) => {
    if (!canLeaveWorkspace()) return false;
    setSelected(id);
    localStorage.setItem('avenor_workspace', id);
    return true;
  };
  if (me.isPending || (me.data && workspaces.isPending)) return <Loading />;
  if (me.error) return <ErrorState error={me.error} retry={() => me.refetch()} />;
  if (workspaces.error)
    return <ErrorState error={workspaces.error} retry={() => workspaces.refetch()} />;
  if (!me.data || !workspaces.data) return null;
  const workspace = workspaces.data.find((w) => w.id === selected) || workspaces.data[0];
  if (!workspace)
    return (
      <main className="onboarding">
        <div className="brand-mark">a</div>
        <p className="eyebrow">YOUR NEXT CHAPTER</p>
        <h1>Make room for clarity.</h1>
        <p className="muted">Create a workspace. Your data, dashboards, and decisions live here.</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              const ws = await api<Workspace>('/workspaces', {
                method: 'POST',
                body: JSON.stringify({ name }),
              });
              choose(ws.id);
              await client.invalidateQueries({ queryKey: ['workspaces'] });
            } catch (err) {
              toast((err as Error).message, true);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Workspace name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={100}
            />
          </label>
          <Button disabled={busy}>{busy ? 'Creating…' : 'Create workspace'}</Button>
        </form>
      </main>
    );
  return (
    <WorkspaceContext.Provider
      value={{
        user: me.data,
        workspaces: workspaces.data,
        workspace,
        choose,
        base: `/workspaces/${workspace.id}`,
        canEdit: workspace.role !== 'viewer',
        locale: me.data.preferences.number_format || 'en-US',
        dateFormat: me.data.preferences.date_format || 'iso',
      }}
    >
      <Fragment key={workspace.id}>{children}</Fragment>
    </WorkspaceContext.Provider>
  );
}

export function WorkspaceEntry() {
  const { workspace } = useWorkspace();
  const router = useRouter();
  useEffect(() => {
    router.replace(
      workspace.default_dashboard_id
        ? `/workspace/dashboards/${workspace.default_dashboard_id}`
        : '/workspace/overview',
    );
  }, [workspace.default_dashboard_id, router]);
  return <Loading label="Opening your workspace…" />;
}
