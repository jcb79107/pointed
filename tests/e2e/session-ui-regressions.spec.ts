import { test, expect } from '@playwright/test';
import type { SessionSnapshot } from '../../src/lib/domain';

const fixture = 'http://127.0.0.1:3005';

test('saved notices expire, replacements get a fresh timer, and dismissal works by keyboard', async ({ page, request }) => {
  const snapshot: SessionSnapshot = await (await request.get(`${fixture}/fixture-snapshot`)).json();
  await page.route('**/api/**', route => route.fulfill({ json: { snapshot } }));
  await page.route('**/api/sessions/*/actions', route => {
    const { action } = route.request().postDataJSON();
    if (action === 'reveal') snapshot.round!.status = 'revealed';
    return route.fulfill({ json: { snapshot } });
  });
  await page.clock.install();
  await page.goto(`${fixture}/?screen=live`);
  await page.getByRole('button', { name: 'Refresh ticket preview from Linear', exact: true }).click();
  await expect(page.locator('.room-notice')).toContainText('Ticket preview refreshed');
  await page.clock.runFor(2000);
  await page.getByRole('button', { name: 'Reveal early' }).click();
  await page.locator('.final-values').getByRole('button', { name: '2', exact: true }).click();
  await page.getByRole('button', { name: 'Save estimate & next' }).click();
  await expect(page.locator('.room-notice [role=status]')).toHaveText('API-342 saved to Linear.');
  await page.clock.runFor(2500);
  await expect(page.locator('.room-notice')).toBeVisible();
  await page.clock.runFor(1500);
  await expect(page.locator('.room-notice')).toHaveCount(0);
  await page.getByRole('button', { name: 'Refresh ticket preview from Linear', exact: true }).click();
  await page.getByRole('button', { name: 'Dismiss notification' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.room-notice')).toHaveCount(0);
});

test('summary contents and revisit buttons remain inset with no horizontal overflow', async ({ page, request }, testInfo) => {
  const snapshot: SessionSnapshot = await (await request.get(`${fixture}/fixture-snapshot`)).json();
  snapshot.status = 'ended';
  snapshot.activeItemId = null;
  snapshot.round = null;
  snapshot.queue = snapshot.queue.map((item, index) => ({ ...item, status: index ? 'skipped' : 'estimated', finalEstimate: index ? null : 2, elapsedSeconds: 368 }));
  await page.route('**/api/**', route => route.fulfill({ json: { snapshot } }));
  await page.goto(`${fixture}/?screen=live`);
  await page.getByRole('button', { name: 'Finish for now' }).click();
  await expect(page.getByRole('heading', { name: 'Session complete' })).toBeVisible();
  for (const row of await page.locator('.summary-item').all()) {
    const bounds = await row.boundingBox();
    for (const child of await row.locator('.summary-ticket > div, em, button').all()) {
      const box = await child.boundingBox();
      expect(box!.x - bounds!.x).toBeGreaterThanOrEqual(16);
      expect(bounds!.x + bounds!.width - box!.x - box!.width).toBeGreaterThanOrEqual(15);
    }
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('summary-spacing.png'), fullPage: true });
});

test('estimate conflicts require explicit confirmation and failed overwrites are not retried', async ({ page, request }) => {
  const snapshot: SessionSnapshot = await (await request.get(`${fixture}/fixture-snapshot`)).json();
  const saves: unknown[] = [];
  await page.route('**/api/**', route => route.fulfill({ json: { snapshot } }));
  await page.route('**/api/sessions/*/actions', route => {
    const input = route.request().postDataJSON();
    if (input.action === 'reveal') snapshot.round!.status = 'revealed';
    if (input.action === 'finalize') {
      saves.push(input);
      return route.fulfill({ status: 409, json: { error: 'Estimate changed in Linear' } });
    }
    return route.fulfill({ json: { snapshot } });
  });
  await page.goto(`${fixture}/?screen=live`);
  await page.getByRole('button', { name: 'Reveal early' }).click();
  await page.locator('.final-values').getByRole('button', { name: '2', exact: true }).click();
  await page.getByRole('button', { name: 'Save estimate & next' }).click();
  await expect(page.getByRole('dialog', { name: 'Estimate changed in Linear' })).toBeVisible();
  expect(saves).toEqual([{ action: 'finalize', estimate: 2 }]);
  await page.getByRole('button', { name: 'Save my estimate' }).click();
  await expect(page.locator('.room-error')).toHaveText('Estimate changed in Linear');
  await expect(page.getByRole('button', { name: 'Save estimate & next' })).toBeEnabled();
  expect(saves).toEqual([{ action: 'finalize', estimate: 2 }, { action: 'finalize', estimate: 2, overwrite: true }]);
});
