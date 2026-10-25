'use client';
import { CalendarDays, ArrowDownToLine, RefreshCw } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { api, type Schema } from '@/lib/api';
import { useWorkspace } from './workspace-context';
import { motion, useReducedMotion } from 'motion/react';
export function PageHeading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className="page-heading"
      initial={reduced ? false : { opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        <p className="muted">{description}</p>
      </div>
      <div className="heading-actions">{children}</div>
    </motion.div>
  );
}
export function usePeriod() {
  const { base } = useWorkspace();
  const bounds = useQuery({
    queryKey: [base, 'period'],
    queryFn: () => api<Schema['DataPeriod']>(`${base}/analytics/period`),
  });
  const year = new Date().getUTCFullYear();
  const defaults = bounds.data || { start: `${year}-01-01`, end: `${year}-12-31` };
  const [custom, setCustom] = useState<{ start: string; end: string } | null>(null);
  const start = custom?.start || defaults.start,
    end = custom?.end || defaults.end;
  const setStart = (next: string) => setCustom({ start: next, end });
  const setEnd = (next: string) => setCustom({ start, end: next });
  const setRange = (nextStart: string, nextEnd: string) =>
    setCustom({ start: nextStart, end: nextEnd });
  return {
    start,
    end,
    setStart,
    setEnd,
    setRange,
    ready: custom !== null || !bounds.isPending,
    params: new URLSearchParams({ start, end }).toString(),
  };
}
export function PeriodFilter({
  period,
  exportData,
  grouping,
  setGrouping,
}: {
  period: ReturnType<typeof usePeriod>;
  exportData?: () => void;
  grouping?: string;
  setGrouping?: (value: string) => void;
}) {
  const client = useQueryClient();
  const year = new Date().getUTCFullYear();
  const today = new Date().toISOString().slice(0, 10);
  const preset =
    period.start === '2025-01-01' && period.end === '2025-12-31'
      ? '2025'
      : period.start === '2025-10-01' && period.end === '2025-12-31'
        ? 'q4'
        : period.start === `${year}-01-01` && period.end === today
          ? 'year'
          : 'custom';
  return (
    <div className="filterbar">
      <div className="date-fields">
        <CalendarDays size={15} />
        <label>
          <span className="sr-only">Start date</span>
          <input
            aria-label="Start date"
            type="date"
            value={period.start}
            max={period.end}
            onChange={(e) => {
              if (e.target.value) period.setStart(e.target.value);
            }}
          />
        </label>
        <span className="muted">—</span>
        <label>
          <span className="sr-only">End date</span>
          <input
            aria-label="End date"
            type="date"
            value={period.end}
            min={period.start}
            onChange={(e) => {
              if (e.target.value) period.setEnd(e.target.value);
            }}
          />
        </label>
      </div>
      <select
        aria-label="Date preset"
        value={preset}
        onChange={(e) => {
          const value = e.target.value;
          if (value === '2025') {
            period.setRange('2025-01-01', '2025-12-31');
          } else if (value === 'q4') {
            period.setRange('2025-10-01', '2025-12-31');
          } else if (value === 'year') {
            period.setRange(`${year}-01-01`, today);
          }
        }}
      >
        <option value="custom" disabled>
          Custom period
        </option>
        <option value="2025">Demo year · 2025</option>
        <option value="q4">Demo · Last quarter</option>
        <option value="year">This year</option>
      </select>
      <div className="filter-spacer" />
      {setGrouping && (
        <select
          aria-label="Time grouping"
          value={grouping}
          onChange={(e) => setGrouping(e.target.value)}
        >
          <option value="day">Daily</option>
          <option value="week">Weekly</option>
          <option value="month">Monthly</option>
        </select>
      )}
      <Button
        variant="outline"
        size="icon"
        aria-label="Refresh data"
        onClick={() => client.invalidateQueries()}
      >
        <RefreshCw size={15} />
      </Button>
      {exportData && (
        <Button variant="outline" onClick={exportData}>
          <ArrowDownToLine size={15} />
          Export CSV
        </Button>
      )}
    </div>
  );
}
export function Panel({
  title,
  subtitle,
  action,
  children,
  className = '',
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function usePagination(resetKey: string) {
  const [state, setState] = useState({ key: resetKey, page: 1 });
  if (state.key !== resetKey) setState({ key: resetKey, page: 1 });
  const page = state.key === resetKey ? state.page : 1;
  return [page, (next: number) => setState({ key: resetKey, page: next })] as const;
}
