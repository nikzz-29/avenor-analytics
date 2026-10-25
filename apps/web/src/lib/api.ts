import type { components } from './api-schema';
export type Schema = components['schemas'];
export type User = Schema['ProfileOut'];
export type Workspace = Schema['WorkspaceOut'];
export type AnalyticsQuery = Schema['QueryIn'];
export type Point = Schema['Point'];
export type Widget = Omit<
  Schema['Widget-Input'],
  'query' | 'type' | 'width' | 'height' | 'notes'
> & {
  query: AnalyticsQuery;
  type: NonNullable<Schema['Widget-Input']['type']>;
  width: 1 | 2;
  height: 1 | 2;
  notes: string;
};
export type Dashboard = Omit<Schema['DashboardOut'], 'widgets'> & { widgets: Widget[] };
export type Report = Schema['ReportOut'];

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const csrf =
    typeof document !== 'undefined'
      ? document.cookie
          .split('; ')
          .find((c) => c.startsWith('avenor_csrf='))
          ?.split('=')
          .slice(1)
          .join('=')
      : '';
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData))
    headers.set('Content-Type', 'application/json');
  if (csrf) headers.set('x-csrf-token', decodeURIComponent(csrf));
  const response = await fetch(`/api/v1${path}`, { ...options, headers, credentials: 'include' });
  if (!response.ok) {
    const body = await response
      .json()
      .catch(() => ({ detail: 'The server could not complete your request.' }));
    const fields = body.errors
      ?.map(
        (e: { field: string; message: string }) =>
          `${e.field.replace(/^body\./, '')}: ${e.message}`,
      )
      .join(' · ');
    throw new ApiError(
      fields || (typeof body.detail === 'string' ? body.detail : 'Please check your input.'),
      response.status,
    );
  }
  return response.json() as Promise<T>;
}
export async function download(
  path: string,
  query: AnalyticsQuery | Schema['SalesExportIn'],
  filename = 'avenor-report.csv',
) {
  const csrf =
    document.cookie
      .split('; ')
      .find((c) => c.startsWith('avenor_csrf='))
      ?.split('=')[1] || '';
  const response = await fetch(`/api/v1${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'x-csrf-token': decodeURIComponent(csrf) },
    body: JSON.stringify(query),
  });
  if (!response.ok) throw new Error('Export failed. Please refresh and try again.');
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
export const money = (
  value: string | number | null | undefined,
  locale = 'en-US',
  fractionDigits = 0,
) =>
  value == null
    ? 'Not available'
    : new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
      }).format(Number(value));
export const number = (value: string | number | null | undefined, locale = 'en-US') =>
  value == null
    ? '—'
    : new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(Number(value));
export const defaultQuery: AnalyticsQuery = {
  metric: 'revenue',
  dimension: 'date',
  grouping: 'month',
  sort: 'label',
  limit: 100,
  filters: [],
};

export function dateLabel(value: string, format = 'iso') {
  const [year, month, day] = value.slice(0, 10).split('-');
  return format === 'us'
    ? `${month}/${day}/${year}`
    : format === 'eu'
      ? `${day}/${month}/${year}`
      : `${year}-${month}-${day}`;
}
