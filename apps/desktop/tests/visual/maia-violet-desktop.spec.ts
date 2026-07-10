import { expect, test } from '@playwright/test';

const desktopViewports = [
  { name: 'minimum', width: 1080, height: 720 },
  { name: 'standard', width: 1280, height: 800 },
  { name: 'wide', width: 1440, height: 900 },
] as const;

for (const viewport of desktopViewports) {
  test(`Vetka shell has no page overflow at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('http://127.0.0.1:5173/#/');

    await expect(page.getByRole('navigation')).toBeVisible();
    const hasPageOverflow = await page.locator('html').evaluate((html) => html.scrollWidth > html.clientWidth);
    expect(hasPageOverflow).toBe(false);
    await expect(page).toHaveScreenshot(`vetka-${viewport.name}-expanded.png`, { fullPage: true });
  });
}
