'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowDownToLine, Play, Save, Plus } from 'lucide-react';
import {
  api,
  defaultQuery,
  download,
  type AnalyticsQuery,
  type Dashboard,
  type Schema,
  type Widget,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Chart } from '@/components/charts/chart';
import { ErrorState, Loading } from '@/components/ui/states';
import { useToast } from '@/providers/providers';
import { useWorkspace } from './workspace-context';
import { PageHeading, Panel } from './common';
import { QueryControls } from './query-controls';
export function Explorer() {
  const { base, canEdit } = useWorkspace();
  const toast = useToast();
  const [draft, setDraft] = useState<AnalyticsQuery>(defaultQuery);
  const [query, setQuery] = useState<AnalyticsQuery>(defaultQuery);
  const [type, setType] = useState<Widget['type']>('area');
  const [save, setSave] = useState(false);
  const [name, setName] = useState('Revenue exploration');
  const [board, setBoard] = useState(false);
  const [busy, setBusy] = useState(false);
  const result = useQuery({
    queryKey: [base, 'explorer', query],
    queryFn: () =>
      api<Schema['QueryOut']>(`${base}/analytics/query`, {
        method: 'POST',
        body: JSON.stringify(query),
      }),
  });
  const boards = useQuery({
    queryKey: [base, 'dashboards'],
    queryFn: () => api<Dashboard[]>(`${base}/dashboards`),
    enabled: board,
  });
  return (
    <>
      <PageHeading
        eyebrow="FOLLOW YOUR CURIOSITY"
        title="Data explorer"
        description="Ask a better question. Find a clearer answer."
      >
        <Button
          variant="outline"
          onClick={() =>
            download(`${base}/analytics/export`, query).catch((e) => toast(e.message, true))
          }
        >
          <ArrowDownToLine size={15} />
          Export CSV
        </Button>
        {canEdit && (
          <Button onClick={() => setSave(true)}>
            <Save size={15} />
            Save as report
          </Button>
        )}
      </PageHeading>
      <div className="explorer-grid">
        <Panel title="Build your view" subtitle="A query, without the query language.">
          <QueryControls value={draft} onChange={setDraft} />
          <div className="panel-actions">
            <Button onClick={() => setQuery({ ...draft })}>
              <Play size={14} />
              Run query
            </Button>
          </div>
        </Panel>
        <Panel
          title="Your perspective"
          subtitle={`${query.metric || 'revenue'} by ${(query.dimension || 'date').replace('_', ' ')}`}
          action={
            <select
              aria-label="Visualization type"
              value={type}
              onChange={(e) => setType(e.target.value as Widget['type'])}
            >
              {['area', 'line', 'bar', 'horizontal', 'stacked', 'donut', 'table', 'kpi'].map(
                (t) => (
                  <option key={t} value={t}>
                    {t[0].toUpperCase() + t.slice(1)}
                  </option>
                ),
              )}
            </select>
          }
        >
          {result.isPending ? (
            <Loading />
          ) : result.error ? (
            <ErrorState error={result.error} retry={() => result.refetch()} />
          ) : (
            <Chart
              points={result.data?.points || []}
              total={result.data?.total}
              type={type}
              title="Query result"
              height={400}
              currency={['revenue', 'aov', 'sum', 'average', 'minimum', 'maximum'].includes(
                query.metric || 'revenue',
              )}
            />
          )}
          <div className="panel-actions">
            <span className="muted">
              {result.data?.points.length || 0} groups · Maximum {query.limit || 100}
            </span>
            {canEdit && (
              <Button variant="outline" onClick={() => setBoard(true)}>
                <Plus size={14} />
                Add to dashboard
              </Button>
            )}
          </div>
        </Panel>
      </div>
      <Dialog
        open={save}
        onOpenChange={setSave}
        title="Save this perspective"
        description="The query configuration is saved. Results stay live."
      >
        <form
          className="form-stack"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await api(`${base}/reports`, {
                method: 'POST',
                body: JSON.stringify({ name, query }),
              });
              toast('Report saved');
              setSave(false);
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
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={100}
            />
          </label>
          <Button disabled={busy}>Save report</Button>
        </form>
      </Dialog>
      <Dialog
        open={board}
        onOpenChange={setBoard}
        title="Add to a dashboard"
        description="Choose where this chart should live."
      >
        <div className="list-stack">
          {boards.data?.map((d) => (
            <Button
              key={d.id}
              variant="outline"
              disabled={busy || d.widgets.length >= 30}
              onClick={async () => {
                setBusy(true);
                try {
                  await api(`${base}/dashboards/${d.id}`, {
                    method: 'PATCH',
                    body: JSON.stringify({
                      ...d,
                      widgets: [
                        ...d.widgets,
                        { id: crypto.randomUUID(), title: name, type, width: 1, height: 1, query },
                      ],
                      revision: d.revision,
                    }),
                  });
                  toast('Chart added');
                  setBoard(false);
                } catch (e) {
                  toast((e as Error).message, true);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {d.name}
            </Button>
          ))}
          {boards.data?.length === 0 && <p>Create a dashboard in the Dashboards section first.</p>}
          {boards.error && <ErrorState error={boards.error} />}
        </div>
      </Dialog>
    </>
  );
}
