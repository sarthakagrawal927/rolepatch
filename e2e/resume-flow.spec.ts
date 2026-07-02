import { expect, test } from '@playwright/test';

test.describe('Resume flow (guest mode)', () => {
  test('can create a resume and see the editor', async ({ page }) => {
    // Navigate to dashboard
    await page.goto('/dashboard');

    // Click create resume button (opens a modal)
    const createButton = page.getByRole('button', { name: /\+ new resume/i });
    await expect(createButton).toBeVisible();
    await createButton.click();

    // Fill in the name and submit
    const nameInput = page.getByPlaceholder(/e\.g\. AI Profile/i);
    await expect(nameInput).toBeVisible();
    await nameInput.fill('Test Resume');
    await page.getByRole('button', { name: /^create$/i }).click();

    // Verify editor loads (CodeMirror uses .cm-editor class)
    await expect(page.locator('.cm-editor')).toBeVisible({ timeout: 10000 });

    // Type some Markdown content into the editor
    const editor = page.locator('.cm-content');
    await editor.click();
    await editor.pressSequentially('## Experience');

    // Verify the content was typed
    await expect(editor).toContainText('## Experience');

    // Verify content persists in localStorage (guest mode)
    const storageData = await page.evaluate(() => localStorage.getItem('rt-resumes'));
    expect(storageData).toBeTruthy();
    const resumes = JSON.parse(storageData!);
    expect(resumes.length).toBeGreaterThan(0);
  });
});
