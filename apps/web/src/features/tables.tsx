'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table';
import { ArrowLeft, ArrowRight, Search } from 'lucide-react';
import { api, dateLabel, download, money, number, type Schema } from '@/lib/api';
import { Chart } from '@/components/charts/chart';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Empty, ErrorState, Loading } from '@/components/ui/states';
import { useWorkspace } from './workspace-context';
import { useToast } from '@/providers/providers';
import { PageHeading, Panel, PeriodFilter, usePeriod, usePagination } from './common';
export function DataTable<T>({ data, columns }: { data: T[]; columns: ColumnDef<T>[] }) {
  'use no memo';
  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() });
  const [showColumns, setShowColumns] = useState(false);
  return (
    <>
      <div className="table-toolbar">
        <button className="text-link" onClick={() => setShowColumns(!showColumns)}>
          Columns {showColumns ? '−' : '+'}
        </button>
        {showColumns && (
          <div className="column-options">
            {table.getAllLeafColumns().map((col) => (
              <label key={col.id}>
                <input
                  type="checkbox"
                  checked={col.getIsVisible()}
                  onChange={col.getToggleVisibilityHandler()}
                />
                {col.id.replaceAll('_', ' ')}
              </label>
            ))}
          </div>
        )}
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            {table.getHeaderGroups().map((g) => (
              <tr key={g.id}>
                {g.headers.map((h) => (
                  <th key={h.id}>{flexRender(h.column.columnDef.header, h.getContext())}</th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.length === 0 && (
        <Empty title="No matching records" description="Try another period or search term." />
      )}
    </>
  );
}
function Pagination({
  page,
  total,
  onPage,
}: {
  page: number;
  total: number;
  onPage: (n: number) => void;
}) {
  return (
    <div className="pagination">
      <span>
        {total
          ? `${(page - 1) * 20 + 1}–${Math.min(page * 20, total)} of ${number(total)} records`
          : '0 records'}
      </span>
      <div>
        <Button
          variant="outline"
          size="icon"
          aria-label="Previous page"
          disabled={page === 1}
          onClick={() => onPage(page - 1)}
        >
          <ArrowLeft size={14} />
        </Button>
        <span>Page {page}</span>
        <Button
          variant="outline"
          size="icon"
          aria-label="Next page"
          disabled={page * 20 >= total}
          onClick={() => onPage(page + 1)}
        >
          <ArrowRight size={14} />
        </Button>
      </div>
    </div>
  );
}
export function Sales() {
  const { base, locale, dateFormat } = useWorkspace();
  const toast = useToast();
  const period = usePeriod();
  const [page, setPage] = usePagination(period.params);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('-date');
  const result = useQuery({
    queryKey: [base, 'sales', period.params, page, search, status, sort],
    enabled: period.ready,
    queryFn: () =>
      api<Schema['SalesPage']>(
        `${base}/analytics/sales?${period.params}&page=${page}&search=${encodeURIComponent(search)}&status=${status}&sort=${sort}`,
      ),
  });
  const overview = useQuery({
    queryKey: [base, 'overview', period.params],
    enabled: period.ready,
    queryFn: () => api<Schema['OverviewOut']>(`${base}/analytics/overview?${period.params}`),
  });
  const statuses = useQuery({
    queryKey: [base, 'statuses', period.params],
    enabled: period.ready,
    queryFn: () =>
      api<Schema['QueryOut']>(`${base}/analytics/query`, {
        method: 'POST',
        body: JSON.stringify({
          metric: 'count',
          dimension: 'status',
          start: period.start,
          end: period.end,
        }),
      }),
  });
  const columns: ColumnDef<Schema['SaleOut']>[] = [
    {
      accessorKey: 'order_id',
      header: 'ORDER',
      cell: (c) => <strong>{c.getValue<string>()}</strong>,
    },
    {
      accessorKey: 'order_date',
      header: 'DATE',
      cell: (c) => dateLabel(c.getValue<string>(), dateFormat),
    },
    { accessorKey: 'product_name', header: 'PRODUCT' },
    { accessorKey: 'customer_id', header: 'CUSTOMER' },
    { accessorKey: 'channel', header: 'CHANNEL' },
    {
      accessorKey: 'status',
      header: 'STATUS',
      cell: (c) => (
        <span className={`status-badge status-${c.getValue<string>()}`}>
          {c.getValue<string>()}
        </span>
      ),
    },
    { accessorKey: 'quantity', header: 'QTY' },
    {
      id: 'revenue',
      header: 'NET SALES',
      cell: ({ row }) => money(row.original.net_revenue, locale, 2),
    },
  ];
  return (
    <>
      <PageHeading
        eyebrow="COMMERCE, IN CONTEXT"
        title="Sales"
        description="Understand every order and the momentum behind it."
      />
      <PeriodFilter
        period={period}
        exportData={() =>
          download(
            `${base}/analytics/sales/export`,
            {
              metric: 'revenue',
              dimension: 'date',
              start: period.start,
              end: period.end,
              grouping: 'day',
              sort: 'label',
              limit: 500,
              search,
              status: (status || null) as Schema['SalesExportIn']['status'],
              order_sort: sort as Schema['SalesExportIn']['order_sort'],
            },
            'avenor-sales.csv',
          ).catch((e) => toast(e.message, true))
        }
      />
      {overview.data && (
        <div className="metric-strip">
          <div>
            <span>Net revenue</span>
            <strong>{money(overview.data.current.revenue, locale)}</strong>
          </div>
          <div>
            <span>Eligible orders</span>
            <strong>{number(overview.data.current.orders)}</strong>
          </div>
          <div>
            <span>Average order value</span>
            <strong>{money(overview.data.current.aov, locale)}</strong>
          </div>
          <div>
            <span>Refunds</span>
            <strong>{money(overview.data.current.refunds, locale)}</strong>
          </div>
        </div>
      )}
      {overview.error && <ErrorState error={overview.error} />}
      <div className="chart-grid">
        <Panel title="Revenue trends" subtitle="Net sales across your selected period.">
          {overview.isPending ? (
            <Loading />
          ) : (
            overview.data && (
              <Chart locale={locale} points={overview.data.trend} title="Sales revenue" />
            )
          )}
        </Panel>
        <Panel title="Order status" subtitle="All imported lines, including unfulfilled orders.">
          {statuses.error ? (
            <ErrorState error={statuses.error} />
          ) : (
            <Chart
              locale={locale}
              points={statuses.data?.points || []}
              type="bar"
              title="Order lines by status"
              currency={false}
            />
          )}
        </Panel>
      </div>
      <Panel
        title="Order lines"
        subtitle="One row per order and product. Order totals are counted distinctly."
      >
        <div className="table-filters">
          <label className="search-field">
            <Search size={16} />
            <input
              aria-label="Search orders"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search orders, products, customers…"
            />
          </label>
          <select
            aria-label="Order status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            {['paid', 'refunded', 'cancelled', 'pending'].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <select
            aria-label="Order sorting"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(1);
            }}
          >
            <option value="-date">Newest first</option>
            <option value="date">Oldest first</option>
            <option value="-revenue">Revenue: high to low</option>
            <option value="revenue">Revenue: low to high</option>
          </select>
        </div>
        {result.isPending ? (
          <Loading />
        ) : result.error ? (
          <ErrorState error={result.error} retry={() => result.refetch()} />
        ) : (
          <>
            <DataTable data={result.data.items} columns={columns} />
            <Pagination page={page} total={result.data.total} onPage={setPage} />
          </>
        )}
      </Panel>
    </>
  );
}
export function Entities({ kind }: { kind: 'customers' | 'products' }) {
  const { base, locale, dateFormat } = useWorkspace();
  const period = usePeriod();
  const [page, setPage] = usePagination(period.params);
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState<Schema['EntityRow'] | null>(null);
  const title = kind === 'customers' ? 'Customers' : 'Products';
  const result = useQuery({
    queryKey: [base, kind, period.params, page, search],
    enabled: period.ready,
    queryFn: () =>
      api<Schema['EntityPage']>(
        `${base}/analytics/entities/${kind}?${period.params}&page=${page}&search=${encodeURIComponent(search)}`,
      ),
  });
  const selected = useQuery({
    queryKey: [base, 'entity-detail', detail?.name, period.params],
    queryFn: () =>
      api<Schema['QueryOut']>(`${base}/analytics/query`, {
        method: 'POST',
        body: JSON.stringify({
          dimension: 'date',
          start: period.start,
          end: period.end,
          filters: [
            {
              field: kind === 'customers' ? 'customer_id' : 'product_name',
              op: 'eq',
              values: [detail?.name],
            },
          ],
        }),
      }),
    enabled: !!detail,
  });
  const columns: ColumnDef<Schema['EntityRow']>[] = [
    {
      accessorKey: 'name',
      header: kind === 'customers' ? 'CUSTOMER' : 'PRODUCT',
      cell: ({ row }) => (
        <button className="text-link" onClick={() => setDetail(row.original)}>
          {row.original.name}
        </button>
      ),
    },
    {
      accessorKey: 'revenue',
      header: 'NET REVENUE',
      cell: (c) => money(c.getValue<string>(), locale, 2),
    },
    { accessorKey: 'orders', header: 'ORDERS', cell: (c) => number(c.getValue<number>(), locale) },
    { accessorKey: 'units', header: 'UNITS' },
    {
      accessorKey: 'first_order',
      header: 'FIRST PURCHASE',
      cell: (c) => dateLabel(c.getValue<string>(), dateFormat),
    },
    {
      accessorKey: 'last_order',
      header: 'LATEST PURCHASE',
      cell: (c) => dateLabel(c.getValue<string>(), dateFormat),
    },
  ];
  return (
    <>
      <PageHeading
        eyebrow={kind === 'customers' ? 'PEOPLE BEHIND THE NUMBERS' : 'KNOW WHAT RESONATES'}
        title={title}
        description={
          kind === 'customers'
            ? 'Meet the customers who keep your business moving.'
            : 'See which products turn interest into impact.'
        }
      />
      <PeriodFilter period={period} />
      <Panel
        title={kind === 'customers' ? 'Customer revenue' : 'Product performance'}
        subtitle="Ranked by net revenue in the selected period. Select a name to explore."
      >
        <div className="table-filters">
          <label className="search-field">
            <Search size={16} />
            <input
              aria-label={`Search ${kind}`}
              placeholder={`Search ${kind}…`}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <span className="muted">
            {result.data?.total || 0} {kind}
          </span>
        </div>
        {result.isPending ? (
          <Loading />
        ) : result.error ? (
          <ErrorState error={result.error} />
        ) : (
          <>
            <DataTable data={result.data.items} columns={columns} />
            <Pagination page={page} total={result.data.total} onPage={setPage} />
          </>
        )}
      </Panel>
      <Dialog
        open={!!detail}
        onOpenChange={(open) => {
          if (!open) setDetail(null);
        }}
        title={detail?.name || 'Detail'}
        description="Purchase activity within your selected date range."
      >
        {detail && (
          <>
            <div className="metric-strip">
              <div>
                <span>Net revenue</span>
                <strong>{money(detail.revenue, locale)}</strong>
              </div>
              <div>
                <span>Orders</span>
                <strong>{detail.orders}</strong>
              </div>
              <div>
                <span>Units</span>
                <strong>{detail.units}</strong>
              </div>
            </div>
            {selected.isPending ? (
              <Loading />
            ) : selected.error ? (
              <ErrorState error={selected.error} />
            ) : (
              <Chart locale={locale} points={selected.data?.points || []} title="Purchase trend" />
            )}
          </>
        )}
      </Dialog>
    </>
  );
}
