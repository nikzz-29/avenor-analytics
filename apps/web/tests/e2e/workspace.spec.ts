import { test, expect } from './fixtures';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync, mkdirSync } from 'node:fs';

test('demo → analytics → dashboard persistence → import → report export', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Clarity in/ })).toBeVisible();
  await page.getByRole('button', { name: 'Try the live demo' }).click();
  await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
  await expect(page.locator('.kpi-value').first()).toContainText('$');
  await expect(page.locator('.kpi-value').nth(1)).not.toHaveText('0');
  const yearRevenue = await page.locator('.kpi-value').first().textContent();
  await page.getByLabel('Date preset').selectOption('q4');
  await expect(page.locator('.kpi-value').first()).not.toHaveText(yearRevenue || '');
  await page.getByLabel('Date preset').selectOption('2025');
  await page.getByRole('link', { name: 'Sales', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sales', exact: true })).toBeVisible();
  await page.getByLabel('Search orders').fill('Arc Desk Lamp');
  await expect(
    page.getByRole('cell', { name: 'Arc Desk Lamp', exact: true }).first(),
  ).toBeVisible();
  await page.getByLabel('Order status').selectOption('paid');
  await expect(page.locator('.status-paid').first()).toContainText('paid');
  for (const section of ['Customers', 'Products']) {
    await page.getByRole('link', { name: section, exact: true }).click();
    await expect(page.locator('tbody tr').first()).toBeVisible();
  }
  await page.getByRole('link', { name: 'Data explorer', exact: true }).click();
  await page.getByRole('combobox', { name: 'Dimension', exact: true }).selectOption('category');
  await page.getByRole('button', { name: 'Run query' }).click();
  await expect(page.getByText('revenue by category', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Dashboards', exact: true }).click();
  await page.getByRole('button', { name: 'New dashboard', exact: true }).click();
  await page.getByLabel('Dashboard name', { exact: true }).fill('Executive pulse');
  await page.getByRole('button', { name: 'Create dashboard', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Executive pulse', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Add your first widget' }).click();
  await page.getByLabel('Widget title').fill('Category revenue');
  await page.getByRole('combobox', { name: 'Dimension', exact: true }).selectOption('category');
  await page.getByRole('button', { name: 'Apply widget' }).click();
  await expect(page.getByRole('heading', { name: 'Category revenue', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Resize Category revenue', exact: true }).click();
  await page.getByRole('button', { name: 'Save layout', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Category revenue', exact: true })).toBeVisible();
  await expect(page.locator('.dashboard-widget')).toHaveClass(/widget-width-2/);
  await page.getByRole('button', { name: 'Edit Category revenue', exact: true }).click();
  await page.getByLabel('Widget title').fill('Revenue by channel');
  await page.getByRole('combobox', { name: 'Dimension', exact: true }).selectOption('channel');
  await page.getByRole('button', { name: 'Apply widget' }).click();
  await page.getByRole('button', { name: 'Save layout', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Saved', exact: true })).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Revenue by channel', exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Data sources', exact: true }).click();
  await page.getByRole('button', { name: 'Import dataset', exact: true }).click();
  await page.getByLabel('Choose sales file').setInputFiles({
    name: 'portfolio-sales.csv',
    mimeType: 'text/csv',
    buffer: readFileSync('public/sample-sales.csv'),
  });
  await expect(page.getByLabel('Map order_id')).toHaveValue('order_id');
  await page.getByRole('button', { name: 'Validate data', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Everything checks out.' })).toBeVisible();
  await page.getByRole('button', { name: 'Confirm import', exact: true }).click();
  await expect(page.getByRole('heading', { name: '3 lines. A new perspective.' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to data sources' }).click();
  await expect(page.getByRole('button', { name: 'portfolio-sales', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Reports', exact: true }).click();
  await page.getByRole('button', { name: 'Create report', exact: true }).click();
  await page.getByLabel('Report name').fill('Monthly category view');
  await page.getByRole('combobox', { name: 'Dimension', exact: true }).selectOption('category');
  await page.getByRole('button', { name: 'Save report', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Monthly category view', exact: true }),
  ).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'CSV', exact: true }).click();
  const file = await download;
  expect(file.suggestedFilename()).toContain('.csv');
  const stream = await file.createReadStream();
  let text = '';
  for await (const chunk of stream!) text += chunk.toString();
  expect(text).toContain('category,revenue');
  expect(text).toContain('Home & living');
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Dark', exact: true }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark/);
  expect(errors).toEqual([]);
});

test('registration, workspace, demo data and persistent preferences', async ({ page }) => {
  await page.goto('/sign-up');
  await page.getByLabel('Full name').fill('Taylor Quinn');
  await page.getByLabel('Email address').fill(`taylor-${Date.now()}@example.com`);
  await page.getByLabel('Password', { exact: true }).fill('strong-passphrase-2026');
  await page.getByRole('button', { name: 'Create your account' }).click();
  await expect(page.getByRole('heading', { name: 'Make room for clarity.' })).toBeVisible();
  await page.getByLabel('Workspace name').fill('Taylor Studio');
  await page.getByRole('button', { name: 'Create workspace', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Data sources', exact: true }).click();
  await page.getByRole('button', { name: 'Load demo data' }).click();
  await expect(
    page.getByRole('button', { name: 'Studio Commerce · 2025', exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Full name').fill('Taylor Updated');
  await page.getByLabel('Number format').selectOption('de-DE');
  await page.getByRole('button', { name: 'Save preferences' }).click();
  await expect(page.getByRole('status')).toContainText('Preferences saved');
  await page.reload();
  await expect(page.getByLabel('Full name')).toHaveValue('Taylor Updated');
  await expect(page.getByLabel('Number format')).toHaveValue('de-DE');
  await page.getByRole('button', { name: 'Dark', exact: true }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL('/');
  await page.goto('/workspace/overview');
  await expect(page).toHaveURL('/sign-in');
});

test('responsive layouts, themes, accessible overview and screenshots', async ({ page }) => {
  mkdirSync('../../docs/screenshots', { recursive: true });
  await page.goto('/');
  await page.screenshot({ path: '../../docs/screenshots/landing.png', fullPage: true });
  await page.getByRole('button', { name: 'Try the live demo' }).click();
  await expect(page.locator('.kpi-value').first()).toContainText('$');
  await expect(page.locator('canvas').first()).toBeVisible();
  for (const width of [360, 390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), {
        message: `Page overflow at ${width}px`,
      })
      .toBe(true);
    if (width === 390 || width === 1440) {
      await page.screenshot({
        path: `../../docs/screenshots/overview-${width}-light.png`,
        fullPage: true,
      });
    }
  }
  const a11y = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(a11y.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }))).toEqual(
    [],
  );
  await page.getByRole('button', { name: 'Toggle color theme' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: '../../docs/screenshots/overview-1440-dark.png', fullPage: true });
  const darkA11y = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(darkA11y.violations.map((v) => v.id)).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('link', { name: 'Dashboards', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Dashboards', exact: true })).toBeVisible();
  await page.screenshot({ path: '../../docs/screenshots/dashboards-mobile.png', fullPage: true });
});
