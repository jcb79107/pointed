import { expect, test } from '@playwright/test';

for (const timezoneId of ['America/Chicago', 'Asia/Tokyo']) {
  test.describe(timezoneId, () => {
    test.use({ timezoneId });

    test('cycle dates retain UTC days through hydration and refresh; backlog has no dates', async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => {
        if (message.type() === 'error' && /hydrat|Minified React error/i.test(message.text())) errors.push(message.text());
      });
      await page.route('**/api/slack/connection', route => route.fulfill({ json: { destination: null } }));
      await page.goto('http://127.0.0.1:3005/?scenario=cycle-dates');
      for (let visit = 0; visit < 2; visit++) {
        await expect(page.locator('.cycle-resolved')).toContainText('Oct 14 – Oct 28');
        await page.getByRole('combobox', { name: 'Cycle', exact: true }).selectOption('2');
        await expect(page.getByRole('status').filter({ hasText: 'Load the new source before starting.' })).toBeVisible();
        await expect(page.locator('.cycle-resolved')).toContainText('Oct 14 – Oct 28');
        expect(errors).toEqual([]);
        if (visit === 0) await page.reload();
      }
      await page.goto('http://127.0.0.1:3005/?scenario=backlog');
      await expect(page.locator('.cycle-resolved')).toHaveText('Backlog / no cycle');
      expect(errors).toEqual([]);
    });
  });
}
