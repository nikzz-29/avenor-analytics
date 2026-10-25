import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { QueryControls } from '@/features/query-controls';
import { PeriodFilter } from '@/features/common';
import { defaultQuery } from '@/lib/api';
vi.mock('@/features/workspace-context', () => ({
  useWorkspace: () => ({ base: '/workspaces/test', workspace: { id: 'test' } }),
}));
function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  client.setQueryData(['/workspaces/test', 'datasets'], []);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('query forms', () => {
  it('adding a filter must not submit the surrounding report/widget form', () => {
    const submit = vi.fn();
    render(
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <QueryControls value={defaultQuery} onChange={vi.fn()} />
      </form>,
      { wrapper },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add filter' }));
    expect(submit).not.toHaveBeenCalled();
  });
  it('removing a filter must not submit the surrounding form', () => {
    const submit = vi.fn();
    render(
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <QueryControls
          value={{ ...defaultQuery, filters: [{ field: 'category', op: 'eq', values: ['Home'] }] }}
          onChange={vi.fn()}
        />
      </form>,
      { wrapper },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Remove filter 1' }));
    expect(submit).not.toHaveBeenCalled();
  });
  it('a comma is literal for equals, and a separator for IN', () => {
    const change = vi.fn();
    render(
      <QueryControls
        value={{ ...defaultQuery, filters: [{ field: 'product_name', op: 'eq', values: [''] }] }}
        onChange={change}
      />,
      { wrapper },
    );
    fireEvent.change(screen.getByLabelText('Filter 1 value'), { target: { value: 'Lamp, large' } });
    expect(change.mock.lastCall?.[0].filters[0].values).toEqual(['Lamp, large']);
  });
});

it('the date preset reflects a manually edited custom period', () => {
  const base = {
    start: '2025-01-01',
    end: '2025-12-31',
    setStart: vi.fn(),
    setEnd: vi.fn(),
    setRange: vi.fn(),
    ready: true,
    params: '',
  };
  const { rerender } = render(<PeriodFilter period={base} />, { wrapper });
  fireEvent.change(screen.getByLabelText('Date preset'), { target: { value: 'q4' } });
  rerender(<PeriodFilter period={{ ...base, start: '2025-11-01' }} />);
  expect(screen.getByLabelText('Date preset')).toHaveValue('custom');
});
