import {
  DEFAULT_API_BASE,
  getApiBase,
  setApiBase,
  STORAGE_KEY_LAST_PACKET,
} from './config';
import type {
  ApplyPacket,
  ExtensionApiResponse,
  FieldSnapshotResult,
  FileAttachment,
  FillResult,
  ReceiptField,
  ScrapedJob,
  SubmitResult,
  TailorResponse,
} from './types';

const urlEl = document.getElementById('current-url') as HTMLParagraphElement;
const saveBtn = document.getElementById('save-btn') as HTMLButtonElement;
const tailorBtn = document.getElementById('tailor-btn') as HTMLButtonElement;
const fillBtn = document.getElementById('fill-btn') as HTMLButtonElement;
const submitBtn = document.getElementById('submit-btn') as HTMLButtonElement;
const captureSubmitBtn = document.getElementById('capture-submit-btn') as HTMLButtonElement;
const statusEl = document.getElementById('status') as HTMLDivElement;
const apiBaseInput = document.getElementById('api-base') as HTMLInputElement;
const resumeFileInput = document.getElementById('resume-file') as HTMLInputElement;
const coverLetterFileInput = document.getElementById('cover-letter-file') as HTMLInputElement;

function setStatus(text: string, kind: 'success' | 'error' | '' = ''): void {
  statusEl.textContent = text;
  statusEl.className = `status${kind ? ` ${kind}` : ''}`;
}

function setBusy(busy: boolean): void {
  saveBtn.disabled = busy;
  tailorBtn.disabled = busy;
  fillBtn.disabled = busy;
  submitBtn.disabled = busy;
  captureSubmitBtn.disabled = busy;
  resumeFileInput.disabled = busy;
  coverLetterFileInput.disabled = busy;
}

async function getActiveTab(): Promise<chrome.tabs.Tab | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab ?? null;
}

async function injectContent(tabId: number): Promise<void> {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content.js'],
  });
}

async function scrapeFromTab(tabId: number): Promise<ScrapedJob> {
  await injectContent(tabId);
  const response = await chrome.tabs.sendMessage(tabId, { type: 'SCRAPE_JOB' });
  if (!response?.ok) throw new Error(response?.error ?? 'scrape failed');
  return response.job as ScrapedJob;
}

async function fetchPacket(url: string): Promise<ApplyPacket> {
  const res = (await chrome.runtime.sendMessage({
    type: 'FETCH_APPLY_PACKET',
    payload: { url },
  })) as ExtensionApiResponse;
  if (!res.ok || !res.packet) {
    const apiBase = await getApiBase();
    if (res.redirect_url) chrome.tabs.create({ url: `${apiBase}${res.redirect_url}` });
    throw new Error(res.error ?? 'No prepared packet found for this page.');
  }
  return res.packet;
}

async function saveLastPacket(packet: ApplyPacket): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY_LAST_PACKET]: packet });
}

async function getLastPacket(): Promise<ApplyPacket | null> {
  const stored = await chrome.storage.local.get(STORAGE_KEY_LAST_PACKET);
  const packet = stored[STORAGE_KEY_LAST_PACKET];
  return packet && typeof packet === 'object' ? (packet as ApplyPacket) : null;
}

async function fileToAttachment(file: File, kind: FileAttachment['kind']): Promise<FileAttachment> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return {
    kind,
    name: file.name,
    type: file.type,
    base64: btoa(binary),
  };
}

async function selectedAttachments(): Promise<FileAttachment[]> {
  const attachments: FileAttachment[] = [];
  const resumeFile = resumeFileInput.files?.[0];
  const coverLetterFile = coverLetterFileInput.files?.[0];
  if (resumeFile) attachments.push(await fileToAttachment(resumeFile, 'resume'));
  if (coverLetterFile) attachments.push(await fileToAttachment(coverLetterFile, 'cover_letter'));
  return attachments;
}

async function tailor(tab: chrome.tabs.Tab): Promise<void> {
  if (!tab.id) throw new Error('No active tab');
  setStatus('Scraping job...');
  const job = await scrapeFromTab(tab.id);
  if (!job.description || job.description.length < 50) {
    throw new Error('Could not find a job description on this page.');
  }
  setStatus('Sending to RolePatch...');
  const res = (await chrome.runtime.sendMessage({
    type: 'TAILOR_JOB',
    payload: job,
  })) as TailorResponse;
  const apiBase = await getApiBase();
  if (!res.ok) {
    if (res.redirect_url) chrome.tabs.create({ url: `${apiBase}${res.redirect_url}` });
    throw new Error(res.error ?? 'request failed');
  }
  setStatus('Done. Opening RolePatch...', 'success');
  if (res.redirect_url) chrome.tabs.create({ url: `${apiBase}${res.redirect_url}` });
}

