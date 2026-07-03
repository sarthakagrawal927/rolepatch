import type {
  ApplyPacket,
  ApplyPacketProfileAnswer,
  ExtensionMessage,
  FileAttachment,
  FillResult,
  ReceiptField,
  ScrapedJob,
  SubmitResult,
} from './types';

function textFromSelector(selector: string): string | null {
  const node = document.querySelector(selector);
  if (!node) return null;
  const text = (node as HTMLElement).innerText?.trim();
  return text && text.length > 0 ? text : null;
}

function scrapeGreenhouse(): Partial<ScrapedJob> | null {
  if (!/greenhouse\.io/.test(location.hostname)) return null;
  const title = textFromSelector('h1.app-title') ?? textFromSelector('h1');
  const company = textFromSelector('.company-name') ?? textFromSelector('span.company-name');
  const description =
    textFromSelector('#content') ??
    textFromSelector('.content') ??
    textFromSelector('[class*="job__description"]');
  if (!description) return null;
  return {
    title: title ?? document.title,
    company: company ?? undefined,
    description,
    source: 'greenhouse',
  };
}

function scrapeLever(): Partial<ScrapedJob> | null {
  if (!/lever\.co/.test(location.hostname)) return null;
  const title = textFromSelector('.posting-headline h2') ?? textFromSelector('h2');
  const company = textFromSelector('.main-header-logo img')
    ? (document.querySelector('.main-header-logo img') as HTMLImageElement | null)?.alt ?? undefined
    : undefined;
  const description =
    textFromSelector('.posting-page .section-wrapper') ??
    textFromSelector('[data-qa="job-description"]') ??
    textFromSelector('.content');
  if (!description) return null;
  return { title: title ?? document.title, company, description, source: 'lever' };
}

function scrapeLinkedIn(): Partial<ScrapedJob> | null {
  if (!/linkedin\.com/.test(location.hostname)) return null;
  const title =
    textFromSelector('.top-card-layout__title') ??
    textFromSelector('.job-details-jobs-unified-top-card__job-title') ??
    textFromSelector('h1');
  const company =
    textFromSelector('.topcard__org-name-link') ??
    textFromSelector('.job-details-jobs-unified-top-card__company-name');
  const description =
    textFromSelector('.description__text') ??
    textFromSelector('#job-details') ??
    textFromSelector('.jobs-description__content');
  if (!description) return null;
  return {
    title: title ?? document.title,
    company: company ?? undefined,
    description,
    source: 'linkedin',
  };
}

function scrapeWorkday(): Partial<ScrapedJob> | null {
  if (!/workday\.com|myworkdayjobs\.com/.test(location.hostname)) return null;
  const title =
    textFromSelector('[data-automation-id="jobPostingHeader"]') ?? textFromSelector('h2');
  const description =
    textFromSelector('[data-automation-id="jobPostingDescription"]') ??
    textFromSelector('[data-automation-id="job-posting-details"]');
  if (!description) return null;
  return { title: title ?? document.title, description, source: 'workday' };
}

function scrapeAshby(): Partial<ScrapedJob> | null {
  if (!/ashbyhq\.com/.test(location.hostname)) return null;
  const title =
    textFromSelector('[data-testid="job-title"]') ??
    textFromSelector('[class*="jobPostingTitle"]') ??
    textFromSelector('h1');
  const description =
    textFromSelector('[data-testid="job-description"]') ??
    textFromSelector('[class*="jobPostingDescription"]') ??
    textFromSelector('main');
  if (!description) return null;
  return { title: title ?? document.title, description, source: 'ashby' };
}

function scrapeWorkable(): Partial<ScrapedJob> | null {
  if (!/workable\.com/.test(location.hostname)) return null;
  const title =
    textFromSelector('[data-ui="job-title"]') ??
    textFromSelector('[class*="job-title"]') ??
    textFromSelector('h1');
  const company =
    textFromSelector('[data-ui="company-name"]') ??
    textFromSelector('[class*="company"]');
  const description =
    textFromSelector('[data-ui="job-description"]') ??
    textFromSelector('[class*="job-description"]') ??
    textFromSelector('main');
  if (!description) return null;
  return { title: title ?? document.title, company: company ?? undefined, description, source: 'workable' };
}

