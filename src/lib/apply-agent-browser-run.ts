import { v4 as uuid } from 'uuid';

import { inferAtsProvider } from '@/lib/apply-agent';
import { parseReadiness } from '@/lib/apply-agent';
import { db } from '@/lib/db';
import { normalizeJobUrl } from '@/lib/job-discovery-alerts';
import type {
  ApplicationReceiptField,
  ApplyAgentFailureCode,
  GuardedBrowserSubmitBatchResult,
  GuardedBrowserSubmitResult,
  ProfileAnswer,
  ReviewedBrowserCheckBatchResult,
  ReviewedBrowserCheckResult,
} from '@/lib/types';

export const REVIEWED_BROWSER_PROVIDERS = new Set([
  'greenhouse',
  'lever',
  'workday',
  'ashby',
  'workable',
  'recruitee',
  'personio',
  'smartrecruiters',
]);

const DAILY_GUARDED_CAP_PATTERN = /daily guarded|daily submit|submit cap|application cap/i;
const EXCLUSION_ANSWER_PATTERN =
  /excluded|avoid|do not apply|don't apply|never apply|blocked compan/i;
const MINIMUM_FIT_ANSWER_PATTERN = /minimum fit|fit threshold|minimum score|score threshold/i;
const DEFAULT_DAILY_GUARDED_SUBMIT_CAP = 5;
const DEFAULT_MINIMUM_FIT_SCORE = 70;

export function isReviewedBrowserProvider(provider: string): boolean {
  return REVIEWED_BROWSER_PROVIDERS.has(provider);
}

interface QueueJobRow {
  id: string;
  job_id: string;
  readiness_json: string;
  url: string;
  company: string | null;
  resume_id: string | null;
}

interface CoverLetterRow {
  id: string;
  content: string;
}

interface QueueIdRow {
  id: string;
}

interface ProfileAnswerLimitRow {
  label: string;
  answer: string;
}

interface ProfileAnswerSafetyRow extends ProfileAnswerLimitRow {
  category: string;
}

interface JobUrlRow {
  id: string;
  url: string | null;
}

interface BrowserSignals {
  runtime: ReviewedBrowserCheckResult['runtime'];
  formsDetected: number;
  fieldsDetected: number;
  submitDetected: boolean;
  uploadFields: string[];
  captchaDetected: boolean;
  failureReason: string | null;
}

async function getBrowserBinding(): Promise<{ fetch: (req: Request) => Promise<Response> } | null> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = getCloudflareContext({ async: false });
    return (
      (
        ctx?.env as unknown as
          | { BROWSER?: { fetch: (req: Request) => Promise<Response> } }
          | undefined
      )?.BROWSER ?? null
    );
  } catch {
    return null;
  }
}

function dailyGuardedSubmitCapFromAnswers(answers: ProfileAnswerLimitRow[]): number {
  const answer = answers.find((item) =>
    DAILY_GUARDED_CAP_PATTERN.test(`${item.label} ${item.answer}`)
  );
  if (!answer) return DEFAULT_DAILY_GUARDED_SUBMIT_CAP;
  const cap = Number(answer.answer.match(/\d+/)?.[0] ?? '');
  if (!Number.isFinite(cap)) return DEFAULT_DAILY_GUARDED_SUBMIT_CAP;
  return Math.min(50, Math.max(1, Math.round(cap)));
}

function minimumFitScoreFromAnswers(answers: ProfileAnswerLimitRow[]): number {
  const answer = answers.find((item) =>
    MINIMUM_FIT_ANSWER_PATTERN.test(`${item.label} ${item.answer}`)
  );
  if (!answer) return DEFAULT_MINIMUM_FIT_SCORE;
  const score = Number(answer.answer.match(/\d+/)?.[0] ?? '');
  if (!Number.isFinite(score)) return DEFAULT_MINIMUM_FIT_SCORE;
  return Math.min(100, Math.max(0, Math.round(score)));
}

