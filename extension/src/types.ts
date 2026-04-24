export interface ScrapedJob {
  url: string;
  title: string;
  company?: string;
  description: string;
  source: 'greenhouse' | 'lever' | 'linkedin' | 'workday' | 'generic';
}

export type ExtensionMessage =
  | { type: 'SCRAPE_JOB' }
  | { type: 'TAILOR_JOB'; payload: ScrapedJob };

export interface TailorResponse {
  ok: boolean;
  job_id?: string;
  redirect_url?: string;
  error?: string;
}
