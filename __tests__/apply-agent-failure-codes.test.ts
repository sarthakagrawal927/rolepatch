import { describe, expect, it } from 'vitest';

import { classifyGuardedSubmitFailureCode } from '@/lib/apply-agent-browser-run';
import { failureCodeLabel, getApplyAgentRemediation } from '@/lib/apply-agent-remediation';

describe('apply-agent browser failure codes', () => {
  it.each([
    [['CAPTCHA or human verification is present'], 'captcha_detected'],
    [['Manual file upload is still required'], 'file_upload_required'],
    [['Required fields are empty: Sponsorship'], 'missing_required_fields'],
    [['No visible submit button was detected'], 'submit_button_missing'],
    [['Provider is not supported for guarded submit'], 'provider_unsupported'],
    [['Cloudflare Browser Rendering binding is not available'], 'browser_unavailable'],
    [['No ATS confirmation page detected after submit click'], 'confirmation_missing'],
    [['Guarded submit runtime failure'], 'runtime_failure'],
  ] as const)('classifies %s as %s', (reasons, expected) => {
    expect(classifyGuardedSubmitFailureCode([...reasons])).toBe(expected);
  });

  it('keeps an explicit fallback for unknown blocked reasons', () => {
    expect(classifyGuardedSubmitFailureCode(['Unknown blocker'], 'runtime_failure')).toBe(
      'runtime_failure'
    );
  });

  it('returns provider-specific remediation before generic fallback', () => {
    expect(getApplyAgentRemediation('workday', 'submit_button_missing').detail).toContain(
      'Workday multi-step flows'
    );
    expect(getApplyAgentRemediation('greenhouse', 'missing_required_fields').title).toBe(
      'Save Greenhouse answers'
    );
    expect(getApplyAgentRemediation('unknown', 'missing_required_fields').detail).toContain(
      'Profile answers'
    );
    expect(failureCodeLabel('missing_required_fields')).toBe('missing required fields');
  });
});
