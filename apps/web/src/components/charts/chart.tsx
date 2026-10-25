'use client';
import dynamic from 'next/dynamic';
import { useTheme } from 'next-themes';
import { useSyncExternalStore } from 'react';
import { money, number, type Point } from '@/lib/api';
import { Empty } from '@/components/ui/states';
const ReactECharts = dynamic(() => import('echarts-for-react'), {
  ssr: false,
  loading: () => <div className="chart-placeholder" />,
});
const subscribe = (callback: () => void) => {
  const m = window.matchMedia('(prefers-reduced-motion: reduce)');
  m.addEventListener('change', callback);
  return () => m.removeEventListener('change', callback);
};
export function Chart({
  points,
  type = 'area',
  title = 'Revenue',
  height = 280,
  currency = true,
  comparison = [],
  total,
}: {
  points: Point[];
  type?: string;
  title?: string;
  height?: number;
  currency?: boolean;
  comparison?: Point[];
  total?: string | number | null;
}) {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === 'dark';
  const reduced = useSyncExternalStore(
    subscribe,
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => false,
  );
  const text = dark ? '#a6b4ab' : '#738078';
  const border = dark ? '#303a33' : '#e9eeea';
  const accent = dark ? '#62c5ae' : '#147d70';

  if (type === 'kpi')
    return (
      <div className="widget-kpi">
        {currency ? money(total) : number(total)}
        <small>{title}</small>
      </div>
    );
  if (!points.length)
    return (
      <Empty
        title="Nothing in this view"
        description="Choose another period or import more data."
      />
    );
  const table = (
    <table className="chart-data">
      <caption className="sr-only">{title} values</caption>
      <thead>
        <tr>
          <th>Dimension</th>
          <th>Value</th>
        </tr>
      </thead>
      <tbody>
        {points.map((p) => (
          <tr key={p.label}>
            <td>{p.label}</td>
            <td>{currency ? money(p.value) : number(p.value)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
  if (type === 'table') return <div className="table-scroll">{table}</div>;
  const horizontal = type === 'horizontal';
  const donut = type === 'donut';
  const labels = points.map((p) =>
    /^\d{4}-\d{2}-\d{2}$/.test(p.label)
      ? new Date(p.label + 'T00:00:00Z').toLocaleDateString('en-US', {
          month: 'short',
          day: points.every((point) => point.label.endsWith('-01')) ? undefined : 'numeric',
          timeZone: 'UTC',
        })
      : p.label,
  );
  const axis = {
    type: 'value',
    splitLine: { lineStyle: { color: border, type: 'dashed' } },
    axisLabel: {
      color: text,
      fontSize: 11,
      formatter: (v: number) =>
        currency ? `$${Math.abs(v) >= 1000 ? `${v / 1000}k` : v}` : number(v),
    },
  };
  const category = {
    type: 'category',
    data: labels,
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: {
      color: text,
      fontSize: 11,
      hideOverlap: true,
      width: horizontal ? 100 : 90,
      overflow: 'truncate',
    },
  };
  const option = {
    animation: !reduced,
    animationDuration: 350,
    color: [accent, '#91b5a5', '#d8b779', '#7b8f9e', '#baa994'],
    textStyle: { fontFamily: 'inherit' },
    tooltip: {
      trigger: donut ? 'item' : 'axis',
      backgroundColor: dark ? '#191f1b' : '#fff',
      borderColor: border,
      textStyle: { color: dark ? '#edf2ee' : '#18201d' },
      confine: true,
    },
    legend: donut
      ? { bottom: 0, textStyle: { color: text }, icon: 'circle', itemWidth: 8, itemHeight: 8 }
      : { show: false },
    grid: { top: 20, bottom: 30, left: horizontal ? 115 : 55, right: 20 },
    xAxis: donut ? undefined : horizontal ? axis : category,
    yAxis: donut ? undefined : horizontal ? category : axis,
    series: donut
      ? [
          {
            type: 'pie',
            radius: ['55%', '74%'],
            center: ['50%', '43%'],
            label: { show: false },
            itemStyle: { borderColor: dark ? '#191f1b' : '#fff', borderWidth: 4 },
            data: points.map((p) => ({ name: p.label, value: Number(p.value) })),
          },
        ]
      : [
          {
            name: title,
            type: ['line', 'area'].includes(type) ? 'line' : 'bar',
            smooth: 0.3,
            symbol: 'circle',
            symbolSize: 5,
            showSymbol: false,
            barMaxWidth: 32,
            stack: type === 'stacked' ? 'total' : undefined,
            itemStyle: { color: accent, borderRadius: horizontal ? [0, 3, 3, 0] : [3, 3, 0, 0] },
            areaStyle: type === 'area' ? { color: dark ? '#62c5ae15' : '#147d700d' } : undefined,
            lineStyle: { width: 2.5 },
            data: points.map((p) => Number(p.value)),
          },
          ...(comparison.length
            ? [
                {
                  name: 'Previous period',
                  type: 'line',
                  smooth: true,
                  showSymbol: false,
                  lineStyle: { color: '#a8b5ad', type: 'dashed', width: 1.5 },
                  itemStyle: { color: '#a8b5ad' },
                  data: comparison.map((p) => Number(p.value)),
                },
              ]
            : []),
        ],
  };
  return (
    <figure className="chart-figure" aria-label={title}>
      <ReactECharts option={option} style={{ height, width: '100%' }} notMerge />
      <details className="chart-values">
        <summary>View data table</summary>
        <div className="table-scroll">{table}</div>
      </details>
    </figure>
  );
}
