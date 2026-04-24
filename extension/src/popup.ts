import { DEFAULT_API_BASE, getApiBase, setApiBase } from './config';
import type { ScrapedJob, TailorResponse } from './types';

const urlEl = document.getElementById('current-url') as HTMLParagraphElement;
const btn = document.getElementById('tailor-btn') as HTMLButtonElement;
const statusEl = document.getElementById('status') as HTMLDivElement;
const apiBaseInput = document.getElementById('api-base') as HTMLInputElement;

function setStatus(text: string, kind: 'success' | 'error' | '' = ''): void {
  statusEl.textContent = text;
  statusEl.className = `status${kind ? ` ${kind}` : ''}`;
}

async function getActiveTab(): Promise<chrome.tabs.Tab | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab ?? null;
}

async function scrapeFromTab(tabId: number): Promise<ScrapedJob> {
  // Ensure the content script is injected on pages that aren't declared in
  // content_scripts (we intentionally use on-demand injection via activeTab).
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content.js'],
  });
  const response = await chrome.tabs.sendMessage(tabId, { type: 'SCRAPE_JOB' });
  if (!response?.ok) throw new Error(response?.error ?? 'scrape failed');
  return response.job as ScrapedJob;
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

  btn.addEventListener('click', async () => {
    if (!tab?.id) {
      setStatus('No active tab', 'error');
      return;
    }
    btn.disabled = true;
    setStatus('Scraping job…');
    try {
      const job = await scrapeFromTab(tab.id);
      if (!job.description || job.description.length < 50) {
        throw new Error('Could not find a job description on this page.');
      }
      setStatus('Sending to RolePatch…');
      const res: TailorResponse = await chrome.runtime.sendMessage({
        type: 'TAILOR_JOB',
        payload: job,
      });
      const apiBase = await getApiBase();
      if (!res.ok) {
        if (res.redirect_url) {
          chrome.tabs.create({ url: `${apiBase}${res.redirect_url}` });
        }
        throw new Error(res.error ?? 'request failed');
      }
      setStatus('Done. Opening RolePatch…', 'success');
      if (res.redirect_url) {
        chrome.tabs.create({ url: `${apiBase}${res.redirect_url}` });
      }
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      btn.disabled = false;
    }
  });
}

void main();
