import { test, expect } from '@playwright/test';

test('fallback polling pauses in hidden and offline tabs, then refreshes immediately on return', async ({ page }) => {
  let requests = 0;
  await page.route('**/api/sessions/*/snapshot', route => {
    requests++;
    return route.fulfill({ status: 503, json: { error: 'Synthetic unavailable snapshot' } });
  });
  await page.clock.install();
  await page.goto('http://127.0.0.1:3005/?screen=live');
  await expect(page.getByRole('heading', { name: 'Retry failed webhook deliveries', exact: true })).toBeVisible();
  await page.clock.runFor(5000);
  await expect.poll(() => requests).toBe(1);
  await expect(page.getByText('Reconnecting to the session…')).toBeVisible();
  await page.evaluate(() => Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }));
  await page.clock.runFor(15000);
  expect(requests).toBe(1);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => requests).toBe(2);
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
    window.dispatchEvent(new Event('offline'));
  });
  await expect(page.getByText('You’re offline. The session will reconnect automatically.')).toBeVisible();
  await page.clock.runFor(15000);
  expect(requests).toBe(2);
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => true });
    window.dispatchEvent(new Event('online'));
  });
  await expect.poll(() => requests).toBe(3);
});
