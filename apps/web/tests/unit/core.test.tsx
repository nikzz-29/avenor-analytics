import { describe, expect, it, vi, afterEach } from 'vitest';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { usePagination } from '@/features/common';
import { api, ApiError, money, number } from '@/lib/api';
import { DataTable } from '@/features/tables';
import { Dialog } from '@/components/ui/dialog';
import { Empty, ErrorState } from '@/components/ui/states';
afterEach(() => vi.unstubAllGlobals());
describe('formatting', () => {
  it('distinguishes missing money from zero', () => {
    expect(money(null)).toBe('Not available');
    expect(money(0)).toBe('$0');
  });
  it('respects number locale', () => {
    expect(number(1234, 'de-DE')).toBe('1.234');
  });
});
describe('API boundary', () => {
  it('includes CSRF for mutations and parses responses', async () => {
    document.cookie = 'avenor_csrf=csrf-test; path=/';
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    expect(await api('/example', { method: 'POST', body: '{}' })).toEqual({ ok: true });
    expect((fetch.mock.calls[0][1].headers as Headers).get('x-csrf-token')).toBe('csrf-test');
  });
  it('exposes server field errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            detail: 'Invalid',
            errors: [{ field: 'body.email', message: 'Invalid email' }],
          }),
          { status: 422 },
        ),
      ),
    );
    await expect(api('/example')).rejects.toThrow('email: Invalid email');
  });
  it('preserves the HTTP status', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ detail: 'Please sign in' }), { status: 401 }),
        ),
    );
    try {
      await api('/auth/me');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(401);
    }
  });
});
describe('real table interactions', () => {
  it('allows hiding a column', () => {
    render(
      <DataTable
        data={[{ name: 'Lamp', units: 7 }]}
        columns={[
          { accessorKey: 'name', header: 'PRODUCT' },
          { accessorKey: 'units', header: 'UNITS' },
        ]}
      />,
    );
    expect(screen.getByText('Lamp')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Columns +'));
    fireEvent.click(screen.getByLabelText('units'));
    expect(screen.queryByRole('columnheader', { name: 'UNITS' })).not.toBeInTheDocument();
  });
  it('provides a useful empty state', () => {
    render(<DataTable data={[]} columns={[{ id: 'name', header: 'Product' }]} />);
    expect(screen.getByText('No matching records')).toBeVisible();
  });
});
describe('accessible states and dialog', () => {
  it('retries failures', () => {
    const retry = vi.fn();
    render(<ErrorState error={new Error('Try later')} retry={retry} />);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalledOnce();
    expect(screen.getByRole('alert')).toHaveTextContent('Try later');
  });
  it('labels the modal and closes through its close action', () => {
    const onOpenChange = vi.fn();
    render(
      <Dialog open onOpenChange={onOpenChange} title="A saved view">
        <p>Details</p>
      </Dialog>,
    );
    expect(screen.getByRole('dialog', { name: 'A saved view' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
  it('renders actionable empty text', () => {
    render(<Empty title="No reports" description="Create a report to keep an insight." />);
    expect(screen.getByText('Create a report to keep an insight.')).toBeVisible();
  });
});

it('resets pagination when the date range changes', () => {
  const { result, rerender } = renderHook(({ key }) => usePagination(key), {
    initialProps: { key: 'year' },
  });
  act(() => result.current[1](5));
  expect(result.current[0]).toBe(5);
  rerender({ key: 'quarter' });
  expect(result.current[0]).toBe(1);
  rerender({ key: 'year' });
  expect(result.current[0]).toBe(1);
});

it('shows precise financial detail when cents are requested', () => {
  expect(money('20.50', 'en-US', 2)).toBe('$20.50');
  expect(money('20.50', 'de-DE', 2)).toContain('20,50');
});