function scrapeRecruitee(): Partial<ScrapedJob> | null {
  if (!/recruitee\.com/.test(location.hostname)) return null;
  const title =
    textFromSelector('[data-testid="offer-title"]') ??
    textFromSelector('[class*="offer-title"]') ??
    textFromSelector('h1');
  const description =
    textFromSelector('[data-testid="offer-description"]') ??
    textFromSelector('[class*="offer-description"]') ??
    textFromSelector('main');
  if (!description) return null;
  return { title: title ?? document.title, description, source: 'recruitee' };
}

function scrapePersonio(): Partial<ScrapedJob> | null {
  if (!/personio\.(com|de)/.test(location.hostname)) return null;
  const title =
    textFromSelector('[data-testid="job-title"]') ??
    textFromSelector('[class*="job-title"]') ??
    textFromSelector('h1');
  const company =
    textFromSelector('[data-testid="company-name"]') ??
    textFromSelector('[class*="company"]');
  const description =
    textFromSelector('[data-testid="job-description"]') ??
    textFromSelector('[class*="job-description"]') ??
    textFromSelector('main');
  if (!description) return null;
  return { title: title ?? document.title, company: company ?? undefined, description, source: 'personio' };
}

function scrapeGeneric(): Partial<ScrapedJob> {
  const candidate =
    textFromSelector('main') ?? textFromSelector('article') ?? document.body.innerText;
  const description = candidate.replace(/\n{3,}/g, '\n\n').trim();
  return { title: document.title, description, source: 'generic' };
}

function scrape(): ScrapedJob {
  const partial =
    scrapeGreenhouse() ??
    scrapeLever() ??
    scrapeLinkedIn() ??
    scrapeWorkday() ??
    scrapeAshby() ??
    scrapeWorkable() ??
    scrapeRecruitee() ??
    scrapePersonio() ??
    scrapeGeneric();
  return {
    url: location.href,
    title: partial.title ?? document.title,
    company: partial.company,
    description: partial.description ?? '',
    source: partial.source ?? 'generic',
  };
}

