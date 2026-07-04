import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const deployWorkflow = readFileSync('.github/workflows/deploy.yml', 'utf8');

describe('deploy workflow', () => {
  it('can deploy from main pushes or manual dispatch and smokes parity routes', () => {
    expect(deployWorkflow).toContain('push:');
    expect(deployWorkflow).toContain('branches: [main]');
    expect(deployWorkflow).toContain('pull_request:');
    expect(deployWorkflow).toContain('workflow_dispatch:');
    expect(deployWorkflow).toContain(
      "if: github.event_name == 'push' || github.event_name == 'workflow_dispatch'"
    );
    expect(deployWorkflow).toContain('pnpm cf:build');
    expect(deployWorkflow).toContain('run: pnpm smoke:prod');
  });
});