async function saveJob(tab: chrome.tabs.Tab): Promise<void> {
  if (!tab.id) throw new Error('No active tab');
  setStatus('Scraping job...');
  const job = await scrapeFromTab(tab.id);
  if (!job.description || job.description.length < 50) {
    throw new Error('Could not find enough job description text on this page.');
  }
  setStatus('Saving to RolePatch queue...');
  const res = (await chrome.runtime.sendMessage({
    type: 'SAVE_JOB',
    payload: job,
  })) as ExtensionApiResponse;
  const apiBase = await getApiBase();
  if (!res.ok) {
    if (res.redirect_url) chrome.tabs.create({ url: `${apiBase}${res.redirect_url}` });
    throw new Error(res.error ?? 'Could not save this job.');
  }
  setStatus(res.existing ? 'Already tracked. Queue refreshed.' : 'Saved and queued.', 'success');
  if (res.redirect_url) chrome.tabs.create({ url: `${apiBase}${res.redirect_url}` });
}

async function fill(tab: chrome.tabs.Tab): Promise<void> {
  if (!tab.id || !tab.url) throw new Error('No active tab');
  setStatus('Fetching prepared packet...');
  const packet = await fetchPacket(tab.url);
  await injectContent(tab.id);
  setStatus('Filling visible fields...');
  const files = await selectedAttachments();
  const result = (await chrome.tabs.sendMessage(tab.id, {
    type: 'FILL_APPLICATION',
    payload: { packet, files },
  })) as FillResult;
  await saveLastPacket(packet);
  const receipt = (await chrome.runtime.sendMessage({
    type: 'RECORD_FILL_RECEIPT',
    payload: result,
  })) as ExtensionApiResponse;
  if (!receipt.ok) throw new Error(receipt.error ?? 'Could not record fill receipt');
  if (!result.ok) throw new Error(result.error ?? 'Fill failed');
  setStatus(
    `Filled ${result.filled}/${result.detected} fields. Uploaded ${result.uploaded_files.length} files. Review before submitting.`,
    'success'
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pageSnapshot(tabId: number): Promise<{ text: string; title: string }> {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => ({
      text: document.body.innerText.replace(/\s+/g, ' ').trim().slice(0, 1600),
      title: document.title,
    }),
  });
  return result ?? { text: '', title: '' };
}

async function fieldSnapshot(tabId: number): Promise<ReceiptField[]> {
  await injectContent(tabId);
  const result = (await chrome.tabs.sendMessage(tabId, {
    type: 'SNAPSHOT_APPLICATION_FIELDS',
  })) as FieldSnapshotResult;
  return result.ok ? result.fields : [];
}

function looksConfirmed(url: string, text: string): boolean {
  const target = `${url} ${text}`;
  return /thank|thanks|submitted|received|successfully applied|application sent|confirmation/i.test(target);
}

