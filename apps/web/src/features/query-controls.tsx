'use client';
import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { api, type AnalyticsQuery, type Schema } from '@/lib/api';
import { useWorkspace } from './workspace-context';
import { Button } from '@/components/ui/button';
export const metricOptions = [
  ['revenue', 'Net revenue'],
  ['orders', 'Order count'],
  ['aov', 'Average order value'],
  ['units', 'Units sold'],
  ['customers', 'Active customers'],
  ['sum', 'Sum · net line sales'],
  ['count', 'Count · all lines'],
  ['distinct_count', 'Distinct customers'],
  ['average', 'Average · net line sales'],
  ['minimum', 'Minimum · net line sales'],
  ['maximum', 'Maximum · net line sales'],
] as const;
export const dimensionOptions = [
  ['date', 'Order date'],
  ['category', 'Category'],
  ['product_name', 'Product'],
  ['customer_id', 'Customer'],
  ['channel', 'Sales channel'],
  ['status', 'Order status'],
] as const;
export function QueryControls({
  value,
  onChange,
  compact = false,
}: {
  value: AnalyticsQuery;
  onChange: (q: AnalyticsQuery) => void;
  compact?: boolean;
}) {
  const { base } = useWorkspace();
  const datasets = useQuery({
    queryKey: [base, 'datasets'],
    queryFn: () => api<Schema['DatasetOut'][]>(`${base}/datasets`),
  });
  const update = (patch: Partial<AnalyticsQuery>) => onChange({ ...value, ...patch });
  const filters = value.filters || [];
  return (
    <div className={`query-controls ${compact ? 'compact-controls' : ''}`}>
      <div className="form-grid">
        <label>
          Data source
          <select
            value={value.dataset_id || ''}
            onChange={(e) => update({ dataset_id: e.target.value || null })}
          >
            <option value="">All workspace sales</option>
            {datasets.data?.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Metric
          <select
            value={value.metric || 'revenue'}
            onChange={(e) => update({ metric: e.target.value as AnalyticsQuery['metric'] })}
          >
            {metricOptions.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Dimension
          <select
            value={value.dimension || 'date'}
            onChange={(e) => update({ dimension: e.target.value as AnalyticsQuery['dimension'] })}
          >
            {dimensionOptions.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {value.dimension === 'date' && (
          <label>
            Time grouping
            <select
              value={value.grouping || 'month'}
              onChange={(e) => update({ grouping: e.target.value as AnalyticsQuery['grouping'] })}
            >
              <option value="day">Daily</option>
              <option value="week">Weekly</option>
              <option value="month">Monthly</option>
            </select>
          </label>
        )}
        <label>
          From
          <input
            type="date"
            value={value.start || ''}
            max={value.end || undefined}
            onChange={(e) => update({ start: e.target.value || null })}
          />
        </label>
        <label>
          To
          <input
            type="date"
            value={value.end || ''}
            min={value.start || undefined}
            onChange={(e) => update({ end: e.target.value || null })}
          />
        </label>
        <label>
          Sort
          <select
            value={value.sort || 'label'}
            onChange={(e) => update({ sort: e.target.value as AnalyticsQuery['sort'] })}
          >
            <option value="label">Dimension ascending</option>
            <option value="-value">Highest value first</option>
            <option value="value">Lowest value first</option>
          </select>
        </label>
        <label>
          Result limit
          <input
            type="number"
            min={1}
            max={500}
            value={value.limit || 100}
            onChange={(e) => update({ limit: Math.max(1, Math.min(500, Number(e.target.value))) })}
          />
        </label>
      </div>
      {!compact && (
        <div className="query-filters">
          <div className="row-between">
            <span className="field-caption">FILTERS · ALL MUST MATCH</span>
            <Button
              size="sm"
              variant="ghost"
              disabled={filters.length >= 10}
              onClick={() =>
                update({ filters: [...filters, { field: 'category', op: 'eq', values: [''] }] })
              }
            >
              <Plus size={14} />
              Add filter
            </Button>
          </div>
          {filters.map((f, i) => (
            <div className="filter-row" key={i}>
              <select
                aria-label={`Filter ${i + 1} field`}
                value={f.field}
                onChange={(e) => {
                  const next = [...filters];
                  next[i] = {
                    field: e.target.value as Schema['Filter']['field'],
                    op: 'eq',
                    values: [''],
                  };
                  update({ filters: next });
                }}
              >
                {[
                  ...dimensionOptions.filter(([key]) => key !== 'date'),
                  ['order_date', 'Order date'],
                  ['quantity', 'Quantity'],
                  ['unit_price', 'Unit price'],
                ].map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
              <select
                aria-label={`Filter ${i + 1} operator`}
                value={f.op}
                onChange={(e) => {
                  const next = [...filters];
                  next[i] = { ...f, op: e.target.value as Schema['Filter']['op'] };
                  update({ filters: next });
                }}
              >
                {[
                  'eq',
                  'neq',
                  'in',
                  ...(['quantity', 'unit_price', 'order_date'].includes(f.field)
                    ? ['gt', 'lt', 'between']
                    : ['contains']),
                ].map((op) => (
                  <option key={op} value={op}>
                    {
                      (
                        {
                          eq: 'Equals',
                          neq: 'Does not equal',
                          in: 'In (comma separated)',
                          gt: 'Greater than',
                          lt: 'Less than',
                          between: 'Between (comma separated)',
                          contains: 'Contains',
                        } as Record<string, string>
                      )[op]
                    }
                  </option>
                ))}
              </select>
              <input
                aria-label={`Filter ${i + 1} value`}
                value={f.values.join(',')}
                onChange={(e) => {
                  const next = [...filters];
                  next[i] = { ...f, values: e.target.value.split(',').map((v) => v.trim()) };
                  update({ filters: next });
                }}
                placeholder="Value"
              />
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Remove filter ${i + 1}`}
                onClick={() => update({ filters: filters.filter((_, idx) => idx !== i) })}
              >
                <Trash2 size={15} />
              </Button>
            </div>
          ))}
        </div>
      )}
      {datasets.error && (
        <p role="alert" className="form-error">
          {datasets.error.message}
        </p>
      )}
    </div>
  );
}
