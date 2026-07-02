import { expect, test } from '@playwright/test';

/**
 * E2E tests for the ATS board job discovery + paste-URL → tailor flow.
 *
 * Tests the manual technique: Google site: queries → copy ATS URL →
 * paste into "Add Job" → scrape → tailor.
 *
 * Guest mode is used throughout (localStorage) to avoid auth dependencies.
 * The actual scrape network call is not exercised here (covered by unit
 * tests); instead we pre-seed a guest job to verify the tailor page renders.
 */

test.describe('Job search tips', () => {
  test('search tips panel is visible and expandable on dashboard', async ({ page }) => {
    await page.goto('/dashboard');

    // The tips panel should be present
    const tipsButton = page.getByRole('button', {
      name: /find less-competitive jobs on ats boards/i,
    });
    await expect(tipsButton).toBeVisible();

    // Expand it
    await tipsButton.click();

    // Should show the keywords input
    await expect(page.getByPlaceholder(/product manager/i)).toBeVisible();

    // Should show board toggle buttons (Ashby, Greenhouse, Lever selected by default)
    await expect(page.getByRole('button', { name: 'Ashby' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Greenhouse' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Lever' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Workday' })).toBeVisible();
  });

  test('builds a Google query preview and open link', async ({ page }) => {
    await page.goto('/dashboard');

    const tipsButton = page.getByRole('button', {
      name: /find less-competitive jobs on ats boards/i,
    });
    await tipsButton.click();

    // Type keywords
    const keywordsInput = page.getByPlaceholder(/product manager/i);
    await keywordsInput.fill('"product manager"');

    // Query preview should show the site: operators and keywords
    await expect(page.locator('pre')).toContainText('site:jobs.ashbyhq.com');
    await expect(page.locator('pre')).toContainText('"product manager"');

    // Open in Google link should have the correct href
    const googleLink = page.getByRole('link', { name: /open in google/i });
    await expect(googleLink).toBeVisible();
    const href = await googleLink.getAttribute('href');
    expect(href).toContain('google.com/search');
    expect(href).toContain('site%3Ajobs.ashbyhq.com');
    expect(href).toContain('%22product%20manager%22');
  });

  test('toggling boards updates the query', async ({ page }) => {
    await page.goto('/dashboard');

    const tipsButton = page.getByRole('button', {
      name: /find less-competitive jobs on ats boards/i,
    });
    await tipsButton.click();

    // Click "All" to select every board
    await page.getByRole('button', { name: 'All', exact: true }).click();

    // Query preview should include all 10 sites
    const preview = page.locator('pre');
    await expect(preview).toContainText('site:careers.icims.com');
    await expect(preview).toContainText('site:jobs.bamboohr.com');
    await expect(preview).toContainText('site:apply.jazz.co');
    await expect(preview).toContainText('site:careers.workable.com');

    // Click "None" — query preview should disappear, link disabled
    await page.getByRole('button', { name: 'None', exact: true }).click();
    await expect(page.locator('pre')).toHaveCount(0);
  });
});

test.describe('Add Job modal (guest mode)', () => {
  test('opens and accepts an ATS board URL', async ({ page }) => {
    // Seed a resume so the Add Job button is enabled
    await page.goto('/dashboard');
    await page.evaluate(() => {
      const now = Math.floor(Date.now() / 1000);
      const resumes = [
        {
          id: 'test-resume-1',
          name: 'Test Resume',
          source: '\\documentclass{article}\\begin{document}Test\\end{document}',
          created_at: now,
          updated_at: now,
        },
      ];
      localStorage.setItem('rt-resumes', JSON.stringify(resumes));
    });
    await page.reload();

    // Click Add Job
    const addJobButton = page.getByRole('button', { name: /\+ Add Job/i });
    await expect(addJobButton).toBeVisible();
    await addJobButton.click();

    // Modal should be visible
    await expect(page.getByText(/Add Job Application/i)).toBeVisible();

    // Type a Greenhouse URL — the input is inside a label but has no id,
    // so use placeholder text instead of getByLabel.
    const urlInput = page.getByPlaceholder(/boards\.greenhouse\.io/i);
    await expect(urlInput).toBeVisible();
    await urlInput.fill('https://boards.greenhouse.io/acme/jobs/12345');

    // Add Job submit button should be enabled (use exact match to distinguish
    // from the dashboard "+ Add Job" trigger button)
    const submitButton = page.getByRole('button', { name: 'Add Job', exact: true });
    await expect(submitButton).toBeEnabled();
  });

  test('Add Job button shows toast when no resume exists', async ({ page }) => {
    await page.goto('/dashboard');
    // Clear any existing resumes
    await page.evaluate(() => localStorage.removeItem('rt-resumes'));
    await page.reload();

    const addJobButton = page.getByRole('button', { name: /\+ Add Job/i });
    await addJobButton.click();

    // Should show toast about creating a resume first
    await expect(page.getByText(/create a resume first/i)).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Tailor page (guest mode with pre-seeded job)', () => {
  test('renders the tailor page with a scraped ATS job', async ({ page }) => {
    // Seed localStorage with a resume and a job (simulating a completed scrape
    // of a Greenhouse posting)
    await page.goto('/dashboard');
    await page.evaluate(() => {
      const now = Math.floor(Date.now() / 1000);
      const resumes = [
        {
          id: 'resume-1',
          name: 'Base Resume',
          source:
            '\\documentclass{article}\\begin{document}\\section{Experience}Software Engineer at Acme\\end{document}',
          created_at: now,
          updated_at: now,
        },
      ];
      const jobs = [
        {
          id: 'job-ats-1',
          company: 'Acme',
          role: 'Product Manager',
          resume_id: 'resume-1',
          url: 'https://boards.greenhouse.io/acme/jobs/12345',
          jd_raw: 'We are looking for a Product Manager to drive our platform vision.',
          jd_text: 'We are looking for a Product Manager to drive our platform vision.',
          status: 'draft',
          created_at: now,
          updated_at: now,
        },
      ];
      localStorage.setItem('rt-resumes', JSON.stringify(resumes));
      localStorage.setItem('rt-jobs', JSON.stringify(jobs));
    });

    // Navigate to the tailor page for this job
    await page.goto('/tailor/job-ats-1');

    // The server-rendered header shows the job title (from getJobApplication
    // for signed-in users). For guests, the TailorFlow client component
    // hydrates activeJob from localStorage via useEffect — so we wait for
    // the JD text which only renders once activeJob is set.
    // Use the <pre> element that contains the JD text to avoid matching
    // the "Job Description" heading.
    await expect(page.locator('pre').filter({ hasText: /platform vision/i })).toBeVisible({
      timeout: 15000,
    });
    // The job URL link is rendered once activeJob is set
    await expect(page.getByRole('link', { name: /boards\.greenhouse\.io\/acme/i })).toBeVisible();
  });

  test('shows back link to dashboard from tailor page', async ({ page }) => {
    await page.goto('/dashboard');
    await page.evaluate(() => {
      const now = Math.floor(Date.now() / 1000);
      localStorage.setItem(
        'rt-resumes',
        JSON.stringify([
          {
            id: 'r1',
            name: 'Resume',
            source: 'test',
            created_at: now,
            updated_at: now,
          },
        ])
      );
      localStorage.setItem(
        'rt-jobs',
        JSON.stringify([
          {
            id: 'j1',
            company: 'TestCo',
            role: 'Engineer',
            resume_id: 'r1',
            url: 'https://jobs.ashbyhq.com/testco/engineer',
            jd_raw: 'Job description',
            jd_text: 'Job description',
            status: 'draft',
            created_at: now,
            updated_at: now,
          },
        ])
      );
    });

    await page.goto('/tailor/j1');
    // Wait for client hydration (guest job loads from localStorage)
    // Use the <pre> element that contains the JD text to avoid matching
    // the "Job Description" heading.
    await expect(page.locator('pre').filter({ hasText: /Job description/i })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByRole('link', { name: /back/i })).toBeVisible();
  });
});

test.describe('Dashboard discover section copy', () => {
  test('mentions ATS boards in the discover section', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText(/Ashby|Greenhouse|Lever/i)).toBeVisible();
  });
});
