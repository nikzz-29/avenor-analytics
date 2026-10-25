import { test as base, expect } from '@playwright/test';
export type { Page } from '@playwright/test';
export { expect };

export const test = base.extend<{ runtimeErrors: void }>({
  runtimeErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(`JavaScript: ${error.message}`));
      page.on('response', (response) => {
        if (response.status() >= 500)
          errors.push(`HTTP ${response.status()} ${new URL(response.url()).pathname}`);
      });
      await use();
      expect(
        errors,
        'No unhandled JavaScript errors or server errors during the browser journey',
      ).toEqual([]);
    },
    { auto: true },
  ],
});
