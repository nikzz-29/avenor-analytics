'use client';
import { useState } from 'react';
import { useTheme } from 'next-themes';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Monitor, Moon, Sun, Trash2, UserPlus } from 'lucide-react';
import { api, type Schema } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/states';
import { useToast } from '@/providers/providers';
import { useWorkspace } from './workspace-context';
import { PageHeading, Panel } from './common';
export function Settings() {
  const { user, workspace, base } = useWorkspace();
  const toast = useToast();
  const client = useQueryClient();
  const { theme, setTheme } = useTheme();
  const [name, setName] = useState(user.name);
  const [wsName, setWsName] = useState(workspace.name);
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('viewer');
  const [busy, setBusy] = useState(false);
  const [locale, setLocale] = useState(user.preferences.number_format || 'en-US');
  const [dateFormat, setDateFormat] = useState(user.preferences.date_format || 'iso');
  const admin = ['owner', 'admin'].includes(workspace.role);
  const members = useQuery({
    queryKey: [base, 'members'],
    queryFn: () => api<Schema['MemberOut'][]>(`${base}/members`),
  });
  async function saveProfile() {
    setBusy(true);
    try {
      await api('/auth/me', {
        method: 'PATCH',
        body: JSON.stringify({
          name,
          preferences: { number_format: locale, date_format: dateFormat, theme: theme || 'system' },
        }),
      });
      await client.invalidateQueries({ queryKey: ['me'] });
      toast('Preferences saved');
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="MAKE YOURSELF AT HOME"
        title="Settings"
        description="A few small details. A workspace that feels like yours."
      />
      <div className="settings-grid">
        <div>
          <h2 className="settings-label">Your account</h2>
          <p className="muted">The person behind the perspective.</p>
        </div>
        <Panel title="Profile & preferences">
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              void saveProfile();
            }}
          >
            <div className="form-grid">
              <label>
                Full name
                <input
                  required
                  maxLength={100}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label>
                Email
                <input disabled value={user.email} />
              </label>
              <label>
                Number format
                <select value={locale} onChange={(e) => setLocale(e.target.value)}>
                  <option value="en-US">1,234.56 · English (US)</option>
                  <option value="de-DE">1.234,56 · German</option>
                </select>
              </label>
              <label>
                Date format
                <select value={dateFormat} onChange={(e) => setDateFormat(e.target.value)}>
                  <option value="iso">2025-12-31 · ISO</option>
                  <option value="us">12/31/2025 · US</option>
                  <option value="eu">31/12/2025 · European</option>
                </select>
              </label>
            </div>
            <p className="muted small-text">
              Interface language: English. Analytics timezone: UTC. Workspace currency: USD.
            </p>
            <Button disabled={busy}>Save preferences</Button>
          </form>
        </Panel>
        <div>
          <h2 className="settings-label">Appearance</h2>
          <p className="muted">A little light, or a little quiet.</p>
        </div>
        <Panel title="Color theme">
          <div className="theme-options">
            {[
              ['light', 'Light', Sun],
              ['dark', 'Dark', Moon],
              ['system', 'System', Monitor],
            ].map(([key, label, Icon]) => {
              const I = Icon as typeof Sun;
              return (
                <button
                  key={key as string}
                  className={`theme-option ${theme === key ? 'selected' : ''}`}
                  onClick={() => setTheme(key as string)}
                >
                  <I size={24} />
                  <span>{label as string}</span>
                </button>
              );
            })}
          </div>
          <p className="muted small-text">
            Theme is remembered on this device. Save preferences to keep your account preference
            too.
          </p>
        </Panel>
        <div>
          <h2 className="settings-label">Workspace</h2>
          <p className="muted">The space you share with your team.</p>
        </div>
        <Panel title="Workspace details">
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await api(base, {
                  method: 'PATCH',
                  body: JSON.stringify({
                    name: wsName,
                    default_dashboard_id: workspace.default_dashboard_id,
                  }),
                });
                await client.invalidateQueries({ queryKey: ['workspaces'] });
                toast('Workspace updated');
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
                required
                disabled={!admin}
                maxLength={100}
                value={wsName}
                onChange={(e) => setWsName(e.target.value)}
              />
            </label>
            {admin && <Button disabled={busy}>Save workspace</Button>}
          </form>
          <div className="settings-divider" />
          <h3>Members</h3>
          {members.error ? (
            <ErrorState error={members.error} />
          ) : (
            <div className="members-list">
              {members.data?.map((m) => (
                <div key={m.user_id}>
                  <span className="avatar">{m.name[0]}</span>
                  <span>
                    <strong>{m.name}</strong>
                    <small>{m.email}</small>
                  </span>
                  <span className="status-badge">{m.role}</span>
                  {admin &&
                    m.role !== 'owner' &&
                    (workspace.role === 'owner' || m.role !== 'admin') && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove member ${m.name}`}
                        onClick={async () => {
                          if (!window.confirm(`Remove ${m.name} from this workspace?`)) return;
                          try {
                            await api(`${base}/members/${m.user_id}`, { method: 'DELETE' });
                            await client.invalidateQueries({ queryKey: [base, 'members'] });
                            toast('Member removed');
                          } catch (e) {
                            toast((e as Error).message, true);
                          }
                        }}
                      >
                        <Trash2 size={14} />
                      </Button>
                    )}
                </div>
              ))}
            </div>
          )}
          {admin && (
            <form
              className="form-stack"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                try {
                  await api(`${base}/members`, {
                    method: 'PUT',
                    body: JSON.stringify({ email, role }),
                  });
                  await client.invalidateQueries({ queryKey: [base, 'members'] });
                  setEmail('');
                  toast('Member access saved');
                } catch (err) {
                  toast((err as Error).message, true);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <p className="muted small-text">
                Add an existing Avenor account or update their role.
              </p>
              <div className="form-grid">
                <label>
                  Member email
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
                <label>
                  Role
                  <select value={role} onChange={(e) => setRole(e.target.value)}>
                    <option value="viewer">Viewer · read & export</option>
                    <option value="editor">Editor · edit data & dashboards</option>
                    {workspace.role === 'owner' && (
                      <option value="admin">Admin · manage workspace</option>
                    )}
                  </select>
                </label>
              </div>
              <Button variant="outline" disabled={busy}>
                <UserPlus size={15} />
                Save member access
              </Button>
            </form>
          )}
        </Panel>
        <div>
          <h2 className="settings-label">Security</h2>
          <p className="muted">Keep your account yours.</p>
        </div>
        <Panel title="Change password">
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                const r = await api<Schema['Message']>('/auth/password', {
                  method: 'POST',
                  body: JSON.stringify({ current_password: current, new_password: password }),
                });
                setCurrent('');
                setPassword('');
                toast(r.message);
              } catch (err) {
                toast((err as Error).message, true);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Current password
              <input
                required
                type="password"
                autoComplete="current-password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                maxLength={128}
              />
            </label>
            <label>
              New password
              <input
                required
                type="password"
                autoComplete="new-password"
                minLength={10}
                maxLength={128}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <p className="muted small-text">
              At least 10 characters. Changing your password signs out all other sessions.
            </p>
            <Button disabled={busy || user.demo}>Update password</Button>
            {user.demo && (
              <p className="muted small-text">
                Demo accounts use generated credentials. Create an account to manage your password.
              </p>
            )}
          </form>
        </Panel>
      </div>
    </>
  );
}