function provider(): string {
  const host = location.hostname.toLowerCase();
  if (host.includes('greenhouse.io')) return 'greenhouse';
  if (host.includes('lever.co')) return 'lever';
  if (host.includes('workday')) return 'workday';
  if (host.includes('ashbyhq.com')) return 'ashby';
  if (host.includes('workable.com')) return 'workable';
  if (host.includes('recruitee.com')) return 'recruitee';
  if (host.includes('personio.')) return 'personio';
  return host.replace(/^www\./, '') || 'generic';
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function labelFor(el: HTMLElement): string {
  const aria = el.getAttribute('aria-label') ?? el.getAttribute('data-qa') ?? '';
  const id = el.getAttribute('id');
  const explicit = id
    ? (document.querySelector(`label[for="${CSS.escape(id)}"]`) as HTMLElement | null)?.innerText
    : '';
  const wrapping = el.closest('label')?.textContent ?? '';
  const container =
    el.closest(
      [
        '.field',
        '.application-question',
        '.question',
        '[data-automation-id]',
        '.posting-field',
        '[data-testid*="question"]',
        '[data-testid*="field"]',
        '[class*="form-field"]',
        '[class*="FormField"]',
        '[class*="application"]',
        '[class*="Application"]',
      ].join(', ')
    )
      ?.textContent ?? '';
  const placeholder = (el as HTMLInputElement | HTMLTextAreaElement).placeholder ?? '';
  const name = el.getAttribute('name') ?? '';
  return [aria, explicit, wrapping, placeholder, name, container]
    .map((part) => part?.replace(/\s+/g, ' ').trim())
    .find(Boolean) ?? '';
}

function optionLabel(input: HTMLInputElement): string {
  const id = input.id;
  const explicit = id
    ? (document.querySelector(`label[for="${CSS.escape(id)}"]`) as HTMLElement | null)?.innerText
    : '';
  return (explicit || input.closest('label')?.textContent || input.value || '').trim();
}

function bestAnswer(label: string, answers: ApplyPacketProfileAnswer[]): ApplyPacketProfileAnswer | null {
  const target = normalize(label);
  if (!target) return null;
  let best: { answer: ApplyPacketProfileAnswer; score: number } | null = null;
  for (const answer of answers) {
    const labelText = normalize(answer.label);
    const categoryText = normalize(answer.category);
    const labelTerms = labelText.split(' ').filter((term) => term.length > 2);
    const score =
      (target.includes(labelText) || labelText.includes(target) ? 8 : 0) +
      labelTerms.filter((term) => target.includes(term)).length +
      (categoryText && target.includes(categoryText) ? 2 : 0);
    if (score > 0 && (!best || score > best.score)) best = { answer, score };
  }
  return best?.score && best.score >= 2 ? best.answer : null;
}

function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
  descriptor?.set?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function selectOption(select: HTMLSelectElement, value: string): boolean {
  const target = normalize(value);
  const option = Array.from(select.options).find((item) => {
    const label = normalize(`${item.label} ${item.text} ${item.value}`);
    return label.includes(target) || target.includes(label);
  });
  if (!option) return false;
  select.value = option.value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

function bytesFromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function fileFromAttachment(attachment: FileAttachment): File {
  const bytes = bytesFromBase64(attachment.base64);
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const blob = new Blob([buffer], {
    type: attachment.type || 'application/octet-stream',
  });
  return new File([blob], attachment.name, {
    type: attachment.type || 'application/octet-stream',
  });
}

function attachmentForInput(
  input: HTMLInputElement,
  attachments: FileAttachment[],
  usedNames: Set<string>
): FileAttachment | null {
  const label = normalize(`${labelFor(input)} ${input.name} ${input.id}`);
  const candidates = attachments.filter((attachment) => !usedNames.has(attachment.name));
  if (candidates.length === 0) return null;
  if (/cover|letter|motivation/i.test(label)) {
    return candidates.find((attachment) => attachment.kind === 'cover_letter') ?? null;
  }
  if (/resume|cv|curriculum|profile/i.test(label)) {
    return candidates.find((attachment) => attachment.kind === 'resume') ?? candidates[0] ?? null;
  }
  return candidates.length === 1 ? candidates[0] : null;
}

function attachFiles(
  attachments: FileAttachment[],
  fields: ReceiptField[]
): { uploaded: string[]; remaining: string[] } {
  const fileInputs = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="file"]'))
    .filter((el) => !el.disabled)
    .slice(0, 12);
  const usedNames = new Set<string>();
  const uploaded: string[] = [];
  const remaining: string[] = [];

  for (const input of fileInputs) {
    if (input.files && input.files.length > 0) continue;
    const label = labelFor(input) || input.name || 'File upload';
    const attachment = attachmentForInput(input, attachments, usedNames);
    if (!attachment) {
      remaining.push(label);
      continue;
    }
    const dt = new DataTransfer();
    dt.items.add(fileFromAttachment(attachment));
    input.files = dt.files;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    usedNames.add(attachment.name);
    uploaded.push(`${label}: ${attachment.name}`);
    fields.push({ label, value: attachment.name, source: 'user' });
  }

  return { uploaded, remaining };
}

function fillInput(
  el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  packet: ApplyPacket,
  fields: ReceiptField[]
): boolean {
  if (el instanceof HTMLInputElement && ['hidden', 'file', 'submit', 'button', 'password'].includes(el.type)) {
    return false;
  }
  if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) {
    const label = `${labelFor(el)} ${optionLabel(el)}`;
    const answer = bestAnswer(label, packet.profile_answers);
    if (!answer) return false;
    const desired = normalize(answer.answer);
    const option = normalize(optionLabel(el));
    const isPositive = /^(yes|true|authorized|eligible|i agree|agree|available)/.test(desired);
    if (desired.includes(option) || option.includes(desired) || isPositive) {
      el.checked = true;
      el.dispatchEvent(new Event('change', { bubbles: true }));
      fields.push({ label: labelFor(el) || optionLabel(el), value: answer.answer, source: 'profile' });
      return true;
    }
    return false;
  }

  const label = labelFor(el);
  const isTextarea = el instanceof HTMLTextAreaElement;
  const wantsCoverLetter = isTextarea && /cover|message|why|interest|additional/i.test(label);
  if (wantsCoverLetter && packet.cover_letter_text) {
    setNativeValue(el as HTMLTextAreaElement, packet.cover_letter_text);
    fields.push({ label: label || 'Cover letter', value: packet.cover_letter_text.slice(0, 500), source: 'cover_letter' });
    return true;
  }

  const answer = bestAnswer(label, packet.profile_answers);
  if (!answer) return false;
  if (el instanceof HTMLSelectElement) {
    const filled = selectOption(el, answer.answer);
    if (filled) fields.push({ label, value: answer.answer, source: 'profile' });
    return filled;
  }
  setNativeValue(el, answer.answer);
  fields.push({ label, value: answer.answer, source: 'profile' });
  return true;
}

function visible(el: HTMLElement): boolean {
  const style = getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
}

