export interface ScrapedJob {
  url: string;
  title: string;
  company?: string;
  description: string;
  source:
    | 'greenhouse'
    | 'lever'
    | 'linkedin'
    | 'workday'
    | 'ashby'
    | 'workable'
    | 'recruitee'
    | 'personio'
    | 'generic';
}

export interface ApplyPacketProfileAnswer {
  id: string;
  category: string;
  label: string;
  answer: string;
  sensitive: number | boolean;
}

export interface ApplyPacketReceipt {
  id: string;
  status: 'filled' | 'submitted' | 'failed' | 'skipped';
}

export interface ApplyPacket {
  job_id: string;
  company?: string;
  role?: string;
  ats_url: string;
  ats_provider: string;
  tailored_resume_text?: string | null;
  tailored_excerpt?: string | null;
  cover_letter_text?: string | null;
  cover_letter_excerpt?: string | null;
  profile_answers: ApplyPacketProfileAnswer[];
  receipt?: ApplyPacketReceipt | null;
}

export interface ReceiptField {
  label: string;
  value: string;
  source: 'profile' | 'resume' | 'cover_letter' | 'user' | 'system' | 'ats';
}

export interface FileAttachment {
  kind: 'resume' | 'cover_letter' | 'other';
  name: string;
  type: string;
  base64: string;
}

export interface FillResult {
  ok: boolean;
  job_id: string;
  url: string;
  provider: string;
  filled: number;
  detected: number;
  skipped: number;
  submit_detected: boolean;
  upload_fields: string[];
  uploaded_files: string[];
  fields: ReceiptField[];
  error?: string;
}

export interface SubmitResult {
  ok: boolean;
  job_id: string;
  url: string;
  provider: string;
  submit_clicked: boolean;
  submit_label?: string;
  captcha_detected: boolean;
  upload_fields: string[];
  required_fields: string[];
  blocked_reasons: string[];
  error?: string;
}

export interface FieldSnapshotResult {
  ok: boolean;
  fields: ReceiptField[];
  error?: string;
}

export interface ExtensionApiResponse {
  ok: boolean;
  error?: string;
  redirect_url?: string;
  job_id?: string;
  queue_id?: string | null;
  existing?: boolean;
  packet?: ApplyPacket;
  receipt_id?: string;
}

export type ExtensionMessage =
  | { type: 'SCRAPE_JOB' }
  | { type: 'SAVE_JOB'; payload: ScrapedJob }
  | { type: 'TAILOR_JOB'; payload: ScrapedJob }
  | { type: 'FETCH_APPLY_PACKET'; payload: { url: string } }
  | { type: 'FILL_APPLICATION'; payload: { packet: ApplyPacket; files?: FileAttachment[] } }
  | { type: 'SNAPSHOT_APPLICATION_FIELDS' }
  | { type: 'SUBMIT_APPLICATION'; payload: ApplyPacket }
  | { type: 'RECORD_FILL_RECEIPT'; payload: FillResult }
  | {
      type: 'RECORD_SUBMISSION_RECEIPT';
      payload: {
        job_id: string;
        original_url: string;
        confirmation_url: string;
        confirmation_text: string;
        provider?: string;
        status?: 'submitted' | 'failed';
        failure_reason?: string;
        mode?: string;
        fields?: ReceiptField[];
      };
    };

export interface TailorResponse {
  ok: boolean;
  job_id?: string;
  redirect_url?: string;
  error?: string;
}
