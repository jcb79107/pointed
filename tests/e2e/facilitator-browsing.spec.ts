import { test, expect, type Page } from '@playwright/test';

async function browseSecondTicket(page: Page) {
  if ((page.viewportSize()?.width ?? 0) <= 1180) {
    await page.getByLabel('Browse agenda').selectOption('q2');
  } else {
    await page.getByRole('button', { name: /02 Add workspace usage limits/ }).click();
  }
}

test('facilitator previews without disturbing votes, then explicitly moves the team', async ({ page }, testInfo) => {
  await page.route('**/api/**', route => route.abort('blockedbyclient'));
  await page.goto('/demo?role=voter');
  await page.getByRole('button', { name: '2 points, shortcut 2', exact: true }).click();
  await page.getByRole('link', { name: 'Facilitator', exact: true }).click();
  await browseSecondTicket(page);
  await expect(page.getByRole('status')).toContainText('The team is on API-342');
  await expect(page.getByRole('button', { name: 'Reveal early' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Skip', exact: true })).toHaveCount(0);
  await page.getByRole('heading', { name: 'Add workspace usage limits', exact: true }).click();
  await page.keyboard.press('r');
  await page.keyboard.press('n');
  await expect(page.getByRole('status')).toContainText('The team is on API-342');
  await page.getByRole('button', { name: 'Return to current ticket' }).click();
  await page.getByRole('link', { name: 'Participant', exact: true }).click();
  await expect(page.getByRole('button', { name: '2 points, shortcut 2', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('link', { name: 'Facilitator', exact: true }).click();
  await page.getByRole('button', { name: 'Reveal early' }).click();
  await browseSecondTicket(page);
  await expect(page.getByRole('button', { name: 'Save estimate & next' })).toHaveCount(0);
  await page.getByRole('heading', { name: 'Add workspace usage limits', exact: true }).click();
  await page.keyboard.press('n');
  await expect(page.getByRole('status')).toContainText('The team is on API-342');
  await page.screenshot({ path: testInfo.outputPath('facilitator-preview.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.getByRole('button', { name: 'Move team here' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.browse-notice')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Add workspace usage limits', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reveal early' })).toBeVisible();
  await page.getByRole('link', { name: 'Participant', exact: true }).click();
  await expect(page.getByRole('button', { name: '2 points, shortcut 2', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('button', { name: 'Move team here' })).toHaveCount(0);
});

test('live-room preview sends no action and failed move preserves the selected ticket', async ({ page }) => {
  const actions: unknown[] = [];
  await page.route('**/api/**', route => route.fulfill({ status: 503, json: { error: 'Synthetic service unavailable' } }));
  await page.route('**/api/sessions/*/actions', route => {
    actions.push(route.request().postDataJSON());
    return route.fulfill({ status: 503, json: { error: 'Synthetic move failure' } });
  });
  await page.goto('http://127.0.0.1:3005/?screen=live');
  await browseSecondTicket(page);
  await expect(page.getByRole('status')).toContainText('The team is on API-342');
  expect(actions).toEqual([]);
  await page.getByRole('button', { name: 'Move team here' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Synthetic move failure' })).toBeVisible();
  expect(actions).toEqual([{ action: 'activate', queueItemId: 'q2' }]);
  await expect(page.getByRole('status')).toContainText('The team is on API-342');
  await expect(page.getByRole('button', { name: 'Move team here' })).toBeEnabled();
  await page.getByRole('button', { name: 'Return to current ticket' }).click();
  await expect(page.getByRole('heading', { name: 'Retry failed webhook deliveries', exact: true })).toBeVisible();
});
