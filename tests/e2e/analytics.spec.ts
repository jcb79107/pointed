import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('Clarity requires consent, remembers decline, and stops on withdrawal', async ({ page }, testInfo) => {
  test.skip(!process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID, 'Requires isolated Clarity configuration');
  let requests = 0;
  await page.route('https://www.clarity.ms/**', route => {
    requests++;
    return route.fulfill({ contentType: 'application/javascript', body: `
      window.clarityCalls = [...(window.clarity.q || [])];
      window.clarity = (...args) => window.clarityCalls.push(args);
    ` });
  });
  await page.goto('/');
  const controls = page.getByRole('complementary', { name: 'Session analytics' });
  await expect(controls).toBeVisible();
  expect(requests).toBe(0);
  expect((await new AxeBuilder({ page }).include('.analytics-choice').analyze()).violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('analytics-choice.png') });
  expect(await controls.evaluate(el => el.getBoundingClientRect().right <= innerWidth)).toBe(true);
  await controls.getByRole('button', { name: 'Decline', exact: true }).click();
  await page.reload();
  await expect(controls).toHaveCount(0);
  expect(requests).toBe(0);
  await page.goto('/privacy');
  await controls.getByRole('button', { name: 'Allow analytics', exact: true }).click();
  await expect(controls.getByRole('status')).toContainText('on');
  await expect.poll(() => requests).toBe(1);
  await expect.poll(() => page.evaluate(() => (window as unknown as { clarityCalls: unknown[][] }).clarityCalls)).toContainEqual(['consentv2', { ad_Storage: 'denied', analytics_Storage: 'granted' }]);
  await controls.getByRole('button', { name: 'Turn off analytics' }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { clarityCalls: unknown[][] }).clarityCalls)).toContainEqual(['stop']);
  await expect(controls.getByRole('status')).toContainText('off');
  await page.reload();
  await expect(controls).toBeVisible();
  expect(requests).toBe(1);
});
