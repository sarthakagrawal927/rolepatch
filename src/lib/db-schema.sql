CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  image TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS resumes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS job_applications (
  id TEXT PRIMARY KEY,
  resume_id TEXT REFERENCES resumes(id),
  url TEXT NOT NULL DEFAULT '',
  company TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT '',
  jd_raw TEXT NOT NULL DEFAULT '',
  jd_text TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  interview_date INTEGER,
  follow_up_at INTEGER,
  salary_min INTEGER,
  salary_max INTEGER,
  salary_currency TEXT,
  offer_amount INTEGER,
  notes TEXT,
  rejection_reason TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS tailored_resumes (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES job_applications(id),
  resume_id TEXT NOT NULL REFERENCES resumes(id),
  source TEXT NOT NULL DEFAULT '',
  accepted INTEGER NOT NULL DEFAULT 0,
  is_public INTEGER NOT NULL DEFAULT 0,
  share_slug TEXT UNIQUE,
  score_original INTEGER NOT NULL DEFAULT 0,
  score_tailored INTEGER NOT NULL DEFAULT 0,
  changes_json TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS cover_letters (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES job_applications(id),
  resume_id TEXT NOT NULL REFERENCES resumes(id),
  content TEXT NOT NULL DEFAULT '',
  company_research TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS stash_entries (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL DEFAULT 'experience',
  label TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS achievement_evidence (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  title TEXT NOT NULL DEFAULT '',
  situation TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL DEFAULT '',
  result TEXT NOT NULL DEFAULT '',
  metric TEXT NOT NULL DEFAULT '',
  scope TEXT NOT NULL DEFAULT '',
  skills TEXT NOT NULL DEFAULT '[]',
  role_targets TEXT NOT NULL DEFAULT '[]',
  impact_type TEXT NOT NULL DEFAULT 'other',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS token_balances (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  balance INTEGER NOT NULL DEFAULT 3,
  total_purchased INTEGER NOT NULL DEFAULT 0,
  total_used INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS token_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  amount INTEGER NOT NULL,
  type TEXT NOT NULL,
  reference_id TEXT,
  balance_after INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  product_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  tokens_granted INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  dodo_payload TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS fit_scores (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES job_applications(id),
  user_id TEXT,
  overall_score INTEGER NOT NULL DEFAULT 0,
  dimensions TEXT NOT NULL DEFAULT '[]',
  strengths TEXT NOT NULL DEFAULT '[]',
  gaps TEXT NOT NULL DEFAULT '[]',
  recommendation TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS outreach_emails (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES job_applications(id),
  resume_id TEXT NOT NULL REFERENCES resumes(id),
  subject TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  user_id TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS interview_stories (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES job_applications(id),
  user_id TEXT,
  theme TEXT NOT NULL DEFAULT '',
  jd_requirement TEXT NOT NULL DEFAULT '',
  situation TEXT NOT NULL DEFAULT '',
  task TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL DEFAULT '',
  result TEXT NOT NULL DEFAULT '',
  reflection TEXT NOT NULL DEFAULT '',
  best_for TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS skills_roadmaps (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES job_applications(id),
  user_id TEXT,
  items_json TEXT NOT NULL DEFAULT '[]',
  total_estimated_hours INTEGER NOT NULL DEFAULT 0,
  summary TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS saved_job_searches (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  query TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT '',
  remote INTEGER NOT NULL DEFAULT 0,
  paused INTEGER NOT NULL DEFAULT 0,
  last_run_at INTEGER,
  last_result_ids TEXT NOT NULL DEFAULT '[]',
  last_source TEXT,
  last_found_count INTEGER,
  last_error TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS saved_job_shortlist (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  external_job_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  company TEXT NOT NULL DEFAULT '',
  job_url TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT '',
  saved_at INTEGER NOT NULL DEFAULT (unixepoch()),
  last_seen_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(user_id, job_url)
);

CREATE TABLE IF NOT EXISTS job_discovery_alerts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  alert_type TEXT NOT NULL DEFAULT 'new_match',
  title TEXT NOT NULL DEFAULT '',
  detail TEXT NOT NULL DEFAULT '',
  external_job_id TEXT,
  company TEXT,
  job_url TEXT,
  location TEXT,
  source TEXT,
  seen INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS company_watches (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  company TEXT NOT NULL DEFAULT '',
  career_url TEXT,
  role_query TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  remote INTEGER NOT NULL DEFAULT 0,
  paused INTEGER NOT NULL DEFAULT 0,
  last_run_at INTEGER,
  last_result_ids TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS application_queue (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES job_applications(id),
  user_id TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  readiness_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(user_id, job_id)
);

CREATE TABLE IF NOT EXISTS application_receipts (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES job_applications(id),
  queue_id TEXT REFERENCES application_queue(id),
  user_id TEXT,
  provider TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'submitted',
  fields_json TEXT NOT NULL DEFAULT '[]',
  resume_id TEXT,
  cover_letter_id TEXT,
  confirmation_text TEXT,
  confirmation_url TEXT,
  failure_reason TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS profile_answers (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  category TEXT NOT NULL DEFAULT 'other',
  label TEXT NOT NULL DEFAULT '',
  answer TEXT NOT NULL DEFAULT '',
  sensitive INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS recruiter_reply_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  job_id TEXT,
  from_email TEXT NOT NULL DEFAULT '',
  to_email TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL DEFAULT '',
  classification TEXT NOT NULL DEFAULT 'other',
  applied_status TEXT,
  summary TEXT NOT NULL DEFAULT '',
  message_id TEXT,
  in_reply_to TEXT,
  thread_key TEXT NOT NULL DEFAULT '',
  suggested_reply_subject TEXT NOT NULL DEFAULT '',
  suggested_reply_body TEXT NOT NULL DEFAULT '',
  reply_sent_at INTEGER,
  reply_sent_subject TEXT NOT NULL DEFAULT '',
  reply_sent_body TEXT NOT NULL DEFAULT '',
  reply_send_error TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
