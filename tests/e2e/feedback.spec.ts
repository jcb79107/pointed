import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('feedback explains attachments, preserves drafts, and sends nothing on cancel', async ({ page }, testInfo) => {
  let reports = 0;
  await page.route(/https:\/\/(?:[^/]+\.ingest\.us\.sentry\.io|sentry\.invalid)\//, route => { reports++; return route.fulfill({ status: 200, json: {} }); });
  await page.goto('/demo');
  const trigger = page.getByRole('button', { name: 'Send feedback', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('up to the last minute');
  await expect(dialog).toContainText('Replay is off by default');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).focus();
  await page.keyboard.press('r');
  await expect(page.locator('.final-values')).toHaveCount(0);
  await dialog.getByLabel('What happened, or what would you change?').fill('The queue jumps when I move a ticket.');
  await dialog.getByLabel('Screenshot').setInputFiles({ name: 'bad.txt', mimeType: 'text/plain', buffer: Buffer.from('not an image') });
  await expect(dialog.getByRole('alert')).toContainText('Choose a PNG');
  await dialog.getByLabel('Screenshot').setInputFiles({ name: 'screenshot.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII=', 'base64') });
  await expect(dialog.getByRole('button', { name: 'Remove screenshot' })).toBeVisible();
  expect((await new AxeBuilder({ page }).include('.feedback-dialog').analyze()).violations).toEqual([]);
  await page.screenshot({path:testInfo.outputPath('feedback-consent.png')});
  expect(await dialog.evaluate(el => el.getBoundingClientRect().right <= innerWidth)).toBe(true);
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  expect(reports).toBe(0);
  await trigger.click();
  await expect(dialog.getByLabel('What happened, or what would you change?')).toHaveValue('The queue jumps when I move a ticket.');
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
});


test('recording requires opt-in and can be excluded from a feedback submission', async ({ page }) => {
  test.skip(!process.env.FEEDBACK_RECORDING_TEST, 'Requires the isolated test Sentry DSN');
  const envelopes: string[] = [];
  await page.route('https://sentry.invalid/**', async route => {
    envelopes.push(route.request().postDataBuffer()?.toString() ?? '');
    await route.fulfill({ status: 200, json: { id: 'test-feedback' } });
  });
  await page.goto('/demo');
  const trigger = page.getByRole('button', { name: 'Send feedback', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Attach my recording')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Start recording to reproduce a problem' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText('Recording locally')).toBeVisible();
  await page.getByRole('button', { name: 'Reveal early' }).click();
  expect(envelopes).toHaveLength(0);
  await trigger.click();
  await dialog.getByLabel('Attach my recording').uncheck();
  await dialog.getByLabel('What happened, or what would you change?').fill('Synthetic text-only feedback');
  await dialog.getByRole('button', { name: 'Send feedback', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Thanks');
  expect(envelopes.some(body => body.includes('replay_recording'))).toBe(false);
  await trigger.click();
  await dialog.getByRole('button', { name: 'Start recording to reproduce a problem' }).click();
  await page.getByRole('button', { name: 'Start another round' }).click();
  await trigger.click();
  await expect(dialog.getByLabel('Attach my recording')).toBeChecked();
  await dialog.getByLabel('What happened, or what would you change?').fill('Synthetic replay feedback');
  await dialog.getByRole('button', { name: 'Send feedback', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Thanks');
  expect(envelopes.some(body => body.includes('replay_recording'))).toBe(true);
  await expect(page.getByText('Recording locally')).toHaveCount(0);
});
