import { expect, test, type Page } from './fixtures';
import type { Dashboard, Workspace } from '../../src/lib/api';

async function request<T>(page: Page, path: string, method = 'GET', data?: unknown): Promise<T> {
  const cookies = await page.context().cookies();
  const csrf = cookies.find((c) => c.name === 'avenor_csrf')?.value || '';
  const result = await page.request.fetch(`/api/v1${path}`, {
    method,
    headers: { 'x-csrf-token': csrf },
    data,
  });
  expect(result.ok(), `${method} ${path} returned ${result.status()}`).toBeTruthy();
  return result.json() as Promise<T>;
}
async function demo(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try the live demo' }).click();
  await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
  const workspaces = await request<Workspace[]>(page, '/workspaces');
  return `/workspaces/${workspaces[0].id}`;
}

test('dashboard drafts survive cancelled navigation, rename cancellation, and slow saves', async ({
  page,
}) => {
  const base = await demo(page);
  const board = await request<Dashboard>(page, base + '/dashboards', 'POST', {
    name: 'Audit board',
    widgets: [],
  });
  await page.goto(`/workspace/dashboards/${board.id}`);
  await page.getByRole('button', { name: 'Rename', exact: true }).click();
  await page.getByLabel('Dashboard name').fill('Cancelled rename');
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await expect(page.getByRole('heading', { name: 'Audit board', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Rename', exact: true }).click();
  await page.getByLabel('Dashboard name').fill('Unsaved board');
  await page.getByRole('button', { name: 'Apply name' }).click();
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('link', { name: 'Reports', exact: true }).click();
  await expect(page).toHaveURL(`/workspace/dashboards/${board.id}`);
  await expect(page.getByRole('heading', { name: 'Unsaved board', exact: true })).toBeVisible();
  let resume!: () => void;
  const gate = new Promise<void>((resolve) => {
    resume = resolve;
  });
  await page.route(`**/api/v1${base}/dashboards/${board.id}`, async (route) => {
    if (route.request().method() === 'PATCH') await gate;
    await route.continue();
  });
  await page.getByRole('button', { name: 'Save layout', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Rename', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Add widget', exact: true })).toBeDisabled();
  resume();
  await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Unsaved board', exact: true })).toBeVisible();
});

test('a dirty dashboard warns before changing workspaces', async ({ page }) => {
  const base = await demo(page);
  const second = await request<Workspace>(page, '/workspaces', 'POST', {
    name: 'Another workspace',
  });
  const board = await request<Dashboard>(page, base + '/dashboards', 'POST', {
    name: 'Workspace draft',
    widgets: [],
  });
  await page.goto(`/workspace/dashboards/${board.id}`);
  await page.getByRole('button', { name: 'Rename', exact: true }).click();
  await page.getByLabel('Dashboard name').fill('Keep this draft');
  await page.getByRole('button', { name: 'Apply name' }).click();
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByLabel('Current workspace').selectOption(second.id);
  await expect(page.getByLabel('Current workspace')).not.toHaveValue(second.id);
  await expect(page.getByRole('heading', { name: 'Keep this draft', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Save layout', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();
});

test('query filters do not submit reports and Explorer invalidates saved views', async ({
  page,
}) => {
  const base = await demo(page);
  // Warm the report list before saving from another feature.
  await page.getByRole('link', { name: 'Reports', exact: true }).click();
  await page.getByRole('button', { name: 'Create report', exact: true }).click();
  await page.getByLabel('Report name').fill('Filtered report');
  await page.getByRole('button', { name: 'Add filter', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByLabel('Filter 1 value').fill('Home & living');
  await page.getByRole('button', { name: 'Save report', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Filtered report', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Data explorer', exact: true }).click();
  await page.getByRole('button', { name: 'Save as report', exact: true }).click();
  await page.getByLabel('Report name').fill('Explorer saved report');
  await page.getByRole('button', { name: 'Save report', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('link', { name: 'Reports', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Explorer saved report', exact: true }),
  ).toBeVisible();
  const board = await request<Dashboard>(page, base + '/dashboards', 'POST', {
    name: 'Explorer board',
    widgets: [],
  });
  await page.getByRole('link', { name: 'Data explorer', exact: true }).click();
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: 'Add to dashboard', exact: true }).click();
    await page.getByRole('button', { name: 'Explorer board', exact: true }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
  }
  const saved = await request<Dashboard>(page, base + '/dashboards/' + board.id);
  expect(saved.widgets).toHaveLength(2);
});

test('Excel mapping uses real dates and imported cents remain visible', async ({ page }) => {
  await page.goto('/sign-up');
  await page.getByLabel('Full name').fill('Import Auditor');
  await page.getByLabel('Email address').fill(`import-audit-${Date.now()}@example.com`);
  await page.getByLabel('Password', { exact: true }).fill('audit-password-2026');
  await page.getByRole('button', { name: 'Create your account' }).click();
  await expect(page.getByRole('heading', { name: 'Make room for clarity.' })).toBeVisible();
  await page.getByLabel('Workspace name').fill('Fresh 2026 data');
  await page.getByRole('button', { name: 'Create workspace', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Data sources', exact: true }).click();
  await page.getByRole('button', { name: 'Import dataset', exact: true }).click();
  await page.getByLabel('Choose sales file').setInputFiles('tests/fixtures/sales-audit.xlsx');
  for (const [field, column] of Object.entries({
    order_id: 'Order',
    order_date: 'Date',
    customer_id: 'Customer',
    product_name: 'Product',
    quantity: 'Qty',
    unit_price: 'Price',
  }))
    await page.getByLabel(`Map ${field}`, { exact: true }).selectOption(column);
  await page.getByRole('button', { name: 'Validate data', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Everything checks out.' })).toBeVisible();
  await page.getByRole('button', { name: 'Confirm import', exact: true }).click();
  await expect(page.getByRole('heading', { name: '2 lines. A new perspective.' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to data sources' }).click();
  await page.getByRole('link', { name: 'Overview', exact: true }).click();
  await expect(page.getByLabel('Start date')).toHaveValue('2026-01-01');
  await expect(page.getByLabel('End date')).toHaveValue('2026-12-31');
  await expect(page.locator('.kpi-value').nth(1)).toHaveText('2');
  await page.getByRole('link', { name: 'Sales', exact: true }).click();
  await expect(page.getByRole('cell', { name: '$20.50', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Data explorer', exact: true }).click();
  await page.getByRole('button', { name: 'Add filter', exact: true }).click();
  await page.getByLabel('Filter 1 field').selectOption('product_name');
  await page.getByLabel('Filter 1 value').fill('Lamp, large');
  await page.getByRole('button', { name: 'Run query', exact: true }).click();
  await page.getByLabel('Visualization type').selectOption('table');
  await expect(page.getByRole('cell', { name: '$20.50', exact: true })).toBeVisible();
});

test('a deleted default dashboard does not stay selected in the workspace', async ({ page }) => {
  const base = await demo(page);
  const board = await request<Dashboard>(page, base + '/dashboards', 'POST', {
    name: 'Delete default',
    widgets: [],
  });
  await page.goto(`/workspace/dashboards/${board.id}`);
  await page.getByRole('button', { name: 'Set as default dashboard', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Default dashboard', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'All dashboards' }).click();
  await page.getByRole('button', { name: 'Delete Delete default', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Delete dashboard', exact: true })
    .click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.goto('/workspace');
  await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
});

test('resetting demo clears the cached default dashboard too', async ({ page }) => {
  const base = await demo(page);
  const board = await request<Dashboard>(page, base + '/dashboards', 'POST', {
    name: 'Reset default',
    widgets: [],
  });
  await page.goto(`/workspace/dashboards/${board.id}`);
  await page.getByRole('button', { name: 'Set as default dashboard', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Default dashboard', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Data sources', exact: true }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Reset demo', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText(/Demo reset/);
  await page.goto('/workspace');
  await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
});

test('every workspace section fits mobile, tablet and desktop viewports', async ({ page }) => {
  await demo(page);
  const sections = [
    'overview',
    'analytics',
    'sales',
    'customers',
    'products',
    'data-sources',
    'dashboards',
    'reports',
    'settings',
  ];
  for (const width of [360, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const section of sections) {
      await page.goto(`/workspace/${section}`);
      await expect(page.locator('#main h1')).toBeVisible();
      await expect(page.locator('.loading-state')).toHaveCount(0);
      await expect
        .poll(
          () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
          { message: `Overflow in ${section} at ${width}px` },
        )
        .toBe(true);
    }
  }
});