function normalizedSafetyTerm(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function splitSafetyList(value: string): string[] {
  return value
    .split(/[,\n;|]+/)
    .map((item) => normalizedSafetyTerm(item))
    .filter((item) => item.length >= 3);
}

function exclusionTermsFromAnswers(answers: ProfileAnswerLimitRow[]): string[] {
  const terms = new Set<string>();
  for (const answer of answers) {
    if (!EXCLUSION_ANSWER_PATTERN.test(`${answer.label} ${answer.answer}`)) continue;
    for (const term of splitSafetyList(answer.answer)) terms.add(term);
  }
  return Array.from(terms);
}

function companyMatchesExclusion(
  company: string | null | undefined,
  terms: string[]
): string | null {
  const normalizedCompany = normalizedSafetyTerm(company ?? '');
  if (!normalizedCompany) return null;
  return (
    terms.find((term) => normalizedCompany.includes(term) || term.includes(normalizedCompany)) ??
    null
  );
}

function missingRequiredAnswerLabels(answers: ProfileAnswerSafetyRow[]): string[] {
  const categories = new Set(answers.map((answer) => answer.category));
  return [
    ['work_authorization', 'Work auth'],
    ['sponsorship', 'Sponsorship'],
  ]
    .filter(([category]) => !categories.has(category))
    .map(([, label]) => label);
}

async function reviewGuardedSubmitSafety(userId: string, queue: QueueJobRow): Promise<void> {
  const [profileResult, fitResult, jobUrlResult] = await Promise.all([
    db.execute({
      sql: 'SELECT category, label, answer FROM profile_answers WHERE user_id = ?',
      args: [userId],
    }),
    db.execute({
      sql: 'SELECT overall_score FROM fit_scores WHERE job_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 1',
      args: [queue.job_id, userId],
    }),
    db.execute({
      sql: 'SELECT id, url FROM job_applications WHERE user_id = ? AND url IS NOT NULL',
      args: [userId],
    }),
  ]);

  const profileAnswers = JSON.parse(JSON.stringify(profileResult.rows)) as ProfileAnswerSafetyRow[];
  const missingAnswers = missingRequiredAnswerLabels(profileAnswers);
  if (missingAnswers.length > 0) {
    throw new Error(
      `Resolve safety review first: Required answers missing (${missingAnswers.join(', ')}).`
    );
  }

  const excludedTerm = companyMatchesExclusion(
    queue.company,
    exclusionTermsFromAnswers(profileAnswers)
  );
  if (excludedTerm) {
    throw new Error(
      `Resolve safety review first: Excluded company matches saved exclusion "${excludedTerm}".`
    );
  }

  const jobUrls = JSON.parse(JSON.stringify(jobUrlResult.rows)) as JobUrlRow[];
  const normalizedQueueUrl = normalizeJobUrl(queue.url);
  const duplicateUrl = jobUrls.some(
    (job) => job.id !== queue.job_id && job.url && normalizeJobUrl(job.url) === normalizedQueueUrl
  );
  if (duplicateUrl) {
    throw new Error('Resolve safety review first: Duplicate job URL.');
  }

  const latestFitScore = Number(
    (fitResult.rows[0] as { overall_score?: unknown } | undefined)?.overall_score
  );
  const minimumFitScore = minimumFitScoreFromAnswers(profileAnswers);
  if (Number.isFinite(latestFitScore) && latestFitScore < minimumFitScore) {
    throw new Error(
      `Resolve safety review first: Fit score is ${latestFitScore}; minimum is ${minimumFitScore}.`
    );
  }
}

async function getGuardedSubmitAllowance(userId: string): Promise<{
  cap: number;
  used: number;
  remaining: number;
}> {
  const since = Math.floor(Date.now() / 1000) - 24 * 60 * 60;
  const [profileResult, receiptResult] = await Promise.all([
    db.execute({
      sql: 'SELECT label, answer FROM profile_answers WHERE user_id = ?',
      args: [userId],
    }),
    db.execute({
      sql: `SELECT COUNT(*) AS count
            FROM application_receipts
            WHERE user_id = ?
              AND status = 'submitted'
              AND created_at >= ?
              AND fields_json LIKE '%Guarded browser submit%'`,
      args: [userId, since],
    }),
  ]);
  const answers = JSON.parse(JSON.stringify(profileResult.rows)) as ProfileAnswerLimitRow[];
  const cap = dailyGuardedSubmitCapFromAnswers(answers);
  const used = Number((receiptResult.rows[0] as { count?: unknown } | undefined)?.count ?? 0);
  return { cap, used, remaining: Math.max(0, cap - used) };
}

async function inspectWithCloudflareBrowser(url: string): Promise<BrowserSignals | null> {
  const browserBinding = await getBrowserBinding();
  if (!browserBinding) return null;
  const puppeteerMod = await import('@cloudflare/puppeteer');
  // @ts-expect-error — runtime types for @cloudflare/puppeteer.launch(binding)
  const browser = await puppeteerMod.launch(browserBinding);
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15_000 });
    const signals = await page.evaluate(() => {
      const visible = (el: Element) => {
        const style = window.getComputedStyle(el);
        const rect = (el as HTMLElement).getBoundingClientRect();
        return (
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          rect.width > 0 &&
          rect.height > 0
        );
      };
      const controls = Array.from(document.querySelectorAll('input, textarea, select')).filter(
        visible
      );
      const uploadFields = controls
        .filter((el) => el instanceof HTMLInputElement && el.type === 'file')
        .map((el) => {
          const input = el as HTMLInputElement;
          const label = input.id
            ? (document.querySelector(`label[for="${CSS.escape(input.id)}"]`) as HTMLElement | null)
                ?.innerText
            : '';
          return (label || input.name || input.getAttribute('aria-label') || 'File upload').trim();
        })
        .slice(0, 12);
      const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'));
      const submitDetected = buttons.some((el) =>
        /submit|apply|send application/i.test(
          (el as HTMLElement).innerText || (el as HTMLInputElement).value || ''
        )
      );
      const text = document.body.innerText.toLowerCase();
      return {
        formsDetected: document.querySelectorAll('form').length,
        fieldsDetected: controls.length,
        submitDetected,
        uploadFields,
        captchaDetected: /captcha|recaptcha|hcaptcha|verify you are human/.test(text),
      };
    });
    return { runtime: 'cloudflare_browser', failureReason: null, ...signals };
  } catch (err) {
    return {
      runtime: 'cloudflare_browser',
      formsDetected: 0,
      fieldsDetected: 0,
      submitDetected: false,
      uploadFields: [],
      captchaDetected: false,
      failureReason: err instanceof Error ? err.message : String(err),
    };
  } finally {
    await browser.close();
  }
}

