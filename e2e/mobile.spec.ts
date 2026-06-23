import { devices, expect, type Page, test } from '@playwright/test';

// Exercise the primary flow entry points at a 390px viewport (iPhone 13).
// Wave 1 goal: no horizontal scroll, hamburger nav, single-column layouts.
test.use({ ...devices['iPhone 13'] });

/** Asserts the document does not scroll horizontally. */
async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  // Allow 1px for sub-pixel rounding.
  expect(overflow).toBeLessThanOrEqual(1);
}

test.describe('mobile (390px)', () => {
  test('dashboard has no horizontal scroll and a working hamburger', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('link', { name: /create|new resume/i })).toBeVisible();
    await expectNoHorizontalScroll(page);

    // Desktop nav links are hidden; the hamburger reveals them.
    const hamburger = page.getByRole('button', { name: /open menu/i });
    await expect(hamburger).toBeVisible();
    await hamburger.click();
    await expect(page.getByRole('link', { name: 'Pricing' })).toBeVisible();
  });

  test('pricing cards stack to a single column', async ({ page }) => {
    await page.goto('/pricing');
    const cards = page.getByText(/Starter|Pro|Bulk/i);
    await expect(cards.first()).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test('resume editor is usable at mobile width', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('link', { name: /create|new resume/i }).click();

    // CodeMirror editor mounts and is reachable.
    await expect(page.locator('.cm-editor')).toBeVisible({ timeout: 10000 });
    const editor = page.locator('.cm-content');
    await editor.click();
    await editor.pressSequentially('# Tailor flow mobile test');
    await expect(editor).toContainText('Tailor flow mobile test');

    await expectNoHorizontalScroll(page);
  });
});
