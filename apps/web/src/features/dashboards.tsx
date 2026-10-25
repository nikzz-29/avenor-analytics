'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  Copy,
  GripVertical,
  Maximize2,
  Pencil,
  Plus,
  Save,
  Star,
  Trash2,
} from 'lucide-react';
import { api, defaultQuery, type Dashboard, type Schema, type Widget } from '@/lib/api';
import { Chart } from '@/components/charts/chart';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Empty, ErrorState, Loading } from '@/components/ui/states';
import { useToast } from '@/providers/providers';
import { useWorkspace } from './workspace-context';
import { PageHeading } from './common';
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';
import { QueryControls } from './query-controls';
function newWidget(): Widget {
  return {
    id: crypto.randomUUID(),
    title: 'Untitled perspective',
    type: 'bar',
    query: { ...defaultQuery },
    width: 1,
    height: 1,
    notes: '',
  };
}
export function Dashboards() {
  const { base, canEdit, workspace } = useWorkspace();
  const toast = useToast();
  const client = useQueryClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [remove, setRemove] = useState<Dashboard | null>(null);
  const boards = useQuery({
    queryKey: [base, 'dashboards'],
    queryFn: () => api<Dashboard[]>(`${base}/dashboards`),
  });
  return (
    <>
      <PageHeading
        eyebrow="A WORKSPACE THAT THINKS LIKE YOU"
        title="Dashboards"
        description="Your questions. Your layout. Everything that matters, together."
      >
        {canEdit && (
          <Button onClick={() => setOpen(true)}>
            <Plus size={16} />
            New dashboard
          </Button>
        )}
      </PageHeading>
      {boards.isPending ? (
        <Loading />
      ) : boards.error ? (
        <ErrorState error={boards.error} />
      ) : !boards.data.length ? (
        <Empty
          title="Build your first perspective"
          description="Combine charts, metrics, and notes into a workspace of your own."
        >
          {canEdit && <Button onClick={() => setOpen(true)}>Create dashboard</Button>}
        </Empty>
      ) : (
        <div className="dashboard-list">
          {boards.data.map((d, i) => (
            <article className="panel dashboard-card" key={d.id}>
              <Link
                href={`/workspace/dashboards/${d.id}`}
                className={`dashboard-preview preview-${i % 3}`}
              >
                <div className="preview-layout">
                  <div>
                    <i />
                    <i />
                    <i />
                    <i />
                  </div>
                  <svg viewBox="0 0 200 70" aria-hidden="true">
                    <path
                      d="M0 60 L25 45 L50 50 L75 20 L100 30 L125 10 L150 20 L175 6 L200 10"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                  </svg>
                </div>
                <span className="preview-label">{d.widgets.length} WIDGETS</span>
              </Link>
              <div className="dashboard-card-title">
                <Link href={`/workspace/dashboards/${d.id}`}>
                  <h2>{d.name}</h2>
                </Link>
                {workspace.default_dashboard_id === d.id && <Star size={15} className="positive" />}
              </div>
              <p className="muted small-text">
                Updated {new Date(d.updated_at).toLocaleDateString()}
              </p>
              {canEdit && (
                <div className="dashboard-card-actions">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      try {
                        await api(`${base}/dashboards`, {
                          method: 'POST',
                          body: JSON.stringify({
                            name: `${d.name.slice(0, 90)} copy`,
                            widgets: d.widgets,
                          }),
                        });
                        await client.invalidateQueries({ queryKey: [base, 'dashboards'] });
                        toast('Dashboard duplicated');
                      } catch (e) {
                        toast((e as Error).message, true);
                      }
                    }}
                  >
                    <Copy size={14} />
                    Duplicate
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${d.name}`}
                    onClick={() => setRemove(d)}
                  >
                    <Trash2 size={15} />
                  </Button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Give your perspective a name"
        description="Start with a blank canvas. Add the metrics that matter."
      >
        <form
          className="form-stack"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              const d = await api<Dashboard>(`${base}/dashboards`, {
                method: 'POST',
                body: JSON.stringify({ name }),
              });
              await client.invalidateQueries({ queryKey: [base, 'dashboards'] });
              setOpen(false);
              router.push(`/workspace/dashboards/${d.id}`);
            } catch (err) {
              toast((err as Error).message, true);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Dashboard name
            <input
              required
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Weekly business pulse"
            />
          </label>
          <Button disabled={busy}>Create dashboard</Button>
        </form>
      </Dialog>
      <Dialog
        open={!!remove}
        onOpenChange={(o) => {
          if (!o) setRemove(null);
        }}
        title="Delete dashboard?"
        description={`“${remove?.name}” and its widget configurations will be removed. Your source data stays available.`}
      >
        <div className="dialog-actions">
          <Button variant="outline" onClick={() => setRemove(null)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={busy}
            onClick={async () => {
              if (!remove) return;
              setBusy(true);
              try {
                await api(`${base}/dashboards/${remove.id}`, { method: 'DELETE' });
                await client.invalidateQueries({ queryKey: [base, 'dashboards'] });
                await client.invalidateQueries({ queryKey: ['workspaces'] });
                setRemove(null);
                toast('Dashboard deleted');
              } catch (e) {
                toast((e as Error).message, true);
              } finally {
                setBusy(false);
              }
            }}
          >
            Delete dashboard
          </Button>
        </div>
      </Dialog>
    </>
  );
}
function WidgetContent({ widget }: { widget: Widget }) {
  const { base, locale } = useWorkspace();
  const result = useQuery({
    queryKey: [base, 'widget', widget.query],
    queryFn: () =>
      api<Schema['QueryOut']>(`${base}/analytics/query`, {
        method: 'POST',
        body: JSON.stringify(widget.query),
      }),
    enabled: widget.type !== 'text',
  });
  if (widget.type === 'text')
    return <div className="widget-notes">{widget.notes || 'No notes yet.'}</div>;
  if (result.isPending) return <Loading />;
  if (result.error) return <ErrorState error={result.error} retry={() => result.refetch()} />;
  return (
    <Chart
      locale={locale}
      points={result.data.points}
      total={result.data.total}
      type={widget.type}
      title={widget.title}
      height={widget.height === 2 ? 470 : 245}
      currency={['revenue', 'aov', 'sum', 'average', 'minimum', 'maximum'].includes(
        widget.query.metric || 'revenue',
      )}
    />
  );
}
function SortableWidget({
  widget,
  canEdit,
  edit,
  remove,
  resize,
  move,
  first,
  last,
}: {
  widget: Widget;
  canEdit: boolean;
  edit: () => void;
  remove: () => void;
  resize: () => void;
  move: (direction: number) => void;
  first: boolean;
  last: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: widget.id,
    disabled: !canEdit,
  });
  return (
    <section
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className={`panel dashboard-widget widget-width-${widget.width} ${isDragging ? 'dragging' : ''}`}
    >
      <div className="widget-heading">
        <div>
          {canEdit && (
            <button
              className="button ghost drag-handle"
              aria-label={`Move ${widget.title}`}
              {...attributes}
              {...listeners}
            >
              <GripVertical size={17} />
            </button>
          )}
          <h2>{widget.title}</h2>
        </div>
        {canEdit && (
          <div className="widget-tools">
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Move ${widget.title} up`}
              disabled={first}
              onClick={() => move(-1)}
            >
              <ArrowUp size={13} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Move ${widget.title} down`}
              disabled={last}
              onClick={() => move(1)}
            >
              <ArrowDown size={13} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Resize ${widget.title}`}
              onClick={resize}
            >
              <Maximize2 size={13} />
            </Button>
            <Button variant="ghost" size="icon" aria-label={`Edit ${widget.title}`} onClick={edit}>
              <Pencil size={13} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Remove ${widget.title}`}
              onClick={remove}
            >
              <Trash2 size={13} />
            </Button>
          </div>
        )}
      </div>
      <WidgetContent widget={widget} />
    </section>
  );
}
export function DashboardDetail({ id }: { id: string }) {
  const { base } = useWorkspace();
  return <DashboardEditor key={`${base}:${id}`} id={id} />;
}
function DashboardEditor({ id }: { id: string }) {
  const { base, canEdit, workspace } = useWorkspace();
  const client = useQueryClient();
  const toast = useToast();
  const [edited, setDraft] = useState<Dashboard | null>(null);
  const [dirty, setDirty] = useState(false);
  const [editing, setEditing] = useState<Widget | null>(null);
  const [rename, setRename] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [busy, setBusy] = useState(false);
  const result = useQuery({
    queryKey: [base, 'dashboard', id],
    queryFn: () => api<Dashboard>(`${base}/dashboards/${id}`),
  });
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  useUnsavedChanges(dirty);
  const draft = dirty ? edited : result.data;
  function change(next: Dashboard) {
    setDraft(next);
    setDirty(true);
  }
  if (result.isPending || (!draft && !result.error)) return <Loading />;
  if (result.error) return <ErrorState error={result.error} retry={() => result.refetch()} />;
  if (!draft) return null;
  async function save() {
    if (!draft) return;
    setBusy(true);
    try {
      const updated = await api<Dashboard>(`${base}/dashboards/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: draft.name,
          widgets: draft.widgets,
          revision: draft.revision,
        }),
      });
      client.setQueryData([base, 'dashboard', id], updated);
      setDraft(null);
      setDirty(false);
      await client.invalidateQueries({ queryKey: [base, 'dashboard', id] });
      await client.invalidateQueries({ queryKey: [base, 'dashboards'] });
      toast('Dashboard saved');
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Link className="back-link" href="/workspace/dashboards">
        <ArrowLeft size={14} />
        All dashboards
      </Link>
      <PageHeading
        eyebrow="YOUR OWN PERSPECTIVE"
        title={draft.name}
        description={
          dirty
            ? 'You have unsaved changes. Save to keep this layout.'
            : 'Charts, metrics, and a little room to think.'
        }
      >
        {canEdit && (
          <>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                setRenameValue(draft.name);
                setRename(true);
              }}
            >
              <Pencil size={15} />
              Rename
            </Button>
            <Button
              variant="outline"
              disabled={busy || draft.widgets.length >= 30}
              onClick={() => setEditing(newWidget())}
            >
              <Plus size={15} />
              Add widget
            </Button>
            <Button disabled={!dirty || busy} onClick={save}>
              {dirty ? <Save size={15} /> : <Check size={15} />}{' '}
              {busy ? 'Saving…' : dirty ? 'Save layout' : 'Saved'}
            </Button>
          </>
        )}
      </PageHeading>
      {canEdit && workspace.role !== 'editor' && (
        <button
          className="text-link default-dashboard"
          disabled={busy}
          onClick={async () => {
            try {
              await api(base, {
                method: 'PATCH',
                body: JSON.stringify({ default_dashboard_id: id }),
              });
              await client.invalidateQueries({ queryKey: ['workspaces'] });
              toast('Default dashboard updated');
            } catch (e) {
              toast((e as Error).message, true);
            }
          }}
        >
          <Star size={14} />
          {workspace.default_dashboard_id === id ? 'Default dashboard' : 'Set as default dashboard'}
        </button>
      )}
      {!draft.widgets.length ? (
        <Empty
          title="A canvas for your questions"
          description="Add a chart, a metric, or a note. Make it yours."
        >
          {canEdit && (
            <Button disabled={busy} onClick={() => setEditing(newWidget())}>
              <Plus size={15} />
              Add your first widget
            </Button>
          )}
        </Empty>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={(e) => {
            if (!e.over || e.active.id === e.over.id) return;
            const old = draft.widgets.findIndex((w) => w.id === e.active.id);
            const next = draft.widgets.findIndex((w) => w.id === e.over?.id);
            change({ ...draft, widgets: arrayMove(draft.widgets, old, next) });
          }}
        >
          <SortableContext items={draft.widgets.map((w) => w.id)} strategy={rectSortingStrategy}>
            <div className="widget-grid">
              {draft.widgets.map((w, i) => (
                <SortableWidget
                  key={w.id}
                  widget={w}
                  canEdit={canEdit && !busy}
                  first={i === 0}
                  last={i === draft.widgets.length - 1}
                  edit={() => setEditing(w)}
                  remove={() =>
                    change({ ...draft, widgets: draft.widgets.filter((x) => x.id !== w.id) })
                  }
                  resize={() =>
                    change({
                      ...draft,
                      widgets: draft.widgets.map((x) =>
                        x.id === w.id ? { ...x, width: x.width === 1 ? 2 : 1 } : x,
                      ),
                    })
                  }
                  move={(direction) =>
                    change({ ...draft, widgets: arrayMove(draft.widgets, i, i + direction) })
                  }
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
      <Dialog
        open={!!editing}
        onOpenChange={(o) => {
          if (!o) setEditing(null);
        }}
        title="Shape your widget"
        description="Choose a source and query. Save the dashboard to persist your changes."
      >
        {editing && (
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              const exists = draft.widgets.some((w) => w.id === editing.id);
              change({
                ...draft,
                widgets: exists
                  ? draft.widgets.map((w) => (w.id === editing.id ? editing : w))
                  : [...draft.widgets, editing],
              });
              setEditing(null);
            }}
          >
            <label>
              Widget title
              <input
                required
                maxLength={100}
                value={editing.title}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
              />
            </label>
            <div className="form-grid">
              <label>
                Widget type
                <select
                  value={editing.type}
                  onChange={(e) =>
                    setEditing({ ...editing, type: e.target.value as Widget['type'] })
                  }
                >
                  {[
                    'area',
                    'line',
                    'bar',
                    'horizontal',
                    'stacked',
                    'donut',
                    'table',
                    'kpi',
                    'text',
                  ].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label>
                Width
                <select
                  value={editing.width}
                  onChange={(e) =>
                    setEditing({ ...editing, width: Number(e.target.value) as 1 | 2 })
                  }
                >
                  <option value={1}>Half width</option>
                  <option value={2}>Full width</option>
                </select>
              </label>
              <label>
                Height
                <select
                  value={editing.height}
                  onChange={(e) =>
                    setEditing({ ...editing, height: Number(e.target.value) as 1 | 2 })
                  }
                >
                  <option value={1}>Standard</option>
                  <option value={2}>Tall</option>
                </select>
              </label>
            </div>
            {editing.type === 'text' ? (
              <label>
                Notes
                <textarea
                  rows={6}
                  value={editing.notes}
                  maxLength={4000}
                  onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                />
              </label>
            ) : (
              <QueryControls
                value={editing.query}
                onChange={(query) => setEditing({ ...editing, query })}
              />
            )}
            <Button type="submit">Apply widget</Button>
          </form>
        )}
      </Dialog>
      <Dialog open={rename} onOpenChange={setRename} title="Rename dashboard">
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            change({ ...draft, name: renameValue.trim() });
            setRename(false);
          }}
        >
          <label>
            Dashboard name
            <input
              required
              maxLength={100}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
            />
          </label>
          <Button disabled={busy || !renameValue.trim()}>Apply name</Button>
        </form>
      </Dialog>
    </>
  );
}
