import { expect, type Page } from '@playwright/test';

export async function openRoomActions(page: Page) {
  // Next can finish navigation while the streamed room is still loading.
  await expect(page.locator('.room-header')).toBeVisible();
  const toggle = page.getByRole('button', { name: 'Actions', exact: true });
  if (await toggle.isVisible() && await toggle.getAttribute('aria-expanded') === 'false') {
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  }
}
