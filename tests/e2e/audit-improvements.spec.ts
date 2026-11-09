import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import type { SessionSnapshot } from '../../src/lib/domain';
import { openRoomActions } from './helpers/room-actions';
const fixture = 'http://127.0.0.1:3005';

test('long issue navigation, mobile actions, and search scope stay accessible', async ({ page, request }, testInfo) => {
  const snapshot: SessionSnapshot = (await (await request.get(`${fixture}/api/fixture-snapshot`)).json()).snapshot;
  snapshot.queue[0].description = 'Long issue context.\n\n'.repeat(90);
  snapshot.title = 'A long session name that must remain readable';
  await page.route('**/api/**', route => route.fulfill({ json: { snapshot } }));
  await page.route('**/api/slack/connection', route => route.fulfill({ json: { destination: null } }));
  await page.route('**/api/linear/issues?*', route => route.fulfill({ json: { issues: [] } }));
  await page.goto(`${fixture}/?screen=live&scenario=long`);
  await expect(page.locator('.issue-description')).toContainText('Long issue context');
  if ((page.viewportSize()?.width ?? 0) <= 700) {
    await expect(page.getByRole('button', { name: 'Actions', exact: true })).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('.room-title b')).toHaveText(snapshot.title);
    await page.getByRole('button', { name: 'View voting controls', exact: true }).click();
    await expect(page.locator('.vote-dock')).toBeFocused();
    await expect(page.getByRole('button', { name: 'Reveal early' })).toBeInViewport();
    await openRoomActions(page);
    await page.getByRole('button', { name: 'Copy link', exact: true }).focus();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Actions', exact: true })).toBeFocused();
    await expect(page.getByRole('button', { name: 'Actions', exact: true })).toHaveAttribute('aria-expanded', 'false');
  }
  await openRoomActions(page);
  await expect(page.getByRole('link', { name: 'Set up Slack' })).toHaveAttribute('href', '/settings#slack');
  // Desktop has a separate agenda Add action; use the header action on phones.
  const add = page.getByRole('button', { name: /^(Add ticket|Add)$/, exact: true });
  await add.filter({ visible: true }).first().click();
  const search = page.getByRole('textbox', { name: 'Search Linear tickets', exact: true });
  await expect(search).toBeFocused();
  await expect(page.locator('#ticket-search-scope')).toContainText('All cycles · Unestimated');
  await search.fill('no-such-ticket');
  await search.press('Enter');
  await expect(page.getByText('No matching tickets', { exact: true })).toBeVisible();
  await expect(page.getByText(/check the filters above/)).toBeVisible();
  expect((await new AxeBuilder({ page }).include('.issue-picker-modal').analyze()).violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('search-and-scope.png') });
  await page.keyboard.press('Escape');
  await expect(search).toHaveCount(0);
});

test('zero voters has truthful status and joins through the existing role command', async ({ page, request }, testInfo) => {
  const snapshot: SessionSnapshot = (await (await request.get(`${fixture}/api/fixture-snapshot`)).json()).snapshot;
  snapshot.participants = snapshot.participants.filter(p => p.id === snapshot.currentUserId);
  snapshot.round!.eligibleVoterIds = [];
  snapshot.participants[0].votingEnabled = false;
  snapshot.queue[0].elapsedSeconds = 59 * 3600;
  const commands: unknown[] = [];
  await page.route('**/api/**', route => route.fulfill({ json: { snapshot } }));
  await page.route('**/api/sessions/*/actions', route => {
    const input = route.request().postDataJSON(); commands.push(input);
    snapshot.participants[0].votingEnabled = true;
    snapshot.round!.eligibleVoterIds = [snapshot.currentUserId];
    return route.fulfill({ json: { snapshot } });
  });
  await page.goto(`${fixture}/?screen=live&scenario=waiting`);
  await expect(page.getByText('Waiting for voters', { exact: true })).toBeVisible();
  await expect(page.getByText('Elapsed time includes waiting while this ticket is open.')).toBeVisible();
  await expect(page.locator('.vote-dock .elapsed-timer')).toContainText('Ticket elapsed');
  const bounds = await page.locator('.no-voters').evaluate(el => {
    const r = el.getBoundingClientRect();
    return [...el.querySelectorAll('button')].every(b => { const x = b.getBoundingClientRect(); return x.left >= r.left && x.right <= r.right; });
  });
  expect(bounds).toBe(true);
  await page.locator('.no-voters').scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('waiting-controls.png') });
  await page.getByRole('button', { name: 'Join voting', exact: true }).click();
  await expect(page.getByRole('button', { name: '1 points, shortcut 1', exact: true })).toBeEnabled();
  expect(commands).toEqual([{ action: 'participant-role', participantUserId: snapshot.currentUserId, role: 'facilitator', votingEnabled: true, addToCurrentRound: true }]);
});

test('empty preparation names the session and explains start requirements', async ({ page }) => {
  await page.route('**/api/slack/connection', route => route.fulfill({ json: { destination: null } }));
  await page.goto(fixture);
  await expect(page.locator('.prepare-session-name')).toHaveText('Platform pointing');
  await expect(page.getByRole('button', { name: 'Start session', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Start session', exact: true })).toHaveAttribute('aria-describedby', 'start-session-help');
  await expect(page.locator('#start-session-help')).toContainText('Load at least one ticket');
  expect((await page.locator('.queue-empty').boundingBox())!.height).toBeLessThan(220);
  await expect(page.getByRole('link', { name: 'Pointed sessions' })).toHaveAttribute('href', '/sessions');
});

test('feedback validation focuses and describes the invalid field without losing input', async ({ page }) => {
  await page.goto('/demo');
  await openRoomActions(page);
  await page.getByRole('button', { name: 'Send feedback', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Send feedback', exact: true }).click();
  const message = dialog.getByRole('textbox', { name: 'What happened, or what would you change?' });
  await expect(message).toBeFocused();
  await expect(message).toHaveAttribute('aria-invalid', 'true');
  await expect(message).toHaveAccessibleDescription('Tell us what happened or what you’d change.');
  await message.fill('Keep this draft');
  await expect(message).not.toHaveAttribute('aria-invalid', 'true');
  await dialog.getByText('Add details (optional)', { exact: true }).click();
  await dialog.getByLabel('Email (optional, for a reply)').fill('invalid');
  await dialog.getByText('Add details (optional)', { exact: true }).click();
  await dialog.getByRole('button', { name: 'Send feedback', exact: true }).click();
  await expect(dialog.getByLabel('Email (optional, for a reply)')).toBeFocused();
  await expect(message).toHaveValue('Keep this draft');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Send feedback', exact: true })).toBeFocused();
});
