'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDownToLine, FileBarChart, Pencil, Plus, Trash2 } from 'lucide-react';
import { api, defaultQuery, download, type Report, type Schema } from '@/lib/api';
import { Chart } from '@/components/charts/chart';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Empty, ErrorState, Loading } from '@/components/ui/states';
import { useWorkspace } from './workspace-context';
import { useToast } from '@/providers/providers';
import { PageHeading } from './common';
import { QueryControls } from './query-controls';
export function Reports() {
  const { base, canEdit } = useWorkspace();
  const toast = useToast();
  const client = useQueryClient();
  const [editing, setEditing] = useState<{
    id?: string;
    name: string;
    query: Schema['QueryIn'];
  } | null>(null);
  const [selected, setSelected] = useState<Report | null>(null);
  const [remove, setRemove] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const reports = useQuery({
    queryKey: [base, 'reports'],
    queryFn: () => api<Report[]>(`${base}/reports`),
  });
  const result = useQuery({
    queryKey: [base, 'report-result', selected?.id, selected?.query],
    queryFn: () =>
      api<Schema['QueryOut']>(`${base}/analytics/query`, {
        method: 'POST',
        body: JSON.stringify(selected?.query),
      }),
    enabled: !!selected,
  });
  return (
    <>
      <PageHeading
        eyebrow="GOOD QUESTIONS, WORTH KEEPING"
        title="Reports"
        description="Save a view. Come back to a fresh answer."
      >
        {canEdit && (
          <Button onClick={() => setEditing({ name: '', query: defaultQuery })}>
            <Plus size={15} />
            Create report
          </Button>
        )}
      </PageHeading>
      {reports.isPending ? (
        <Loading />
      ) : reports.error ? (
        <ErrorState error={reports.error} />
      ) : !reports.data.length ? (
        <Empty
          title="Keep the insights that matter"
          description="Save query configurations, revisit live results, and export your findings."
        >
          {canEdit && (
            <Button onClick={() => setEditing({ name: '', query: defaultQuery })}>
              Create your first report
            </Button>
          )}
        </Empty>
      ) : (
        <div className="report-list">
          {reports.data.map((r) => (
            <article key={r.id} className="panel report-card">
              <span className="report-icon">
                <FileBarChart size={22} />
              </span>
              <div>
                <button className="report-title" onClick={() => setSelected(r)}>
                  {r.name}
                </button>
                <p>
                  {r.query.metric || 'revenue'} by {r.query.dimension || 'date'} ·{' '}
                  {r.query.start || 'All time'}
                  {r.query.end ? ` to ${r.query.end}` : ''}
                </p>
                <small>Saved {new Date(r.created_at).toLocaleDateString()}</small>
              </div>
              <div className="report-actions">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    download(
                      `${base}/analytics/export`,
                      r.query,
                      `${r.name.replace(/[^a-z0-9]/gi, '-')}.csv`,
                    ).catch((e) => toast(e.message, true))
                  }
                >
                  <ArrowDownToLine size={14} />
                  CSV
                </Button>
                {canEdit && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Edit ${r.name}`}
                      onClick={() => setEditing(r)}
                    >
                      <Pencil size={15} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${r.name}`}
                      onClick={() => setRemove(r)}
                    >
                      <Trash2 size={15} />
                    </Button>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      <Dialog
        open={!!editing}
        onOpenChange={(o) => {
          if (!o) setEditing(null);
        }}
        title={editing?.id ? 'Edit report' : 'A report worth returning to'}
        description="Save the question, not a frozen copy of the answer."
      >
        {editing && (
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await api(`${base}/reports${editing.id ? `/${editing.id}` : ''}`, {
                  method: editing.id ? 'PATCH' : 'POST',
                  body: JSON.stringify({ name: editing.name, query: editing.query }),
                });
                await client.invalidateQueries({ queryKey: [base, 'reports'] });
                setEditing(null);
                toast('Report saved');
              } catch (err) {
                toast((err as Error).message, true);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Report name
              <input
                required
                maxLength={100}
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                placeholder="e.g. Monthly category performance"
              />
            </label>
            <QueryControls
              value={editing.query}
              onChange={(query) => setEditing({ ...editing, query })}
            />
            <Button disabled={busy}>Save report</Button>
          </form>
        )}
      </Dialog>
      <Dialog
        open={!!selected}
        onOpenChange={(o) => {
          if (!o) setSelected(null);
        }}
        title={selected?.name || 'Report'}
        description="Live results from your saved query."
      >
        {result.isPending ? (
          <Loading />
        ) : result.error ? (
          <ErrorState error={result.error} />
        ) : (
          <Chart
            points={result.data.points}
            type="table"
            title="Report results"
            currency={['revenue', 'aov', 'sum', 'average', 'minimum', 'maximum'].includes(
              selected?.query.metric || 'revenue',
            )}
          />
        )}
        <Button
          variant="outline"
          onClick={() => {
            if (selected)
              download(`${base}/analytics/export`, selected.query).catch((e) =>
                toast(e.message, true),
              );
          }}
        >
          <ArrowDownToLine size={15} />
          Export CSV
        </Button>
      </Dialog>
      <Dialog
        open={!!remove}
        onOpenChange={(o) => {
          if (!o) setRemove(null);
        }}
        title="Delete this report?"
        description={`“${remove?.name}” will be removed. Source data will be kept.`}
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
                await api(`${base}/reports/${remove.id}`, { method: 'DELETE' });
                await client.invalidateQueries({ queryKey: [base, 'reports'] });
                setRemove(null);
                toast('Report deleted');
              } catch (e) {
                toast((e as Error).message, true);
              } finally {
                setBusy(false);
              }
            }}
          >
            Delete report
          </Button>
        </div>
      </Dialog>
    </>
  );
}
