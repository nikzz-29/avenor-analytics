'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowDownRight,
  ArrowUpRight,
  ArrowRight,
  Clock3,
  Database,
  Plus,
  TrendingUp,
} from 'lucide-react';
import { useState } from 'react';
import { Chart } from '@/components/charts/chart';
import { Button } from '@/components/ui/button';
import { ErrorState, Loading } from '@/components/ui/states';
import { api, defaultQuery, download, money, number, type Schema, type Point } from '@/lib/api';
import { useToast } from '@/providers/providers';
import { useWorkspace } from './workspace-context';
import { PageHeading, Panel, PeriodFilter, usePeriod } from './common';
function Sparkline({ points }: { points: Point[] }) {
  const nums = points.map((p) => Number(p.value));
  if (nums.length < 2) return null;
  const max = Math.max(...nums, 1),
    min = Math.min(...nums);
  const coordinates = nums
    .map((n, i) => `${(i / (nums.length - 1)) * 100},${30 - ((n - min) / (max - min || 1)) * 24}`)
    .join(' ');
  return (
    <svg viewBox="0 0 100 34" aria-hidden="true" className="sparkline">
      <polyline
        points={coordinates}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
export function Overview() {
  const { base, workspace, user, locale, canEdit } = useWorkspace();
  const toast = useToast();
  const period = usePeriod();
  const [grouping, setGrouping] = useState('month');
  const query = useQuery({
    queryKey: [base, 'overview', period.params, grouping],
    queryFn: () =>
      api<Schema['OverviewOut']>(
        `${base}/analytics/overview?${period.params}&grouping=${grouping}`,
      ),
  });
  const top = useQuery({
    queryKey: [base, 'top-products', period.params],
    queryFn: () =>
      api<Schema['EntityPage']>(`${base}/analytics/entities/products?${period.params}&page_size=5`),
  });
  const activity = useQuery({
    queryKey: [base, 'activity'],
    queryFn: () => api<Schema['ActivityOut'][]>(`${base}/activity`),
  });
  const data = query.data;
  const current = data?.current;
  const previous = data?.previous;
  const cards =
    current && previous
      ? [
          {
            label: 'Net revenue',
            value: money(current.revenue, locale),
            now: Number(current.revenue),
            before: Number(previous.revenue),
            hint: 'Paid and refunded line sales, less discounts and refunds. Excludes pending and cancelled.',
          },
          {
            label: 'Orders',
            value: number(current.orders, locale),
            now: current.orders,
            before: previous.orders,
            hint: 'Distinct paid or refunded orders. Multiple product lines count as one order.',
          },
          {
            label: 'Average order value',
            value: money(current.aov, locale),
            now: Number(current.aov || 0),
            before: Number(previous.aov || 0),
            hint: 'Net sales revenue divided by eligible order count.',
          },
          {
            label: 'Active customers',
            value: number(current.customers, locale),
            now: current.customers,
            before: previous.customers,
            hint: 'Distinct customers with at least one eligible order in the selected period.',
          },
        ]
      : [];
  return (
    <>
      <PageHeading
        eyebrow="THE BIG PICTURE"
        title="Overview"
        description={`Good to see you, ${user.name.split(' ')[0]}. Here’s how your business is doing.`}
      >
        <Button asChild variant="outline">
          <Link href="/workspace/data-sources">
            <Database size={16} />
            Manage data
          </Link>
        </Button>
        {canEdit && (
          <Button asChild>
            <Link href="/workspace/dashboards">
              <Plus size={16} />
              Create dashboard
            </Link>
          </Button>
        )}
      </PageHeading>
      <PeriodFilter
        period={period}
        grouping={grouping}
        setGrouping={setGrouping}
        exportData={() =>
          download(`${base}/analytics/export`, {
            ...defaultQuery,
            start: period.start,
            end: period.end,
            grouping: grouping as 'month',
          }).catch((e) => toast(e.message, true))
        }
      />
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => query.refetch()} />
      ) : (
        data && (
          <>
            <div className="section-caption">
              <span>
                <span className="live-dot" />
                WORKSPACE PERFORMANCE
              </span>
              <span>{workspace.currency} · Compared with previous period</span>
            </div>
            <div className="kpi-grid">
              {cards.map((c, i) => {
                const growth = c.before ? ((c.now - c.before) / c.before) * 100 : null;
                return (
                  <section className="kpi-card" key={c.label}>
                    <div className="kpi-label">
                      <h2>{c.label}</h2>
                      <span title={c.hint} tabIndex={0} aria-label={c.hint}>
                        ⓘ
                      </span>
                    </div>
                    <div className="kpi-value">{c.value}</div>
                    <div className="kpi-bottom">
                      <span
                        className={growth == null ? 'muted' : growth >= 0 ? 'positive' : 'negative'}
                      >
                        {growth == null ? (
                          'No prior-period baseline'
                        ) : (
                          <>
                            {growth >= 0 ? (
                              <ArrowUpRight size={13} />
                            ) : (
                              <ArrowDownRight size={13} />
                            )}{' '}
                            {Math.abs(growth).toFixed(1)}%
                          </>
                        )}
                      </span>
                      {i === 0 ? (
                        <Sparkline points={data.trend} />
                      ) : (
                        <span className="kpi-context">vs. previous period</span>
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
            <div className="chart-grid">
              <Panel
                title="Revenue over time"
                subtitle="A clearer view of your momentum."
                className="revenue-panel"
                action={
                  <span className="chart-legend">
                    <i />
                    Net revenue <i className="previous-dot" />
                    Previous period
                  </span>
                }
              >
                <div className="chart-summary">
                  <strong>{money(data.current.revenue, locale)}</strong>
                  <span className="muted">across {number(data.current.orders)} orders</span>
                  {data.revenue_growth != null && (
                    <span className={Number(data.revenue_growth) >= 0 ? 'positive' : 'negative'}>
                      <TrendingUp size={14} />
                      {Number(data.revenue_growth).toFixed(1)}%
                    </span>
                  )}
                </div>
                <Chart
                  points={data.trend}
                  comparison={data.comparison}
                  title="Net revenue"
                  height={270}
                />
              </Panel>
              <Panel
                title="Sales by category"
                subtitle="Where your revenue comes from."
                action={<span className="subtle-label">NET SALES</span>}
              >
                <Chart
                  points={data.categories}
                  type="horizontal"
                  title="Category revenue"
                  height={325}
                />
              </Panel>
            </div>
            <div className="detail-grid">
              <Panel
                title="Top products"
                subtitle="The pieces making an impact."
                action={
                  <Link className="text-link" href="/workspace/products">
                    View products <ArrowRight size={14} />
                  </Link>
                }
              >
                {top.error ? (
                  <ErrorState error={top.error} />
                ) : (
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>PRODUCT</th>
                          <th>UNITS SOLD</th>
                          <th>NET REVENUE</th>
                          <th>SHARE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {top.data?.items.map((p, i) => (
                          <tr key={p.name}>
                            <td>
                              <div className="product-cell">
                                <span className={`product-swatch swatch-${i % 4}`}>
                                  <span>{p.name.slice(0, 1)}</span>
                                </span>
                                <strong>{p.name}</strong>
                              </div>
                            </td>
                            <td>{number(p.units, locale)}</td>
                            <td className="table-number">{money(p.revenue, locale)}</td>
                            <td>
                              <div className="share-cell">
                                <span>
                                  {Number(data.current.revenue)
                                    ? (
                                        (Number(p.revenue) / Number(data.current.revenue)) *
                                        100
                                      ).toFixed(1)
                                    : '0'}
                                  %
                                </span>
                                <span className="share-track">
                                  <i
                                    style={{
                                      width: `${Math.min(100, Number(data.current.revenue) ? (Number(p.revenue) / Number(data.current.revenue)) * 100 * 3 : 0)}%`,
                                    }}
                                  />
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {top.data?.items.length === 0 && (
                      <p className="empty-inline">No eligible sales in this period.</p>
                    )}
                  </div>
                )}
              </Panel>
              <Panel title="Sales channels" subtitle="Every path to a purchase.">
                <Chart
                  points={data.channels}
                  type="donut"
                  title="Revenue by channel"
                  height={235}
                />
                <div className="channel-total">
                  <span className="muted">Across all channels</span>
                  <strong>{money(data.current.revenue, locale)}</strong>
                </div>
              </Panel>
            </div>
            <div className="bottom-grid">
              <Panel title="A few more signals" subtitle="Context behind the headline numbers.">
                <div className="signal-grid">
                  <div>
                    <span>Units sold</span>
                    <strong>{number(data.current.units, locale)}</strong>
                  </div>
                  <div>
                    <span>Returning customers</span>
                    <strong>{number(data.current.returning_customers, locale)}</strong>
                    <small>Purchased before this period</small>
                  </div>
                  <div>
                    <span>Refunds</span>
                    <strong>{money(data.current.refunds, locale)}</strong>
                  </div>
                  <div>
                    <span>Revenue growth</span>
                    <strong>
                      {data.revenue_growth == null
                        ? 'Not available'
                        : `${Number(data.revenue_growth).toFixed(1)}%`}
                    </strong>
                    <small>vs. previous period</small>
                  </div>
                </div>
              </Panel>
              <Panel title="Workspace activity" action={<Clock3 size={15} className="muted" />}>
                <div className="activity-list">
                  {activity.data?.map((item) => (
                    <div key={item.id}>
                      <span className="activity-dot" />
                      <div>
                        <p>{item.action}</p>
                        <small>
                          {new Date(item.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </small>
                      </div>
                    </div>
                  ))}
                  {activity.data?.length === 0 && (
                    <p className="muted">Your workspace activity will appear here.</p>
                  )}
                  {activity.error && <p role="alert">{activity.error.message}</p>}
                </div>
              </Panel>
            </div>
          </>
        )
      )}
    </>
  );
}
