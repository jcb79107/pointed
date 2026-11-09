import { expect, test } from '@playwright/test';

for (const [timezoneId, dates] of [
  ['America/Chicago', ['Oct 13', 'Oct 14']],
  ['Asia/Tokyo', ['Oct 14', 'Oct 15']],
] as const) {
  test.describe(timezoneId, () => {
    test.use({ timezoneId });

    test('session dates hydrate without errors and retain the browser calendar day', async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => {
        if (message.type() === 'error' && /hydrat|Minified React error/i.test(message.text())) errors.push(message.text());
      });
      await page.goto('http://127.0.0.1:3005/?screen=dashboard');
      for (let visit = 0; visit < 2; visit++) {
        await expect(page.locator('.session-meta')).toHaveText([...dates]);
        await page.getByRole('button', { name: 'New session', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Preview agenda', exact: true })).toBeVisible();
        expect(errors).toEqual([]);
        if (visit === 0) await page.reload();
      }
    });
  });
}