async function inspectWithFetch(url: string): Promise<BrowserSignals> {
  try {
    const res = await fetch(url, {
      headers: { accept: 'text/html', 'user-agent': 'RolePatch reviewed browser check' },
      signal: AbortSignal.timeout(12_000),
    });
    const html = await res.text();
    const lower = html.toLowerCase();
    const uploadMatches = html.match(/<input[^>]+type=["']?file/gi) ?? [];
    return {
      runtime: 'fetch_fallback',
      formsDetected: (html.match(/<form\b/gi) ?? []).length,
      fieldsDetected: (html.match(/<(input|textarea|select)\b/gi) ?? []).length,
      submitDetected: /type=["']?submit|>\s*(submit|apply|send application)\s*</i.test(html),
      uploadFields: uploadMatches.map((_, idx) => `File upload ${idx + 1}`).slice(0, 12),
      captchaDetected: /captcha|recaptcha|hcaptcha|verify you are human/.test(lower),
      failureReason: res.ok ? null : `HTTP ${res.status}`,
    };
  } catch (err) {
    return {
      runtime: 'fetch_fallback',
      formsDetected: 0,
      fieldsDetected: 0,
      submitDetected: false,
      uploadFields: [],
      captchaDetected: false,
      failureReason: err instanceof Error ? err.message : String(err),
    };
  }
}

async function inspectApplyPage(url: string): Promise<BrowserSignals> {
  return (await inspectWithCloudflareBrowser(url)) ?? inspectWithFetch(url);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function launchCloudflareBrowser() {
  const browserBinding = await getBrowserBinding();
  if (!browserBinding) return null;
  const puppeteerMod = await import('@cloudflare/puppeteer');
  // @ts-expect-error — runtime types for @cloudflare/puppeteer.launch(binding)
  return puppeteerMod.launch(browserBinding);
}

function statusForSignals(
  signals: BrowserSignals,
  supportedProvider: boolean
): Pick<ReviewedBrowserCheckResult, 'status' | 'summary' | 'failure_code' | 'failure_reason'> {
  if (signals.failureReason) {
    return {
      status: 'failed',
      summary: `Browser check failed: ${signals.failureReason}`,
      failure_code: 'browser_navigation_failed',
      failure_reason: signals.failureReason,
    };
  }
  if (!supportedProvider) {
    return {
      status: 'needs_user',
      summary: 'Provider is not in the reviewed browser-runner allowlist yet.',
      failure_code: 'provider_unsupported',
      failure_reason: null,
    };
  }
  if (signals.captchaDetected) {
    return {
      status: 'needs_user',
      summary: 'Captcha or human verification detected; user review is required.',
      failure_code: 'captcha_detected',
      failure_reason: null,
    };
  }
  if (signals.uploadFields.length > 0) {
    return {
      status: 'needs_user',
      summary: 'File upload fields detected; manual upload is required before submit.',
      failure_code: 'file_upload_required',
      failure_reason: null,
    };
  }
  if (signals.formsDetected > 0 && signals.fieldsDetected > 0 && signals.submitDetected) {
    return {
      status: 'ready_to_submit',
      summary: 'Reviewed browser check found an application form ready for user-controlled submit.',
      failure_code: null,
      failure_reason: null,
    };
  }
  if (signals.formsDetected > 0 && signals.fieldsDetected > 0 && !signals.submitDetected) {
    return {
      status: 'needs_user',
      summary: 'Browser check found form fields but no supported submit button.',
      failure_code: 'submit_button_missing',
      failure_reason: null,
    };
  }
  return {
    status: 'needs_user',
    summary: 'Browser check did not find a complete application form.',
    failure_code: 'form_not_found',
    failure_reason: null,
  };
}

export function classifyGuardedSubmitFailureCode(
  blockedReasons: string[],
  fallback: ApplyAgentFailureCode | null = null
): ApplyAgentFailureCode | null {
  const text = blockedReasons.join(' ').toLowerCase();
  if (/captcha|human verification/.test(text)) return 'captcha_detected';
  if (/file upload|manual upload/.test(text)) return 'file_upload_required';
  if (/required fields?/.test(text)) return 'missing_required_fields';
  if (/submit button/.test(text)) return 'submit_button_missing';
  if (/provider/.test(text)) return 'provider_unsupported';
  if (/browser rendering binding|browser binding/.test(text)) return 'browser_unavailable';
  if (/confirmation/.test(text)) return 'confirmation_missing';
  if (/runtime/.test(text)) return 'runtime_failure';
  return fallback;
}

export async function runReviewedApplyBrowserCheckForUser(
  userId: string,
  queueId: string
): Promise<ReviewedBrowserCheckResult> {
  const queueResult = await db.execute({
    sql: `SELECT q.id, q.job_id, q.readiness_json, j.url, j.company, j.resume_id
          FROM application_queue q
          JOIN job_applications j ON j.id = q.job_id AND j.user_id = q.user_id
          WHERE q.id = ? AND q.user_id = ?
          LIMIT 1`,
    args: [queueId, userId],
  });
  const queue = JSON.parse(JSON.stringify(queueResult.rows[0] ?? null)) as QueueJobRow | null;
  if (!queue) throw new Error('Queued application not found');

  const provider = inferAtsProvider(queue.url);
  const supportedProvider = isReviewedBrowserProvider(provider);
  const [signals, coverLetterResult] = await Promise.all([
    inspectApplyPage(queue.url),
    db.execute({
      sql: 'SELECT id FROM cover_letters WHERE job_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 1',
      args: [queue.job_id, userId],
    }),
  ]);
  const decision = statusForSignals(signals, supportedProvider);
  const receiptId = uuid();
  const fields: ApplicationReceiptField[] = [
    { label: 'Browser runner mode', value: 'Reviewed browser check', source: 'system' },
    { label: 'Runtime', value: signals.runtime, source: 'system' },
    { label: 'Provider', value: provider, source: 'system' },
    { label: 'Provider allowlisted', value: supportedProvider ? 'Yes' : 'No', source: 'system' },
    { label: 'Failure code', value: decision.failure_code ?? 'none', source: 'system' },
    { label: 'Forms detected', value: String(signals.formsDetected), source: 'system' },
    { label: 'Fields detected', value: String(signals.fieldsDetected), source: 'system' },
    { label: 'Submit detected', value: signals.submitDetected ? 'Yes' : 'No', source: 'system' },
    {
      label: 'File upload fields',
      value: signals.uploadFields.length ? signals.uploadFields.join(' | ') : 'None detected',
      source: 'system',
    },
    { label: 'Captcha detected', value: signals.captchaDetected ? 'Yes' : 'No', source: 'system' },
  ];
  const receiptStatus = decision.status === 'failed' ? 'failed' : 'skipped';
  const coverLetterId = (coverLetterResult.rows[0]?.id as string | undefined) ?? null;

  await db.execute({
    sql: `INSERT INTO application_receipts (
            id, job_id, queue_id, user_id, provider, status, fields_json, resume_id,
            cover_letter_id, confirmation_text, confirmation_url, failure_reason
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      receiptId,
      queue.job_id,
      queue.id,
      userId,
      provider,
      receiptStatus,
      JSON.stringify(fields),
      queue.resume_id,
      coverLetterId,
      decision.summary,
      queue.url,
      decision.failure_reason,
    ],
  });

  await db.execute({
    sql: `UPDATE application_queue
          SET status = ?, updated_at = unixepoch()
          WHERE id = ? AND user_id = ? AND status != 'submitted'`,
    args: [decision.status, queue.id, userId],
  });

  return {
    queue_id: queue.id,
    job_id: queue.job_id,
    url: queue.url,
    provider,
    runtime: signals.runtime,
    supported_provider: supportedProvider,
    forms_detected: signals.formsDetected,
    fields_detected: signals.fieldsDetected,
    submit_detected: signals.submitDetected,
    upload_fields: signals.uploadFields,
    captcha_detected: signals.captchaDetected,
    status: decision.status,
    summary: decision.summary,
    failure_code: decision.failure_code,
    failure_reason: decision.failure_reason,
    receipt_id: receiptId,
  };
}

export async function runReviewedApplyBrowserCheckBatchForUser(
  userId: string,
  input: { queueIds?: string[]; limit?: number } = {}
): Promise<ReviewedBrowserCheckBatchResult> {
  const requestedIds = [...new Set((input.queueIds ?? []).map((id) => id.trim()).filter(Boolean))];
  const limitSeed = input.limit ?? (requestedIds.length || 5);
  const limit = Math.max(1, Math.min(Number(limitSeed), 10));
  let queueIds = requestedIds.slice(0, limit);

  if (queueIds.length === 0) {
    const result = await db.execute({
      sql: `SELECT id
            FROM application_queue
            WHERE user_id = ? AND status IN ('queued', 'needs_user', 'ready_to_submit', 'failed')
            ORDER BY updated_at DESC
            LIMIT ?`,
      args: [userId, limit],
    });
    queueIds = (JSON.parse(JSON.stringify(result.rows)) as QueueIdRow[]).map((row) => row.id);
  }

  const results: ReviewedBrowserCheckResult[] = [];
  const errors: ReviewedBrowserCheckBatchResult['errors'] = [];
  for (const queueId of queueIds) {
    try {
      results.push(await runReviewedApplyBrowserCheckForUser(userId, queueId));
    } catch (err) {
      errors.push({
        queue_id: queueId,
        error: err instanceof Error ? err.message : 'Browser check failed',
      });
    }
  }

  return {
    requested: queueIds.length,
    processed: results.length,
    results,
    errors,
  };
}

export async function runGuardedApplyBrowserSubmitForUser(
  userId: string,
  queueId: string
): Promise<GuardedBrowserSubmitResult> {
  const allowance = await getGuardedSubmitAllowance(userId);
  if (allowance.remaining <= 0) {
    throw new Error(
      `Daily guarded submit cap reached (${allowance.used}/${allowance.cap}). Raise the safety cap or wait before submitting more applications.`
    );
  }

  const queueResult = await db.execute({
    sql: `SELECT q.id, q.job_id, q.readiness_json, j.url, j.company, j.resume_id
          FROM application_queue q
          JOIN job_applications j ON j.id = q.job_id AND j.user_id = q.user_id
          WHERE q.id = ? AND q.user_id = ? AND q.status = 'ready_to_submit'
          LIMIT 1`,
    args: [queueId, userId],
  });
  const queue = JSON.parse(JSON.stringify(queueResult.rows[0] ?? null)) as QueueJobRow | null;
  if (!queue) throw new Error('Queued application is not ready for guarded submit');
  await reviewGuardedSubmitSafety(userId, queue);

  const provider = inferAtsProvider(queue.url);
  if (!isReviewedBrowserProvider(provider)) {
    return recordGuardedSubmitResult(userId, queue, {
      provider,
      status: 'needs_user',
      summary: 'Provider is not in the guarded submit allowlist yet.',
      failureCode: 'provider_unsupported',
      failureReason: null,
      submitClicked: false,
      confirmationUrl: null,
      filledFields: 0,
      blockedReasons: ['Provider is not supported for guarded submit'],
      fields: [],
    });
  }

  const browser = await launchCloudflareBrowser();
  if (!browser) {
    return recordGuardedSubmitResult(userId, queue, {
      provider,
      status: 'failed',
      summary: 'Cloudflare Browser Rendering binding is required for guarded submit.',
      failureCode: 'browser_unavailable',
      failureReason: 'Cloudflare Browser Rendering binding is not available',
      submitClicked: false,
      confirmationUrl: null,
      filledFields: 0,
      blockedReasons: ['Cloudflare Browser Rendering binding is not available'],
      fields: [],
    });
  }

  const [profileResult, coverResult] = await Promise.all([
    db.execute({
      sql: 'SELECT id, category, label, answer, sensitive, created_at, updated_at FROM profile_answers WHERE user_id = ? ORDER BY updated_at DESC',
      args: [userId],
    }),
    db.execute({
      sql: 'SELECT id, content FROM cover_letters WHERE job_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 1',
      args: [queue.job_id, userId],
    }),
  ]);
  const profileAnswers = JSON.parse(JSON.stringify(profileResult.rows)) as ProfileAnswer[];
  const cover = JSON.parse(JSON.stringify(coverResult.rows[0] ?? null)) as CoverLetterRow | null;

  try {
    const page = await browser.newPage();
    await page.goto(queue.url, { waitUntil: 'domcontentloaded', timeout: 15_000 });
    const preflight = await page.evaluate(
      ({ answers, coverLetter }) => {
        const normalize = (value: string) =>
          value
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, ' ')
            .trim();
        const visible = (el: Element) => {
          const style = window.getComputedStyle(el);
          const rect = (el as HTMLElement).getBoundingClientRect();
          return (
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            rect.width > 0 &&
            rect.height > 0
          );
        };
        const labelFor = (el: HTMLElement) => {
          const id = el.getAttribute('id');
          const explicit = id
            ? (document.querySelector(`label[for="${CSS.escape(id)}"]`) as HTMLElement | null)
                ?.innerText
            : '';
          const wrapping = el.closest('label')?.textContent ?? '';
          const container =
            el.closest(
              '.field, .question, .application-question, [data-automation-id], [data-testid*="question"], [class*="form-field"]'
            )?.textContent ?? '';
          return (
            [
              el.getAttribute('aria-label') ?? '',
              explicit,
              wrapping,
              (el as HTMLInputElement | HTMLTextAreaElement).placeholder ?? '',
              el.getAttribute('name') ?? '',
              container,
            ]
              .map((part) =>
                String(part ?? '')
                  .replace(/\s+/g, ' ')
                  .trim()
              )
              .find(Boolean) ?? ''
          );
        };
        const optionLabel = (input: HTMLInputElement) => {
          const explicit = input.id
            ? (document.querySelector(`label[for="${CSS.escape(input.id)}"]`) as HTMLElement | null)
                ?.innerText
            : '';
          return (explicit || input.closest('label')?.textContent || input.value || '').trim();
        };
        const bestAnswer = (label: string) => {
          const target = normalize(label);
          let best: { answer: string; score: number } | null = null;
          for (const answer of answers) {
            const labelText = normalize(answer.label);
            const terms = labelText.split(' ').filter((term: string) => term.length > 2);
            const score =
              (target.includes(labelText) || labelText.includes(target) ? 8 : 0) +
              terms.filter((term: string) => target.includes(term)).length;
            if (score > 0 && (!best || score > best.score)) best = { answer: answer.answer, score };
          }
          return best && best.score >= 2 ? best.answer : null;
        };
        const setNativeValue = (el: HTMLInputElement | HTMLTextAreaElement, value: string) => {
          const proto =
            el instanceof HTMLTextAreaElement
              ? HTMLTextAreaElement.prototype
              : HTMLInputElement.prototype;
          const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
          descriptor?.set?.call(el, value);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        };
        const controls = Array.from(
          document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
            'input, textarea, select'
          )
        ).filter(
          (el) =>
            visible(el) && !el.disabled && !(el as HTMLInputElement | HTMLTextAreaElement).readOnly
        );
        const fields: Array<{ label: string; value: string; source: 'ats' }> = [];
        let filled = 0;
        for (const control of controls) {
          if (
            control instanceof HTMLInputElement &&
            ['hidden', 'file', 'submit', 'button', 'password'].includes(control.type)
          )
            continue;
          const label = labelFor(control);
          const existingValue =
            control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement
              ? control.value
              : control.value;
          if (
            existingValue &&
            !(control instanceof HTMLInputElement && ['checkbox', 'radio'].includes(control.type))
          ) {
            fields.push({
              label: label || control.name || 'Application field',
              value: existingValue.slice(0, 500),
              source: 'ats',
            });
            continue;
          }
          if (
            control instanceof HTMLInputElement &&
            (control.type === 'checkbox' || control.type === 'radio')
          ) {
            const answer = bestAnswer(`${label} ${optionLabel(control)}`);
            if (!answer) continue;
            const desired = normalize(answer);
            const option = normalize(optionLabel(control));
            if (
              desired.includes(option) ||
              option.includes(desired) ||
              /^(yes|true|authorized|eligible|agree)/.test(desired)
            ) {
              control.checked = true;
              control.dispatchEvent(new Event('change', { bubbles: true }));
              fields.push({
                label: label || optionLabel(control),
                value: answer.slice(0, 500),
                source: 'ats',
              });
              filled++;
            }
            continue;
          }
          if (
            control instanceof HTMLTextAreaElement &&
            coverLetter &&
            /cover|message|why|interest|additional/i.test(label)
          ) {
            setNativeValue(control, coverLetter);
            fields.push({
              label: label || 'Cover letter',
              value: coverLetter.slice(0, 500),
              source: 'ats',
            });
            filled++;
            continue;
          }
          const answer = bestAnswer(label);
          if (!answer) continue;
          if (control instanceof HTMLSelectElement) {
            const target = normalize(answer);
            const option = Array.from(control.options).find((item) => {
              const labelText = normalize(`${item.label} ${item.text} ${item.value}`);
              return labelText.includes(target) || target.includes(labelText);
            });
            if (!option) continue;
            control.value = option.value;
            control.dispatchEvent(new Event('change', { bubbles: true }));
            fields.push({ label, value: answer.slice(0, 500), source: 'ats' });
            filled++;
            continue;
          }
          setNativeValue(control, answer);
          fields.push({ label, value: answer.slice(0, 500), source: 'ats' });
          filled++;
        }

        const text = document.body.innerText.toLowerCase();
        const captchaDetected =
          /captcha|recaptcha|hcaptcha|verify you are human/.test(text) ||
          Boolean(
            document.querySelector(
              '.g-recaptcha, .h-captcha, [data-sitekey], iframe[src*="captcha"], iframe[src*="turnstile"]'
            )
          );
        const uploadFields = controls
          .filter(
            (el): el is HTMLInputElement =>
              el instanceof HTMLInputElement && el.type === 'file' && !el.value
          )
          .map((el) => labelFor(el) || el.name || 'File upload');
        const missingRequired: string[] = [];
        const radioGroups = new Set<string>();
        for (const control of controls) {
          const required = control.required || control.getAttribute('aria-required') === 'true';
          if (!required || (control instanceof HTMLInputElement && control.type === 'file'))
            continue;
          const label = labelFor(control) || control.getAttribute('name') || 'Required field';
          if (control instanceof HTMLInputElement && control.type === 'radio') {
            const group = control.name || label;
            if (radioGroups.has(group)) continue;
            radioGroups.add(group);
            const checked = Array.from(
              document.querySelectorAll<HTMLInputElement>(
                `input[type="radio"][name="${CSS.escape(control.name)}"]`
              )
            ).some((item) => item.checked);
            if (!checked) missingRequired.push(label);
          } else if (control instanceof HTMLInputElement && control.type === 'checkbox') {
            if (!control.checked) missingRequired.push(label);
          } else if (!control.value.trim()) {
            missingRequired.push(label);
          }
        }
        const submitButton = Array.from(
          document.querySelectorAll<HTMLElement>('button, input[type="submit"], [role="button"]')
        )
          .filter(
            (el) =>
              visible(el) && !('disabled' in el && Boolean((el as HTMLButtonElement).disabled))
          )
          .find((el) =>
            /submit|send|send application|apply now|complete application/i.test(
              (el as HTMLElement).innerText || (el as HTMLInputElement).value || ''
            )
          );
        const blockedReasons = [
          ...(captchaDetected ? ['CAPTCHA or human verification is present'] : []),
          ...(uploadFields.length > 0 ? ['Manual file upload is still required'] : []),
          ...(missingRequired.length > 0
            ? [`Required fields are empty: ${missingRequired.slice(0, 8).join(', ')}`]
            : []),
          ...(!submitButton ? ['No visible submit button was detected'] : []),
        ];
        if (blockedReasons.length === 0 && submitButton) {
          setTimeout(() => submitButton.click(), 50);
        }
        return {
          blockedReasons,
          filled,
          submitClicked: blockedReasons.length === 0 && Boolean(submitButton),
          fields: fields.slice(0, 30),
        };
      },
      { answers: profileAnswers, coverLetter: cover?.content ?? '' }
    );

    if (!preflight.submitClicked) {
      return recordGuardedSubmitResult(userId, queue, {
        provider,
        status: 'needs_user',
        summary: `Guarded submit blocked: ${preflight.blockedReasons.join('; ')}`,
        failureCode: classifyGuardedSubmitFailureCode(preflight.blockedReasons),
        failureReason: null,
        submitClicked: false,
        confirmationUrl: null,
        filledFields: preflight.filled,
        blockedReasons: preflight.blockedReasons,
        fields: preflight.fields,
      });
    }

    await sleep(4500);
    const confirmation = await page.evaluate(() => {
      const text = document.body.innerText.replace(/\s+/g, ' ').trim().slice(0, 1200);
      const confirmed =
        /thank|thanks|submitted|received|successfully applied|application sent|confirmation/i.test(
          `${location.href} ${text}`
        );
      return { url: location.href, text, confirmed };
    });
    if (!confirmation.confirmed) {
      return recordGuardedSubmitResult(userId, queue, {
        provider,
        status: 'failed',
        summary: 'Guarded submit clicked submit, but no ATS confirmation was detected.',
        failureCode: 'confirmation_missing',
        failureReason: 'No ATS confirmation page detected after submit click',
        submitClicked: true,
        confirmationUrl: confirmation.url,
        filledFields: preflight.filled,
        blockedReasons: [],
        fields: preflight.fields,
      });
    }

    return recordGuardedSubmitResult(userId, queue, {
      provider,
      status: 'submitted',
      summary: 'Guarded submit completed and detected an ATS confirmation.',
      failureCode: null,
      failureReason: null,
      submitClicked: true,
      confirmationUrl: confirmation.url,
      filledFields: preflight.filled,
      blockedReasons: [],
      fields: [
        ...preflight.fields,
        { label: 'Confirmation text', value: confirmation.text, source: 'ats' },
      ],
    });
  } catch (err) {
    return recordGuardedSubmitResult(userId, queue, {
      provider,
      status: 'failed',
      summary: `Guarded submit failed: ${err instanceof Error ? err.message : String(err)}`,
      failureCode: 'runtime_failure',
      failureReason: err instanceof Error ? err.message : String(err),
      submitClicked: false,
      confirmationUrl: null,
      filledFields: 0,
      blockedReasons: ['Guarded submit runtime failure'],
      fields: [],
    });
  } finally {
    await browser.close();
  }
}

export async function runGuardedApplyBrowserSubmitBatchForUser(
  userId: string,
  input: { queueIds?: string[]; limit?: number } = {}
): Promise<GuardedBrowserSubmitBatchResult> {
  const allowance = await getGuardedSubmitAllowance(userId);
  if (allowance.remaining <= 0) {
    throw new Error(
      `Daily guarded submit cap reached (${allowance.used}/${allowance.cap}). Raise the safety cap or wait before submitting more applications.`
    );
  }

  const requestedIds = [...new Set((input.queueIds ?? []).map((id) => id.trim()).filter(Boolean))];
  const limitSeed = input.limit ?? (requestedIds.length || 3);
  const limit = Math.max(1, Math.min(Number(limitSeed), 5, allowance.remaining));
  let queueIds = requestedIds.slice(0, limit);

  if (queueIds.length === 0) {
    const result = await db.execute({
      sql: `SELECT id
            FROM application_queue
            WHERE user_id = ? AND status = 'ready_to_submit'
            ORDER BY updated_at DESC
            LIMIT ?`,
      args: [userId, limit],
    });
    queueIds = (JSON.parse(JSON.stringify(result.rows)) as QueueIdRow[]).map((row) => row.id);
  }

  const results: GuardedBrowserSubmitResult[] = [];
  const errors: GuardedBrowserSubmitBatchResult['errors'] = [];
  for (const queueId of queueIds) {
    try {
      results.push(await runGuardedApplyBrowserSubmitForUser(userId, queueId));
    } catch (err) {
      errors.push({
        queue_id: queueId,
        error: err instanceof Error ? err.message : 'Guarded submit failed',
      });
    }
  }

  return {
    requested: queueIds.length,
    processed: results.length,
    results,
    errors,
  };
}

async function recordGuardedSubmitResult(
  userId: string,
  queue: QueueJobRow,
  result: {
    provider: string;
    status: GuardedBrowserSubmitResult['status'];
    summary: string;
    failureCode: ApplyAgentFailureCode | null;
    failureReason: string | null;
    submitClicked: boolean;
    confirmationUrl: string | null;
    filledFields: number;
    blockedReasons: string[];
    fields: ApplicationReceiptField[];
  }
): Promise<GuardedBrowserSubmitResult> {
  const receiptId = uuid();
  const receiptFields: ApplicationReceiptField[] = [
    { label: 'Browser runner mode', value: 'Guarded browser submit', source: 'system' },
    { label: 'Runtime', value: 'cloudflare_browser', source: 'system' },
    { label: 'Provider', value: result.provider, source: 'system' },
    { label: 'Submit clicked', value: result.submitClicked ? 'Yes' : 'No', source: 'system' },
    { label: 'Filled fields', value: String(result.filledFields), source: 'system' },
    { label: 'Failure code', value: result.failureCode ?? 'none', source: 'system' },
    {
      label: 'Blocked reasons',
      value: result.blockedReasons.length ? result.blockedReasons.join(' | ') : 'None',
      source: 'system',
    },
    ...result.fields,
  ];
  const receiptStatus = result.status === 'submitted' ? 'submitted' : 'failed';
  await db.execute({
    sql: `INSERT INTO application_receipts (
            id, job_id, queue_id, user_id, provider, status, fields_json, resume_id,
            cover_letter_id, confirmation_text, confirmation_url, failure_reason
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      receiptId,
      queue.job_id,
      queue.id,
      userId,
      result.provider,
      receiptStatus,
      JSON.stringify(receiptFields),
      queue.resume_id,
      null,
      result.summary,
      result.confirmationUrl ?? queue.url,
      result.failureReason,
    ],
  });

  if (result.status === 'submitted') {
    await db.execute({
      sql: `UPDATE job_applications
            SET status = 'applied', updated_at = unixepoch()
            WHERE id = ? AND user_id = ?`,
      args: [queue.job_id, userId],
    });
  }

  const readiness = parseReadiness(queue.readiness_json);
  await db.execute({
    sql: `UPDATE application_queue
          SET status = ?, readiness_json = ?, updated_at = unixepoch()
          WHERE id = ? AND user_id = ?`,
    args: [
      result.status,
      JSON.stringify({
        ...readiness,
        status: result.status,
        summary: result.summary,
        missing: result.status === 'submitted' ? [] : result.blockedReasons,
        checks: { ...readiness.checks, receipt: true },
      }),
      queue.id,
      userId,
    ],
  });

  return {
    queue_id: queue.id,
    job_id: queue.job_id,
    url: queue.url,
    provider: result.provider,
    runtime: 'cloudflare_browser',
    status: result.status,
    summary: result.summary,
    failure_code: result.failureCode,
    failure_reason: result.failureReason,
    submit_clicked: result.submitClicked,
    confirmation_url: result.confirmationUrl,
    filled_fields: result.filledFields,
    blocked_reasons: result.blockedReasons,
    receipt_id: receiptId,
  };
}
