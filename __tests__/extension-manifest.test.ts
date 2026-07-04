import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

interface ExtensionManifest {
  host_permissions?: string[];
  permissions?: string[];
}

const extensionSupportedHosts = [
  'https://boards.greenhouse.io/*',
  'https://*.greenhouse.io/*',
  'https://jobs.lever.co/*',
  'https://*.lever.co/*',
  'https://*.ashbyhq.com/*',
  'https://*.workday.com/*',
  'https://*.myworkdayjobs.com/*',
  'https://*.workable.com/*',
  'https://apply.workable.com/*',
  'https://*.recruitee.com/*',
  'https://*.personio.com/*',
  'https://*.personio.de/*',
  'https://*.jobs.personio.com/*',
  'https://*.jobs.personio.de/*',
  'https://jobs.smartrecruiters.com/*',
  'https://careers.smartrecruiters.com/*',
  'https://*.smartrecruiters.com/*',
];

describe('extension manifest', () => {
  it('keeps host permissions aligned with extension-supported ATS providers', async () => {
    const manifest = JSON.parse(
      await readFile(join(process.cwd(), 'extension/manifest.json'), 'utf8')
    ) as ExtensionManifest;

    expect(manifest.host_permissions).toEqual(expect.arrayContaining(extensionSupportedHosts));
  });

  it('keeps the extension review-triggered without broad all-site host permissions', async () => {
    const manifest = JSON.parse(
      await readFile(join(process.cwd(), 'extension/manifest.json'), 'utf8')
    ) as ExtensionManifest;

    expect(manifest.permissions).toEqual(expect.arrayContaining(['activeTab', 'scripting']));
    expect(manifest.host_permissions ?? []).not.toContain('<all_urls>');
    expect(manifest.host_permissions ?? []).not.toContain('https://*/*');
  });
});
