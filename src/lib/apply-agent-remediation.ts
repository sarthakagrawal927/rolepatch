import type { ApplyAgentFailureCode } from '@/lib/types';

export interface ApplyAgentRemediation {
  title: string;
  detail: string;
}

const GENERIC_REMEDIATION: Record<ApplyAgentFailureCode, ApplyAgentRemediation> = {
  provider_unsupported: {
    title: 'Use assisted fill',
    detail: 'Open the ATS page from the packet and use extension-assisted fill.',
  },
  captcha_detected: {
    title: 'Complete verification',
    detail: 'Complete the human verification in the browser, then rerun the check.',
  },
  file_upload_required: {
    title: 'Attach files',
    detail: 'Attach the requested file manually or use the extension upload assist.',
  },
  missing_required_fields: {
    title: 'Save missing answers',
    detail: 'Add the missing answer to Profile answers, then retry the queue item.',
  },
  submit_button_missing: {
    title: 'Submit manually',
    detail: 'Open the packet and submit manually; this ATS flow needs review.',
  },
  form_not_found: {
    title: 'Check job URL',
    detail: 'Confirm the job URL points to the application form, then rerun browser check.',
  },
  browser_unavailable: {
    title: 'Run on Cloudflare',
    detail: 'Run this in the Cloudflare Worker environment with the Browser binding.',
  },
  browser_navigation_failed: {
    title: 'Retry or open manually',
    detail: 'Retry later or open the ATS page manually if the site blocks fetches.',
  },
  confirmation_missing: {
    title: 'Verify confirmation',
    detail: 'Check the ATS page manually before marking this application submitted.',
  },
  runtime_failure: {
    title: 'Retry once',
    detail: 'Retry once; if it repeats, use the packet and record a manual receipt.',
  },
};

const PROVIDER_REMEDIATION: Record<
  string,
  Partial<Record<ApplyAgentFailureCode, ApplyAgentRemediation>>
> = {
  greenhouse: {
    missing_required_fields: {
      title: 'Save Greenhouse answers',
      detail:
        'Greenhouse fields are usually single-page; add the missing profile answer and rerun guarded submit.',
    },
    file_upload_required: {
      title: 'Use upload assist',
      detail:
        'Select resume and cover-letter files in the extension popup, fill Greenhouse, then submit after review.',
    },
  },
  lever: {
    confirmation_missing: {
      title: 'Check Lever confirmation',
      detail:
        'Lever can confirm inline after submit; verify the page, then capture a manual submitted receipt if it succeeded.',
    },
    missing_required_fields: {
      title: 'Complete Lever questions',
      detail:
        'Save the missing screening answer, rerun fill, and check radio/checkbox choices before submit.',
    },
  },
  workday: {
    missing_required_fields: {
      title: 'Finish Workday steps',
      detail:
        'Workday often hides required fields behind later steps; open the packet, complete the step manually, then rerun browser check.',
    },
    submit_button_missing: {
      title: 'Continue Workday manually',
      detail:
        'Workday multi-step flows may show Next instead of Submit; advance manually and record the receipt.',
    },
    browser_navigation_failed: {
      title: 'Open Workday manually',
      detail:
        'Workday often blocks headless navigation; use the prepared packet and extension-assisted fill.',
    },
  },
  ashby: {
    confirmation_missing: {
      title: 'Verify Ashby inline state',
      detail:
        'Ashby sometimes keeps success inline; inspect the page and record a manual receipt if the application went through.',
    },
  },
  workable: {
    captcha_detected: {
      title: 'Complete Workable check',
      detail:
        'Finish the Workable verification in the browser, then rerun the reviewed browser check.',
    },
  },
  recruitee: {
    file_upload_required: {
      title: 'Attach Recruitee files',
      detail:
        'Use extension upload assist for resume/CV fields, then run reviewed submit after the upload is visible.',
    },
  },
  personio: {
    submit_button_missing: {
      title: 'Review Personio consent',
      detail:
        'Personio often gates submit behind consent fields; review required consent and capture a manual receipt if needed.',
    },
  },
};

export function failureCodeLabel(code: ApplyAgentFailureCode): string {
  return code.replaceAll('_', ' ');
}

export function getApplyAgentRemediation(
  provider: string | null | undefined,
  code: ApplyAgentFailureCode
): ApplyAgentRemediation {
  const normalizedProvider = (provider ?? '').trim().toLowerCase();
  return PROVIDER_REMEDIATION[normalizedProvider]?.[code] ?? GENERIC_REMEDIATION[code];
}
