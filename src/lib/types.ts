export interface User {
  id: string;
  email: string;
  name: string;
  image: string;
  created_at: number;
  updated_at: number;
}

export interface Resume {
  id: string;
  name: string;
  source: string;
  created_at: number;
  updated_at: number;
}

export interface JobApplication {
  id: string;
  resume_id: string;
  url: string;
  company: string;
  role: string;
  jd_raw: string;
  jd_text: string;
  status: 'draft' | 'tailored' | 'applied' | 'interview' | 'offer' | 'rejected';
  interview_date: number | null;
  follow_up_at: number | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  offer_amount: number | null;
  notes: string | null;
  rejection_reason: string | null;
  created_at: number;
  updated_at: number;
}

export interface TailorChange {
  snippet: string;
  reason: string;
  jd_match?: string;
}

export type JobDetailsPatch = Partial<
  Pick<
    JobApplication,
    | 'interview_date'
    | 'follow_up_at'
    | 'salary_min'
    | 'salary_max'
    | 'salary_currency'
    | 'offer_amount'
    | 'notes'
    | 'rejection_reason'
  >
>;

export interface TailoredResume {
  id: string;
  job_id: string;
  resume_id: string;
  source: string;
  accepted: number;
  changes: TailorChange[];
  created_at: number;
  updated_at: number;
}

export interface CoverLetter {
  id: string;
  job_id: string;
  resume_id: string;
  content: string;
  company_research: string;
  created_at: number;
  updated_at: number;
}

export interface OutreachEmail {
  id: string;
  job_id: string;
  resume_id: string;
  subject: string;
  body: string;
  created_at: number;
}

export interface AIProviderConfig {
  endpointUrl: string;
  apiKey: string;
  model: string;
}

export interface FitScoreDimension {
  name: string;
  score: number;
  weight: number;
  detail: string;
}

export interface FitScore {
  id: string;
  job_id: string;
  overall_score: number;
  dimensions: FitScoreDimension[];
  strengths: string[];
  gaps: string[];
  recommendation: string;
  created_at: number;
}

export interface InterviewStory {
  id: string;
  job_id: string;
  theme: string;
  jd_requirement: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  reflection: string;
  best_for: string[];
  created_at: number;
}

export interface StashEntry {
  id: string;
  category: string;
  label: string;
  content: string;
  created_at: number;
  updated_at: number;
}

export type AchievementImpact =
  | 'revenue'
  | 'cost'
  | 'growth'
  | 'quality'
  | 'speed'
  | 'leadership'
  | 'technical'
  | 'other';

export interface AchievementEvidence {
  id: string;
  title: string;
  situation: string;
  action: string;
  result: string;
  metric: string;
  scope: string;
  skills: string[];
  role_targets: string[];
  impact_type: AchievementImpact;
  created_at: number;
  updated_at: number;
}

export type SkillPriority = 'high' | 'medium' | 'low';
export type SkillResourceType = 'course' | 'doc' | 'project' | 'book';

export interface SkillResource {
  type: SkillResourceType;
  title: string;
  url?: string;
  estimated_hours?: number;
}

export interface SkillRoadmapItem {
  skill: string;
  priority: SkillPriority;
  reason: string;
  resources: SkillResource[];
  milestone: string;
}

export interface SkillsRoadmap {
  id: string;
  job_id: string;
  items: SkillRoadmapItem[];
  total_estimated_hours: number;
  summary: string;
  created_at: number;
}

export type ApplyAgentReadinessStatus =
  | 'needs_resume'
  | 'needs_tailoring'
  | 'ready_for_review'
  | 'submitted';

export interface ApplyAgentReadiness {
  status: ApplyAgentReadinessStatus;
  summary: string;
  missing: string[];
  checks: {
    resume: boolean;
    tailored_resume: boolean;
    cover_letter: boolean;
    profile_answers: boolean;
    receipt: boolean;
  };
}

export type ApplicationQueueStatus =
  | 'queued'
  | 'needs_user'
  | 'ready_to_submit'
  | 'submitted'
  | 'failed'
  | 'skipped';

export interface ApplicationQueueEntry {
  id: string;
  job_id: string;
  status: ApplicationQueueStatus;
  readiness: ApplyAgentReadiness;
  created_at: number;
  updated_at: number;
}

export type ApplicationReceiptStatus = 'filled' | 'submitted' | 'failed' | 'skipped';

export interface ApplicationReceiptField {
  label: string;
  value: string;
  source: 'profile' | 'resume' | 'cover_letter' | 'user' | 'system' | 'ats';
}