function fillApplication(packet: ApplyPacket, attachments: FileAttachment[] = []): FillResult {
  const fields: ReceiptField[] = [];
  const uploadResult = attachFiles(attachments, fields);
  const controls = Array.from(
    document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      'input, textarea, select'
    )
  ).filter((el) => visible(el) && !el.disabled && !(el as HTMLInputElement | HTMLTextAreaElement).readOnly);
  const uploadFields = controls
    .filter((el): el is HTMLInputElement => el instanceof HTMLInputElement && el.type === 'file')
    .map((el) => labelFor(el) || el.name || 'File upload')
    .filter((label) => !uploadResult.uploaded.some((uploaded) => uploaded.startsWith(`${label}:`)))
    .concat(uploadResult.remaining)
    .filter((value, index, values) => values.indexOf(value) === index)
    .slice(0, 12);

  let filled = 0;
  let skipped = 0;
  for (const control of controls) {
    const input = control as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    const hasValue =
      input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement
        ? Boolean(input.value)
        : Boolean(input.value);
    if (hasValue && !(input instanceof HTMLInputElement && ['checkbox', 'radio'].includes(input.type))) {
      skipped++;
      continue;
    }
    if (fillInput(input, packet, fields)) filled++;
    else skipped++;
  }

  const submitDetected = Boolean(
    Array.from(document.querySelectorAll('button, input[type="submit"]')).find((el) =>
      /submit|apply|send|send application|submit application/i.test(
        (el as HTMLElement).innerText || (el as HTMLInputElement).value || ''
      )
    )
  );

  return {
    ok: true,
    job_id: packet.job_id,
    url: packet.ats_url,
    provider: packet.ats_provider || provider(),
    filled,
    detected: controls.length,
    skipped,
    submit_detected: submitDetected,
    upload_fields: uploadFields,
    uploaded_files: uploadResult.uploaded,
    fields,
  };
}

function textForSubmit(el: Element): string {
  if (el instanceof HTMLInputElement) return el.value || el.getAttribute('aria-label') || '';
  return (el as HTMLElement).innerText || el.getAttribute('aria-label') || '';
}

function findSubmitButton(): HTMLElement | null {
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>('button, input[type="submit"], [role="button"]')
  ).filter((el) => visible(el) && !('disabled' in el && Boolean((el as HTMLButtonElement).disabled)));
  return (
    candidates.find((el) => /submit|send|send application|apply now|complete application/i.test(textForSubmit(el))) ??
    candidates.find((el) => /continue|next/i.test(textForSubmit(el))) ??
    null
  );
}

function detectCaptcha(): boolean {
  const bodyText = document.body.innerText || '';
  if (/captcha|recaptcha|human verification|verify you are human/i.test(bodyText)) return true;
  return Boolean(
    document.querySelector(
      '.g-recaptcha, .h-captcha, [data-sitekey], iframe[src*="captcha"], iframe[src*="turnstile"]'
    )
  );
}

function requiredUnfilledFields(): string[] {
  const controls = Array.from(
    document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      'input, textarea, select'
    )
  ).filter((el) => visible(el) && !el.disabled && !(el as HTMLInputElement | HTMLTextAreaElement).readOnly);
  const missing: string[] = [];
  const radioGroups = new Set<string>();

  for (const control of controls) {
    const required = control.required || control.getAttribute('aria-required') === 'true';
    if (!required) continue;
    if (control instanceof HTMLInputElement && control.type === 'file') continue;
    const label = labelFor(control) || control.getAttribute('name') || 'Required field';
    if (control instanceof HTMLInputElement && control.type === 'radio') {
      const group = control.name || label;
      if (radioGroups.has(group)) continue;
      radioGroups.add(group);
      const checked = Array.from(
        document.querySelectorAll<HTMLInputElement>(`input[type="radio"][name="${CSS.escape(control.name)}"]`)
      ).some((item) => item.checked);
      if (!checked) missing.push(label);
      continue;
    }
    if (control instanceof HTMLInputElement && control.type === 'checkbox') {
      if (!control.checked) missing.push(label);
      continue;
    }
    if (!control.value.trim()) missing.push(label);
  }

  return Array.from(new Set(missing.map((item) => item.replace(/\s+/g, ' ').trim()).filter(Boolean))).slice(0, 12);
}

function pendingUploadFields(): string[] {
  return Array.from(document.querySelectorAll<HTMLInputElement>('input[type="file"]'))
    .filter((el) => !el.disabled && !el.value)
    .map((el) => labelFor(el) || el.name || 'File upload')
    .map((item) => item.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 12);
}

