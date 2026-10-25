'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useTheme } from 'next-themes';
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  ChevronDown,
  Database,
  FileBarChart,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Package,
  PanelLeftClose,
  Search,
  Settings,
  ShoppingBag,
  Sun,
  Users,
  X,
  Plus,
} from 'lucide-react';
import { useState } from 'react';
import { api, type Workspace } from '@/lib/api';
import { useWorkspace } from './workspace-context';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { canLeaveWorkspace } from '@/hooks/use-unsaved-changes';
import { useToast } from '@/providers/providers';
const links = [
  ['overview', 'Overview', LayoutDashboard],
  ['analytics', 'Data explorer', BarChart3],
  ['sales', 'Sales', ShoppingBag],
  ['customers', 'Customers', Users],
  ['products', 'Products', Package],
  ['data-sources', 'Data sources', Database],
  ['dashboards', 'Dashboards', LayoutDashboard],
  ['reports', 'Reports', FileBarChart],
  ['settings', 'Settings', Settings],
] as const;
export function Shell({ children }: { children: React.ReactNode }) {
  const { user, workspace, workspaces, choose } = useWorkspace();
  const path = usePathname();
  const router = useRouter();
  const client = useQueryClient();
  const toast = useToast();
  const { resolvedTheme, setTheme } = useTheme();
  const [mobile, setMobile] = useState(false);
  const [compact, setCompact] = useState(false);
  const [create, setCreate] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [command, setCommand] = useState(false);
  const [search, setSearch] = useState('');
  const current = links.find(([key]) => path.includes(`/workspace/${key}`));
  return (
    <div className={`app-shell ${compact ? 'is-compact' : ''}`}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      {mobile && (
        <button
          className="mobile-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={`sidebar ${mobile ? 'mobile-open' : ''}`}>
        <Link className="brand" href="/workspace/overview">
          <span className="brand-mark">a</span>
          <span className="brand-name">
            avenor<span className="brand-dot">.</span>
          </span>
        </Link>
        <button
          className="mobile-close button ghost icon-button"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        >
          <X size={20} />
        </button>
        <div className="workspace-switch">
          <span className="workspace-avatar">{workspace.name.slice(0, 1)}</span>
          <label className="workspace-label">
            <span className="sr-only">Current workspace</span>
            <select
              aria-label="Current workspace"
              value={workspace.id}
              onChange={(e) => {
                if (!choose(e.target.value)) e.currentTarget.value = workspace.id;
              }}
            >
              {workspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
            <small>{workspace.demo ? 'Demo Workspace' : `${workspace.role} · USD`}</small>
          </label>
          <ChevronDown size={14} />
        </div>
        <button
          className="search-trigger"
          onClick={() => setCommand(true)}
          aria-label="Search navigation"
        >
          <Search size={15} />
          <span>Go to…</span>
          <kbd>⌕</kbd>
        </button>
        <p className="nav-label">WORKSPACE</p>
        <nav aria-label="Main navigation">
          {links.map(([key, label, Icon], i) => (
            <Link
              key={key}
              href={`/workspace/${key}`}
              onClick={() => setMobile(false)}
              className={`nav-link ${path.includes(`/workspace/${key}`) ? 'active' : ''} ${i === 5 ? 'nav-divider' : ''}`}
            >
              <Icon size={18} />
              <span>{label}</span>
              {key === 'overview' && <span className="nav-active-dot" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="new-workspace" onClick={() => setCreate(true)}>
            <Plus size={15} />
            <span>New workspace</span>
          </button>
          <div className="data-note">
            <Activity size={16} />
            <div>
              <strong>Your data. Your perspective.</strong>
              <p>A little clarity goes a long way.</p>
              <Link href="/workspace/data-sources">
                Bring your data <ArrowUpRight size={13} />
              </Link>
            </div>
          </div>
          <div className="profile-row">
            <Link href="/workspace/settings" className="profile-link">
              <span className="avatar">
                {user.name
                  .split(' ')
                  .map((s) => s[0])
                  .slice(0, 2)
                  .join('')}
              </span>
              <span>
                <strong>{user.name}</strong>
                <small>{user.demo ? 'Exploring Avenor' : 'Personal account'}</small>
              </span>
            </Link>
            <button
              className="button ghost icon-button"
              aria-label="Sign out"
              onClick={async () => {
                try {
                  if (!canLeaveWorkspace()) return;
                  await api('/auth/logout', { method: 'POST' });
                  client.clear();
                  router.push('/');
                } catch (e) {
                  toast((e as Error).message, true);
                }
              }}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
      <div className="workspace-main">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="button ghost icon-button desktop-collapse"
              aria-label="Toggle sidebar"
              onClick={() => setCompact(!compact)}
            >
              <PanelLeftClose size={17} />
            </button>
            <button
              className="button ghost icon-button mobile-toggle"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu size={20} />
            </button>
            <span>{workspace.name}</span>
            <span className="breadcrumb-slash">/</span>
            <strong>{current?.[1] || 'Dashboard'}</strong>
          </div>
          <div className="topbar-right">
            {workspace.demo && (
              <span className="demo-badge">
                <span />
                Demo workspace
              </span>
            )}
            <button
              className="button ghost icon-button"
              aria-label="Toggle color theme"
              onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            >
              <Sun className="theme-sun" size={17} />
              <Moon className="theme-moon" size={17} />
            </button>
            <span className="avatar small-avatar">{user.name.slice(0, 1)}</span>
          </div>
        </header>
        <main id="main" className="page-content">
          {children}
        </main>
        <footer className="workspace-footer">
          <span>AVENOR ANALYTICS</span>
          <span>Less noise. More perspective.</span>
          <span>
            <i />
            Connected to your workspace
          </span>
        </footer>
      </div>
      <Dialog
        open={create}
        onOpenChange={setCreate}
        title="A new perspective"
        description="Create an independent workspace for your data."
      >
        <form
          className="form-stack"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              const w = await api<Workspace>('/workspaces', {
                method: 'POST',
                body: JSON.stringify({ name }),
              });
              await client.invalidateQueries({ queryKey: ['workspaces'] });
              const selected = choose(w.id);
              setCreate(false);
              if (selected) router.push('/workspace/data-sources');
              toast('Workspace created');
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
          <Button disabled={busy}>Create workspace</Button>
        </form>
      </Dialog>
      <Dialog open={command} onOpenChange={setCommand} title="Find your perspective">
        <label>
          Search pages
          <input
            autoFocus
            placeholder="Overview, reports, data…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <div className="command-results">
          {links
            .filter(([, label]) => label.toLowerCase().includes(search.toLowerCase()))
            .map(([key, label, Icon]) => (
              <Link key={key} href={`/workspace/${key}`} onClick={() => setCommand(false)}>
                <Icon size={16} />
                {label}
                <ArrowUpRight size={15} />
              </Link>
            ))}
        </div>
      </Dialog>
    </div>
  );
}
