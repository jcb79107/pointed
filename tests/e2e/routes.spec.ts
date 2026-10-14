import { test, expect } from '@playwright/test';

test('old app bookmarks redirect to clean routes and preserve query strings', async ({ request }) => {
  for (const [from, to] of [
    ['/app', '/sessions'],
    ['/app/settings', '/settings'],
    ['/app/account', '/account'],
    ['/app/sessions/example/prepare', '/sessions/example/prepare'],
  ]) {
    const response = await request.get(`${from}?from=bookmark`, { maxRedirects: 0 });
    expect(response.status()).toBe(308);
    expect(response.headers().location).toBe(`${to}?from=bookmark`);
  }
});

test('protected clean routes retain their destination through sign-in', async ({ page }) => {
  for (const destination of ['/settings', '/account', '/sessions/example/prepare', '/sessions/example']) {
    await page.goto(destination);
    await expect(page).toHaveURL(new RegExp('/sessions\\?returnTo='));
    await expect(page.getByRole('heading', { name: 'Sign in with Linear' })).toBeVisible();
    const link = page.getByRole('link', { name: 'Continue with Linear' });
    const href = await link.getAttribute('href');
    expect(new URL(href!, 'http://localhost').searchParams.get('returnTo')).toBe(destination);
  }
});

test('landing and sign-in use canonical sessions URL', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Connect Linear' }).click();
  await expect(page).toHaveURL(/\/sessions$/);
  await expect(page.getByRole('heading', { name: 'Sign in with Linear' })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
});
