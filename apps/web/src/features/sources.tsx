'use client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  Check,
  Database,
  FileSpreadsheet,
  UploadCloud,
  Trash2,
  ArrowRight,
  ArrowDownToLine,
} from 'lucide-react';
import { api, number, type Schema } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Empty, ErrorState, Loading } from '@/components/ui/states';
import { useToast } from '@/providers/providers';
import { useWorkspace } from './workspace-context';
import { PageHeading, Panel } from './common';
const fields = [
  'order_id',
  'order_date',
  'customer_id',
  'product_name',
  'quantity',
  'unit_price',
  'category',
  'channel',
  'status',
  'discount',
  'refund',
];
const required = fields.slice(0, 6);
export function Sources() {
  const { base, canEdit, workspace } = useWorkspace();
  const client = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Schema['PreviewOut'] | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [name, setName] = useState('');
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Schema['ImportOut'] | null>(null);
  const [replace, setReplace] = useState('');
  const [remove, setRemove] = useState<Schema['DatasetOut'] | null>(null);
  const [detail, setDetail] = useState<Schema['DatasetOut'] | null>(null);
  const datasets = useQuery({
    queryKey: [base, 'datasets'],
    queryFn: () => api<Schema['DatasetOut'][]>(`${base}/datasets`),
  });
  const jobs = useQuery({
    queryKey: [base, 'imports'],
    queryFn: () => api<Schema['ImportJobOut'][]>(`${base}/imports`),
  });
  const sample = useQuery({
    queryKey: [base, 'dataset-preview', detail?.id],
    queryFn: () => api<Schema['SaleOut'][]>(`${base}/datasets/${detail?.id}/preview`),
    enabled: !!detail,
  });
  const refresh = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: [base] }),
      client.invalidateQueries({ queryKey: ['workspaces'] }),
    ]);
  const begin = () => {
    setFile(null);
    setPreview(null);
    setMapping({});
    setStep(0);
    setError('');
    setResult(null);
    setReplace('');
    setOpen(true);
  };
  async function upload(selected: File) {
    setFile(selected);
    setName(selected.name.replace(/\.[^.]+$/, ''));
    setBusy(true);
    setError('');
    try {
      const data = new FormData();
      data.append('file', selected);
      const p = await api<Schema['PreviewOut']>(`${base}/datasets/preview`, {
        method: 'POST',
        body: data,
      });
      setPreview(p);
      const m: Record<string, string> = {};
      for (const field of fields) {
        const match = p.columns.find((c) => c.toLowerCase().replaceAll(' ', '_') === field);
        if (match) m[field] = match;
      }
      setMapping(m);
      setStep(1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function process(validateOnly: boolean) {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const data = new FormData();
      data.append('file', file);
      data.append(
        'mapping',
        JSON.stringify(Object.fromEntries(Object.entries(mapping).filter(([, v]) => v))),
      );
      data.append('name', name);
      data.append('validate_only', String(validateOnly));
      data.append('mode', replace ? 'replace' : 'create');
      if (replace) data.append('dataset_id', replace);
      const imported = await api<Schema['ImportOut']>(`${base}/datasets/import`, {
        method: 'POST',
        body: data,
      });
      setResult(imported);
      if (imported.status === 'completed') {
        setStep(validateOnly ? 3 : 4);
        if (!validateOnly) {
          await refresh();
          toast(`${imported.imported.toLocaleString()} lines imported`);
        }
      } else {
        setStep(2);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="GOOD DECISIONS START HERE"
        title="Data sources"
        description="Bring your sales data into one considered workspace."
      >
        {canEdit && (
          <Button onClick={begin}>
            <UploadCloud size={16} />
            Import dataset
          </Button>
        )}
      </PageHeading>
      <div className="source-intro">
        <div className="source-icon">
          <Database size={24} />
        </div>
        <div>
          <h2>Your data, connected.</h2>
          <p>CSV and Excel. A shared sales model. Every number traceable to its source.</p>
        </div>
        <span className="subtle-label">USD · UP TO 100,000 ROWS / FILE</span>
      </div>
      {datasets.isPending ? (
        <Loading />
      ) : datasets.error ? (
        <ErrorState error={datasets.error} />
      ) : !datasets.data.length ? (
        <Panel title="Start with a source">
          <Empty
            title="A clean slate"
            description="Import your sales file or explore with deterministic sample data."
          >
            {canEdit && (
              <div className="row-wrap">
                <Button onClick={begin}>Import your data</Button>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await api(`${base}/demo`, { method: 'POST' });
                      await refresh();
                      toast('Demo dataset created');
                    } catch (e) {
                      toast((e as Error).message, true);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Load demo data
                </Button>
              </div>
            )}
          </Empty>
        </Panel>
      ) : (
        <div className="source-grid">
          {datasets.data.map((d) => (
            <article key={d.id} className="panel source-card">
              <div className="row-between">
                <span className="file-icon">
                  <FileSpreadsheet size={22} />
                </span>
                <span className="status-badge status-paid">Ready</span>
              </div>
              <button className="source-title" onClick={() => setDetail(d)}>
                {d.name}
              </button>
              <p>
                {number(d.row_count)} order lines · {d.columns.length} columns
              </p>
              <div className="source-card-footer">
                <span>Imported {new Date(d.created_at).toLocaleDateString()}</span>
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${d.name}`}
                    onClick={() => setRemove(d)}
                  >
                    <Trash2 size={15} />
                  </Button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      <Panel title="Import history" subtitle="Real imports, validations, and outcomes.">
        {jobs.isPending ? (
          <Loading />
        ) : jobs.error ? (
          <ErrorState error={jobs.error} />
        ) : jobs.data.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>FILE</th>
                  <th>STATUS</th>
                  <th>IMPORTED</th>
                  <th>INVALID ROWS</th>
                  <th>DATE</th>
                  <th>ERRORS</th>
                </tr>
              </thead>
              <tbody>
                {jobs.data.map((j) => (
                  <tr key={j.id}>
                    <td>{j.filename}</td>
                    <td>
                      <span
                        className={`status-badge ${j.status === 'completed' ? 'status-paid' : 'status-cancelled'}`}
                      >
                        {j.status}
                      </span>
                    </td>
                    <td>{number(j.imported)}</td>
                    <td>{j.rejected}</td>
                    <td>{new Date(j.created_at).toLocaleDateString()}</td>
                    <td>
                      {j.errors.length > 0 ? (
                        <a
                          className="text-link"
                          href={`/api/v1${base}/imports/${j.id}/errors`}
                          download
                        >
                          <ArrowDownToLine size={14} />
                          Error CSV
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty-inline">Your import history will appear here.</p>
        )}
      </Panel>
      {workspace.demo && canEdit && (
        <div className="note-banner">
          <span>You’re in an isolated demo workspace. Changes are yours alone.</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (
                window.confirm(
                  'Reset this demo? All datasets, dashboards and reports in this workspace will be replaced.',
                )
              ) {
                setBusy(true);
                api(`${base}/reset-demo`, { method: 'POST' })
                  .then(refresh)
                  .then(() => toast('Demo reset'))
                  .catch((e) => toast(e.message, true))
                  .finally(() => setBusy(false));
              }
            }}
            disabled={busy}
          >
            Reset demo
          </Button>
        </div>
      )}
      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (!busy) setOpen(o);
        }}
        title={step === 4 ? 'Your data is ready.' : 'Bring a new perspective'}
        description="Import a CSV or XLSX file. All amounts are USD; one row per order/product line."
      >
        <ol className="import-steps">
          {['Upload', 'Map', 'Validate', 'Import'].map((s, i) => (
            <li className={step >= i ? 'current' : ''} key={s}>
              <span>{step > i ? <Check size={12} /> : i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {step === 0 && (
          <>
            <label
              className="dropzone"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const selected = e.dataTransfer.files[0];
                if (selected) void upload(selected);
              }}
            >
              <UploadCloud size={32} />
              <strong>{busy ? 'Reading your file…' : 'Drop your data here'}</strong>
              <span>CSV or XLSX · up to 10 MiB · UTF-8</span>
              <input
                type="file"
                aria-label="Choose sales file"
                accept=".csv,.xlsx"
                disabled={busy}
                onChange={(e) => {
                  if (e.target.files?.[0]) void upload(e.target.files[0]);
                }}
              />
            </label>
            <p className="muted small-text">
              Required fields: order_id, order_date (YYYY-MM-DD), customer_id, product_name,
              quantity, unit_price. Discounts and refunds are line totals.
            </p>
            <a className="text-link" href="/sample-sales.csv" download>
              Download sample CSV <ArrowDownToLine size={14} />
            </a>
          </>
        )}
        {preview && step >= 1 && step < 4 && (
          <>
            <div className="import-file">
              <FileSpreadsheet size={20} />
              <span>
                {file?.name}
                <small>
                  {number(preview.total_rows)} rows · {number((file?.size || 0) / 1024)} KiB
                </small>
              </span>
            </div>
            {step === 1 && (
              <>
                <div className="table-scroll preview-table">
                  <table>
                    <thead>
                      <tr>
                        {preview.columns.map((c) => (
                          <th key={c}>
                            {c}
                            <small>{preview.inferred_types[c]}</small>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.slice(0, 3).map((r, i) => (
                        <tr key={i}>
                          {preview.columns.map((c) => (
                            <td key={c}>{r[c] || '—'}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <label>
                  Dataset name
                  <input value={name} maxLength={200} onChange={(e) => setName(e.target.value)} />
                </label>
                <label>
                  Import strategy
                  <select value={replace} onChange={(e) => setReplace(e.target.value)}>
                    <option value="">Create new dataset</option>
                    {datasets.data?.map((d) => (
                      <option key={d.id} value={d.id}>
                        Replace: {d.name}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="mapping-grid">
                  {fields.map((f) => (
                    <label key={f}>
                      {f.replaceAll('_', ' ')} {required.includes(f) ? '*' : ''}
                      <select
                        aria-label={`Map ${f}`}
                        value={mapping[f] || ''}
                        onChange={(e) => setMapping({ ...mapping, [f]: e.target.value })}
                      >
                        <option value="">
                          {required.includes(f) ? 'Choose column…' : 'Use default'}
                        </option>
                        {preview.columns.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
                <div className="dialog-actions">
                  <Button variant="outline" onClick={() => setStep(0)}>
                    Choose another file
                  </Button>
                  <Button
                    disabled={busy || !name.trim() || required.some((f) => !mapping[f])}
                    onClick={() => process(true)}
                  >
                    {busy ? 'Validating…' : 'Validate data'}
                    <ArrowRight size={15} />
                  </Button>
                </div>
              </>
            )}
            {step === 2 && (
              <>
                <p className="form-error">
                  {result?.rejected} row(s) failed. Nothing was imported. Correct your file and
                  upload again.
                </p>
                <div className="table-scroll error-table">
                  <table>
                    <thead>
                      <tr>
                        <th>ROW</th>
                        <th>FIELD</th>
                        <th>ISSUE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result?.errors.map((e, i) => (
                        <tr key={i}>
                          <td>{e.row}</td>
                          <td>{e.column}</td>
                          <td>{e.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Button variant="outline" onClick={() => setStep(1)}>
                  Review mapping
                </Button>
              </>
            )}
            {step === 3 && (
              <div className="state">
                <span className="success-icon">
                  <Check size={26} />
                </span>
                <h3>Everything checks out.</h3>
                <p>
                  {number(preview.total_rows)} valid rows.{' '}
                  {replace
                    ? 'The selected dataset will be replaced atomically.'
                    : 'A new dataset will be created.'}
                </p>
                <Button disabled={busy} onClick={() => process(false)}>
                  {busy ? 'Importing into your workspace…' : 'Confirm import'}
                </Button>
                <Button variant="ghost" disabled={busy} onClick={() => setStep(1)}>
                  Back to mapping
                </Button>
              </div>
            )}
          </>
        )}
        {step === 4 && (
          <div className="state">
            <span className="success-icon">
              <Check size={26} />
            </span>
            <h3>{number(result?.imported)} lines. A new perspective.</h3>
            <p>Your dataset is saved and available in analytics.</p>
            <Button onClick={() => setOpen(false)}>Back to data sources</Button>
          </div>
        )}
      </Dialog>
      <Dialog
        open={!!remove}
        onOpenChange={(o) => {
          if (!o) setRemove(null);
        }}
        title="Delete this dataset?"
        description={`All order lines in “${remove?.name}” will be deleted. Linked charts will need a different source.`}
      >
        <div className="dialog-actions">
          <Button variant="outline" onClick={() => setRemove(null)}>
            Keep dataset
          </Button>
          <Button
            variant="destructive"
            disabled={busy}
            onClick={async () => {
              if (!remove) return;
              setBusy(true);
              try {
                await api(`${base}/datasets/${remove.id}`, { method: 'DELETE' });
                setRemove(null);
                await refresh();
                toast('Dataset deleted');
              } catch (e) {
                toast((e as Error).message, true);
              } finally {
                setBusy(false);
              }
            }}
          >
            Delete dataset
          </Button>
        </div>
      </Dialog>
      <Dialog
        open={!!detail}
        onOpenChange={(o) => {
          if (!o) setDetail(null);
        }}
        title={detail?.name || 'Dataset'}
        description={`${detail?.row_count || 0} order lines. A preview of the first 20 records.`}
      >
        <div className="schema-chips">
          {detail?.columns.map((c) => (
            <span key={c.name}>
              {c.name}
              <small>{c.type}</small>
            </span>
          ))}
        </div>
        {sample.isPending ? (
          <Loading />
        ) : sample.error ? (
          <ErrorState error={sample.error} />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>ORDER</th>
                  <th>PRODUCT</th>
                  <th>DATE</th>
                  <th>QTY</th>
                  <th>UNIT PRICE</th>
                </tr>
              </thead>
              <tbody>
                {sample.data.map((r) => (
                  <tr key={r.id}>
                    <td>{r.order_id}</td>
                    <td>{r.product_name}</td>
                    <td>{r.order_date}</td>
                    <td>{r.quantity}</td>
                    <td>{r.unit_price}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Dialog>
    </>
  );
}