function submitFailureText(result: SubmitResult, confirmationUrl: string, confirmationText: string): string {
  if (!result.submit_clicked) return result.error ?? 'Reviewed submit was blocked before clicking.';
  return [
    'Reviewed submit clicked the ATS submit button, but RolePatch did not detect a confirmation page.',
    confirmationUrl ? `URL: ${confirmationUrl}` : '',
    confirmationText ? `Page: ${confirmationText.slice(0, 240)}` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

async function recordReviewedSubmit(
  packet: ApplyPacket,
  tab: chrome.tabs.Tab,
  result: SubmitResult,
  status: 'submitted' | 'failed',
  fields: ReceiptField[],
  failureReason?: string
): Promise<void> {
  if (!tab.id || !tab.url) throw new Error('No active tab');
  const snapshot = await pageSnapshot(tab.id);
  const receipt = (await chrome.runtime.sendMessage({
    type: 'RECORD_SUBMISSION_RECEIPT',
    payload: {
      job_id: packet.job_id,
      original_url: packet.ats_url,
      confirmation_url: tab.url,
      confirmation_text: snapshot.text || snapshot.title || document.title,
      provider: packet.ats_provider || result.provider,
      status,
      failure_reason: failureReason,
      mode: result.submit_clicked ? 'Extension reviewed submit' : 'Extension reviewed submit preflight',
      fields,
    },
  })) as ExtensionApiResponse;
  if (!receipt.ok) throw new Error(receipt.error ?? 'Could not record submit receipt');
}

async function submitReviewed(tab: chrome.tabs.Tab): Promise<void> {
  if (!tab.id || !tab.url) throw new Error('No active tab');
  const packet = await fetchPacket(tab.url);
  await saveLastPacket(packet);
  await injectContent(tab.id);

  const okToSubmit = window.confirm(
    'RolePatch will click the ATS submit button on this page. Continue only after you reviewed every field.'
  );
  if (!okToSubmit) {
    setStatus('Submit cancelled.');
    return;
  }

  setStatus('Checking page before submit...');
  const fields = await fieldSnapshot(tab.id);
  const result = (await chrome.tabs.sendMessage(tab.id, {
    type: 'SUBMIT_APPLICATION',
    payload: packet,
  })) as SubmitResult;

  if (!result.ok) {
    await recordReviewedSubmit(packet, tab, result, 'failed', fields, result.error);
    throw new Error(result.error ?? 'Reviewed submit was blocked.');
  }

  setStatus('Submit clicked. Waiting for ATS confirmation...');
  await sleep(4500);
  const updatedTab = await chrome.tabs.get(tab.id);
  const snapshot = await pageSnapshot(tab.id);
  const confirmed = looksConfirmed(updatedTab.url ?? tab.url, snapshot.text);
  if (!confirmed) {
    const failureReason = submitFailureText(result, updatedTab.url ?? tab.url ?? '', snapshot.text);
    await recordReviewedSubmit(packet, updatedTab, result, 'failed', fields, failureReason);
    throw new Error('Submit clicked, but no confirmation was detected. A failed receipt was recorded.');
  }

  await recordReviewedSubmit(packet, updatedTab, result, 'submitted', fields);
  setStatus('Application submitted and receipt captured in RolePatch.', 'success');
}

async function captureSubmitted(tab: chrome.tabs.Tab): Promise<void> {
  if (!tab.id || !tab.url) throw new Error('No active tab');
  const packet = await getLastPacket();
  if (!packet) throw new Error('Fill an application first so RolePatch knows which job this is.');
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => document.body.innerText.replace(/\s+/g, ' ').trim().slice(0, 1200),
  });
  const fields = await fieldSnapshot(tab.id);
  const receipt = (await chrome.runtime.sendMessage({
    type: 'RECORD_SUBMISSION_RECEIPT',
    payload: {
      job_id: packet.job_id,
      original_url: packet.ats_url,
      confirmation_url: tab.url,
      confirmation_text: result || document.title,
      provider: packet.ats_provider,
      status: 'submitted',
      mode: 'Manual submitted receipt capture',
      fields,
    },
  })) as ExtensionApiResponse;
  if (!receipt.ok) throw new Error(receipt.error ?? 'Could not record submitted receipt');
  setStatus('Submitted receipt captured in RolePatch.', 'success');
}

async function run(action: (tab: chrome.tabs.Tab) => Promise<void>): Promise<void> {
  const tab = await getActiveTab();
  if (!tab) {
    setStatus('No active tab', 'error');
    return;
  }
  setBusy(true);
  try {
    await action(tab);
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), 'error');
  } finally {
    setBusy(false);
  }
}

async function main(): Promise<void> {
  const tab = await getActiveTab();
  urlEl.textContent = tab?.url ?? 'No active tab';

  apiBaseInput.value = await getApiBase();
  apiBaseInput.placeholder = DEFAULT_API_BASE;
  apiBaseInput.addEventListener('change', async () => {
    const v = apiBaseInput.value.trim().replace(/\/$/, '');
    if (v) await setApiBase(v);
  });

  saveBtn.addEventListener('click', () => void run(saveJob));
  tailorBtn.addEventListener('click', () => void run(tailor));
  fillBtn.addEventListener('click', () => void run(fill));
  submitBtn.addEventListener('click', () => void run(submitReviewed));
  captureSubmitBtn.addEventListener('click', () => void run(captureSubmitted));
}

void main();
