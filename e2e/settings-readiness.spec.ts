import { expect, test } from '@playwright/test';

test.describe('settings operational readiness', () => {
  test('renders Cloudflare-first readiness without leaking configured secrets', async ({
    page,
  }) => {
    await page.goto('/settings');

    await expect(page.getByRole('heading', { name: 'Operational readiness' })).toBeVisible();
    await expect(page.getByText('Cloudflare-first runtime checks')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Browser Rendering' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Outbound email' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Sender identity' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'AI gateway' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Auth and OAuth' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Payment checkout' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Payment webhook' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Worker hooks' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Chrome extension' })).toBeVisible();
    await expect(page.getByText('Unpacked build')).toBeVisible();
    await expect(page.getByText('extension/dist')).toBeVisible();
    await expect(page.getByText('Workable')).toBeVisible();
    await expect(page.getByText('Recruitee')).toBeVisible();
    await expect(page.getByText('Personio')).toBeVisible();
    await expect(page.getByText(/No all-site permission/i)).toBeVisible();
    await expect(page.getByText(/Ready|Needs setup|Code ready/).first()).toBeVisible();

    const body = page.locator('body');
    await expect(body).not.toContainText('playwright-test-secret-32-characters-long');
    await expect(body).not.toContainText('playwright-ai-key');
    await expect(body).not.toContainText('playwright-resend-key');
    await expect(body).not.toContainText('playwright-google-secret');
    await expect(body).not.toContainText('playwright-dodo-api-key');
    await expect(body).not.toContainText('playwright-dodo-webhook-key');
    await expect(body).not.toContainText('prod-playwright-starter');
  });
});
