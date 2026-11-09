import { test, expect } from '@playwright/test';
import type { SessionSnapshot } from '../../src/lib/domain';
import { openRoomActions } from './helpers/room-actions';
const fixture = 'http://127.0.0.1:3005';

test('long summary titles stay inside their cards at 320px and 390px', async ({ page, request }, testInfo) => {
  const snapshot: SessionSnapshot = (await (await request.get(`${fixture}/api/fixture-snapshot`)).json()).snapshot;
  snapshot.status = 'ended'; snapshot.activeItemId = null; snapshot.round = null;
  snapshot.queue = snapshot.queue.map(item => ({ ...item, title: 'A long title with an unbroken identifier ' + 'x'.repeat(100), status: 'estimated', finalEstimate: 2 }));
  await page.route('**/api/**', route => route.fulfill({ json: { snapshot } }));
  await page.goto(`${fixture}/?screen=live`);
  await openRoomActions(page);
  await page.getByRole('button', { name: 'Finish for now' }).click();
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(page.getByRole('heading', { name: 'Session complete' })).toBeVisible();
    for (const row of await page.locator('.summary-item').all()) {
      expect(await row.evaluate(el => {
        const r = el.getBoundingClientRect();
        const title = el.querySelector('.summary-ticket > div > span')!;
        const b = title.getBoundingClientRect();
        return b.right <= r.right - 15 && b.left >= r.left + 15 && title.scrollWidth <= title.clientWidth + 1;
      })).toBe(true);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.screenshot({ path: testInfo.outputPath('long-summary-phone.png'), fullPage: true });
});

test('Slack previews the latest destination, sends once, and retains uncertain failure', async ({ page }, testInfo) => {
  let sends = 0;
  let fail = false;
  const destination = { connectionId: 'connection-2', workspaceName: 'Test workspace', channelName: '#planning', source: 'manual' };
  await page.route('**/api/slack/connection', route => route.fulfill({ json: { destination } }));
  await page.route('**/api/sessions/*/slack-invite', route => {
    sends++;
    expect(route.request().postDataJSON()).toEqual({ connectionId: 'connection-2' });
    return route.fulfill({ status: fail ? 503 : 200, json: fail ? { error: 'Check Slack before trying again.' } : { success: true } });
  });
  await page.goto(fixture);
  await page.getByRole('button', { name: 'Send to Slack', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Send session invite?' })).toContainText('Test workspace · #planning');
  expect(sends).toBe(0);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Send to Slack', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Send to Slack', exact: true }).click();
  await page.getByRole('button', { name: 'Send invite', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Invite sent to Test workspace' })).toBeVisible();
  expect(sends).toBe(1);
  fail = true;
  await page.getByRole('button', { name: 'Send to Slack', exact: true }).click();
  await page.getByRole('button', { name: 'Send invite', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Check Slack before trying again.');
  expect(sends).toBe(2);
  await page.screenshot({ path: testInfo.outputPath('slack-failure.png') });
  await page.keyboard.press('Escape');
  expect(sends).toBe(2);
});

test('manual Slack setup and help expose honest setup and return paths', async ({ page }) => {
  await page.route('**/api/slack/connection', route => route.fulfill({ json: { destination: null, oauthAvailable: false } }));
  await page.goto(`${fixture}/?screen=settings`);
  await expect(page.getByText(/Slack sign-in is not available on this deployment/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Pointed sessions' })).toHaveAttribute('href', '/sessions');
  await page.goto('/support');
  await expect(page.getByRole('link', { name: 'Back to sessions', exact: true })).toHaveAttribute('href', '/sessions');
  await expect(page.getByRole('link', { name: 'Pointed home', exact: true })).toHaveCount(2);
});