function fieldValueForSnapshot(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): string | null {
  if (el instanceof HTMLInputElement && ['hidden', 'password', 'submit', 'button'].includes(el.type)) {
    return null;
  }
  if (el instanceof HTMLInputElement && el.type === 'file') {
    return el.files?.length ? Array.from(el.files).map((file) => file.name).join(', ') : null;
  }
  if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) {
    if (!el.checked) return null;
    return optionLabel(el) || el.value || 'Selected';
  }
  const value = el.value?.trim();
  if (!value) return null;
  if (el instanceof HTMLSelectElement) {
    return el.selectedOptions[0]?.text?.trim() || value;
  }
  return value;
}

function snapshotApplicationFields(): ReceiptField[] {
  const fields: ReceiptField[] = [];
  const seen = new Set<string>();
  const controls = Array.from(
    document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      'input, textarea, select'
    )
  ).filter((el) => visible(el) && !el.disabled);

  for (const control of controls) {
    const value = fieldValueForSnapshot(control);
    if (!value) continue;
    const label = (labelFor(control) || control.name || control.id || 'Application field')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 160);
    const key = `${label}:${value}`;
    if (seen.has(key)) continue;
    seen.add(key);
    fields.push({
      label,
      value: value.replace(/\s+/g, ' ').trim().slice(0, 500),
      source: 'ats',
    });
    if (fields.length >= 30) break;
  }
  return fields;
}

function submitApplication(packet: ApplyPacket): SubmitResult {
  const uploadFields = pendingUploadFields();
  const requiredFields = requiredUnfilledFields();
  const captchaDetected = detectCaptcha();
  const submitButton = findSubmitButton();
  const blockedReasons = [
    ...(captchaDetected ? ['CAPTCHA or human verification is present'] : []),
    ...(uploadFields.length > 0 ? ['Manual file upload is still required'] : []),
    ...(requiredFields.length > 0 ? ['Required fields are still empty'] : []),
    ...(!submitButton ? ['No visible submit button was detected'] : []),
  ];

  if (blockedReasons.length > 0 || !submitButton) {
    return {
      ok: false,
      job_id: packet.job_id,
      url: packet.ats_url,
      provider: packet.ats_provider || provider(),
      submit_clicked: false,
      captcha_detected: captchaDetected,
      upload_fields: uploadFields,
      required_fields: requiredFields,
      blocked_reasons: blockedReasons,
      error: blockedReasons.join('; '),
    };
  }

  const submitLabel = textForSubmit(submitButton).replace(/\s+/g, ' ').trim().slice(0, 120);
  setTimeout(() => submitButton.click(), 50);
  return {
    ok: true,
    job_id: packet.job_id,
    url: packet.ats_url,
    provider: packet.ats_provider || provider(),
    submit_clicked: true,
    submit_label: submitLabel || 'Submit',
    captcha_detected: false,
    upload_fields: [],
    required_fields: [],
    blocked_reasons: [],
  };
}

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  if (message.type === 'SCRAPE_JOB') {
    try {
      sendResponse({ ok: true, job: scrape() });
    } catch (err) {
      sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
    return true;
  }
  if (message.type === 'FILL_APPLICATION') {
    try {
      sendResponse(fillApplication(message.payload.packet, message.payload.files ?? []));
    } catch (err) {
      sendResponse({
        ok: false,
        job_id: message.payload.packet.job_id,
        url: message.payload.packet.ats_url,
        provider: message.payload.packet.ats_provider || provider(),
        filled: 0,
        detected: 0,
        skipped: 0,
        submit_detected: false,
        upload_fields: [],
        uploaded_files: [],
        fields: [],
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return true;
  }
  if (message.type === 'SNAPSHOT_APPLICATION_FIELDS') {
    try {
      sendResponse({ ok: true, fields: snapshotApplicationFields() });
    } catch (err) {
      sendResponse({
        ok: false,
        fields: [],
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return true;
  }
  if (message.type === 'SUBMIT_APPLICATION') {
    try {
      sendResponse(submitApplication(message.payload));
    } catch (err) {
      sendResponse({
        ok: false,
        job_id: message.payload.job_id,
        url: message.payload.ats_url,
        provider: message.payload.ats_provider || provider(),
        submit_clicked: false,
        captcha_detected: false,
        upload_fields: [],
        required_fields: [],
        blocked_reasons: [],
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return true;
  }
  return undefined;
});
