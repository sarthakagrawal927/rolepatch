import { describe, expect, it } from 'vitest';

import {
  BUILT_SERVER_COMMAND,
  FOCUSED_E2E_ARGS,
  RELEASE_VERIFY_STEPS,
  STANDALONE_ASSET_COPIES,
} from '../scripts/release-verify.mjs';

describe('release verifier', () => {
  it('runs non-deploy gates before local smoke and focused e2e', () => {
    expect(RELEASE_VERIFY_STEPS).toEqual([
      ['pnpm', ['typecheck']],
      ['pnpm', ['lint']],
      ['pnpm', ['test']],
      ['pnpm', ['--dir', 'extension', 'build']],
      ['pnpm', ['cf:build']],
    ]);
    expect(FOCUSED_E2E_ARGS).toEqual([
      'exec',
      'playwright',
      'test',
      'e2e/ats-job-flow.spec.ts',
      'e2e/settings-readiness.spec.ts',
      '--workers=1',
    ]);
    expect(BUILT_SERVER_COMMAND).toEqual([process.execPath, ['.next/standalone/server.js']]);
    expect(STANDALONE_ASSET_COPIES).toEqual([
      ['.next/static', '.next/standalone/.next/static'],
      ['public', '.next/standalone/public'],
    ]);
  });
});
