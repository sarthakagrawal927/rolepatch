import { expect, test } from '@playwright/test';

test.describe('public pages load', () => {
  test('landing page renders', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/RolePatch|Resume/i);
  });

  test('dashboard is reachable in guest mode', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('link', { name: /create|new resume/i })).toBeVisible();
  });

  test('pricing page renders', async ({ page }) => {
    await page.goto('/pricing');
    await expect(page.getByText(/Starter|Pro|Bulk/i).first()).toBeVisible();
  });

  test('privacy and terms pages render', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page.locator('body')).not.toBeEmpty();
    await page.goto('/terms');
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('tools index links to diff and keywords', async ({ page }) => {
    await page.goto('/tools');
    await expect(page.getByRole('link', { name: /diff/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /keyword/i })).toBeVisible();
  });
});

test.describe('tools (no auth)', () => {
  test('diff tool accepts two inputs', async ({ page }) => {
    await page.goto('/tools/diff');
    const textareas = page.locator('textarea');
    await expect(textareas.first()).toBeVisible();
    await textareas.nth(0).fill('alpha beta');
    await textareas.nth(1).fill('alpha gamma');
    await expect(page.locator('body')).toContainText(/gamma|beta/);
  });

  test('keywords tool renders input', async ({ page }) => {
    await page.goto('/tools/keywords');
    await expect(page.locator('textarea').first()).toBeVisible();
  });
});

test.describe('guest stash', () => {
  test('stash page renders empty state', async ({ page }) => {
    await page.goto('/stash');
    await expect(page.locator('body')).not.toBeEmpty();
  });
});