export interface ApplicationReceipt {
  id: string;
  job_id: string;
  queue_id: string | null;
  provider: string;
  status: ApplicationReceiptStatus;
  fields: ApplicationReceiptField[];
  resume_id: string | null;
  cover_letter_id: string | null;
  confirmation_text: string | null;
  confirmation_url: string | null;
  failure_reason: string | null;
  created_at: number;
}

export type ProfileAnswerCategory =
  | 'work_authorization'
  | 'sponsorship'
  | 'links'
  | 'location'
  | 'salary'
  | 'open_ended'
  | 'identity'
  | 'other';

export interface ProfileAnswer {
  id: string;
  category: ProfileAnswerCategory;
  label: string;
  answer: string;
  sensitive: number | boolean;
  created_at: number;
  updated_at: number;
}

export interface ApplicationPacket {
  job_id: string;
  company?: string;
  role?: string;
  ats_url: string;
  ats_provider: string;
  resume_id: string | null;
  resume_name: string | null;
  tailored_resume_id: string | null;
  tailored_resume_text?: string | null;
  tailored_excerpt: string | null;
  cover_letter_id: string | null;
  cover_letter_text?: string | null;
  cover_letter_excerpt: string | null;
  profile_answers: ProfileAnswer[];
  proof_items?: Array<{
    id: string;
    title: string;
    claim: string;
    readiness: string;
    missing: string[];
    tags: string[];
    source_url?: string;
  }>;
  receipt: ApplicationReceipt | null;
}

export interface ApplyAgentDiscoveryAlert {
  id: string;
  alert_type?: string;
  type?: string;
  title: string;
  detail: string;
  external_job_id?: string | null;
  company?: string | null;
  job_url?: string | null;
  location?: string | null;
  source?: string | null;
  seen: number | boolean;
  created_at: number;
}

export type ApplyAgentFailureCode =
  | 'provider_unsupported'
  | 'captcha_detected'
  | 'file_upload_required'
  | 'missing_required_fields'
  | 'submit_button_missing'
  | 'form_not_found'
  | 'browser_unavailable'
  | 'browser_navigation_failed'
  | 'confirmation_missing'
  | 'runtime_failure';

export interface ReviewedBrowserCheckResult {
  queue_id: string;
  job_id: string;
  url: string;
  provider: string;
  runtime: 'cloudflare_browser' | 'fetch_fallback';
  supported_provider: boolean;
  forms_detected: number;
  fields_detected: number;
  submit_detected: boolean;
  upload_fields: string[];
  captcha_detected: boolean;
  status: 'ready_to_submit' | 'needs_user' | 'failed';
  summary: string;
  failure_code: ApplyAgentFailureCode | null;
  failure_reason: string | null;
  receipt_id: string;
}

export interface ReviewedBrowserCheckBatchResult {
  requested: number;
  processed: number;
  results: ReviewedBrowserCheckResult[];
  errors: Array<{ queue_id: string; error: string }>;
}

export interface GuardedBrowserSubmitResult {
  queue_id: string;
  job_id: string;
  url: string;
  provider: string;
  runtime: 'cloudflare_browser';
  status: 'submitted' | 'needs_user' | 'failed';
  summary: string;
  failure_code: ApplyAgentFailureCode | null;
  failure_reason: string | null;
  submit_clicked: boolean;
  confirmation_url: string | null;
  filled_fields: number;
  blocked_reasons: string[];
  receipt_id: string;
}

export interface GuardedBrowserSubmitBatchResult {
  requested: number;
  processed: number;
  results: GuardedBrowserSubmitResult[];
  errors: Array<{ queue_id: string; error: string }>;
}

export interface CompanyWatch {
  id: string;
  company: string;
  career_url: string | null;
  role_query: string;
  location: string;
  remote: boolean;
  paused: boolean;
  last_run_at: number | null;
  last_result_ids: string[];
  last_source: string | null;
  last_found_count: number | null;
  last_error: string | null;
  created_at: number;
  updated_at: number;
}

export interface RecruiterReplyEvent {
  id: string;
  job_id: string | null;
  from_email: string;
  to_email: string;
  subject: string;
  classification: 'interview' | 'offer' | 'rejected' | 'follow_up' | 'other';
  applied_status: JobApplication['status'] | null;
  summary: string;
  message_id: string | null;
  in_reply_to: string | null;
  thread_key: string;
  suggested_reply_subject: string;
  suggested_reply_body: string;
  reply_sent_at: number | null;
  reply_sent_subject: string | null;
  reply_sent_body: string | null;
  reply_send_error: string | null;
  created_at: number;
}
