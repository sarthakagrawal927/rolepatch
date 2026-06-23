import { createClient } from '@libsql/client';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..', '..');

// Load .env.local if env vars are not already set
function loadEnv() {
  const envPath = join(projectRoot, '.env.local');
  try {
    const envContent = readFileSync(envPath, 'utf-8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // .env.local not found — rely on existing env vars
  }
}

loadEnv();

async function migrate() {
  const db = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  const schemaPath = join(__dirname, 'db-schema.sql');
  const schema = readFileSync(schemaPath, 'utf-8');

  const statements = schema
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    await db.execute(statement);
  }

  // Rename latex_source → source (if column still has old name)
  for (const table of ['resumes', 'tailored_resumes']) {
    try {
      await db.execute(`ALTER TABLE ${table} RENAME COLUMN latex_source TO source`);
      console.log(`Renamed latex_source → source in ${table}`);
    } catch {
      // Column already renamed or doesn't exist — safe to ignore
    }
  }

  // Add user_id column to all content tables
  const tablesNeedingUserId = [
    'resumes',
    'job_applications',
    'tailored_resumes',
    'cover_letters',
    'stash_entries',
    'outreach_emails',
  ];
  for (const table of tablesNeedingUserId) {
    try {
      await db.execute(`ALTER TABLE ${table} ADD COLUMN user_id TEXT`);
      console.log(`Added user_id column to ${table}`);
    } catch {
      // Column already exists — safe to ignore
    }
  }

  // Add unique index for job_applications URL when user_id is NULL
  try {
    await db.execute(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_job_applications_cleaned_url ON job_applications (url) WHERE user_id IS NULL`
    );
    console.log('Created idx_job_applications_cleaned_url index');
  } catch {
    // Index already exists — safe to ignore
  }

  // tailored_resumes: share columns (is_public, share_slug, cached scores) + changes_json
  const tailoredAddColumns: Array<{ col: string; ddl: string }> = [
    { col: 'is_public', ddl: 'ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0' },
    { col: 'share_slug', ddl: 'ADD COLUMN share_slug TEXT' },
    { col: 'score_original', ddl: 'ADD COLUMN score_original INTEGER NOT NULL DEFAULT 0' },
    { col: 'score_tailored', ddl: 'ADD COLUMN score_tailored INTEGER NOT NULL DEFAULT 0' },
    { col: 'changes_json', ddl: `ADD COLUMN changes_json TEXT NOT NULL DEFAULT '[]'` },
  ];
  for (const { col, ddl } of tailoredAddColumns) {
    try {
      await db.execute(`ALTER TABLE tailored_resumes ${ddl}`);
      console.log(`Added ${col} column to tailored_resumes`);
    } catch {
      // Column already exists — safe to ignore
    }
  }

  try {
    await db.execute(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_tailored_resumes_share_slug ON tailored_resumes (share_slug) WHERE share_slug IS NOT NULL`
    );
    console.log('Created idx_tailored_resumes_share_slug index');
  } catch {
    // Index already exists — safe to ignore
  }

  // Add richer tracking columns to job_applications (nullable, backwards-compatible)
  const jobExtraColumns: { name: string; type: string }[] = [
    { name: 'interview_date', type: 'INTEGER' },
    { name: 'follow_up_at', type: 'INTEGER' },
    { name: 'salary_min', type: 'INTEGER' },
    { name: 'salary_max', type: 'INTEGER' },
    { name: 'salary_currency', type: 'TEXT' },
    { name: 'offer_amount', type: 'INTEGER' },
    { name: 'notes', type: 'TEXT' },
    { name: 'rejection_reason', type: 'TEXT' },
  ];
  for (const col of jobExtraColumns) {
    try {
      await db.execute(`ALTER TABLE job_applications ADD COLUMN ${col.name} ${col.type}`);
      console.log(`Added ${col.name} column to job_applications`);
    } catch {
      // Column already exists — safe to ignore
    }
  }

  try {
    await db.execute(
      `CREATE TABLE IF NOT EXISTS achievement_evidence (
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
      )`
    );
    console.log('Ensured achievement_evidence table');
  } catch {
    // Already exists - safe to ignore
  }

  // skills_roadmaps — idempotent; schema file also declares it for fresh installs
  try {
    await db.execute(
      `CREATE TABLE IF NOT EXISTS skills_roadmaps (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL REFERENCES job_applications(id),
        user_id TEXT,
        items_json TEXT NOT NULL DEFAULT '[]',
        total_estimated_hours INTEGER NOT NULL DEFAULT 0,
        summary TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
      )`
    );
    console.log('Ensured skills_roadmaps table');
  } catch {
    // Already exists — safe to ignore
  }

  for (const statement of [
    `CREATE TABLE IF NOT EXISTS saved_job_searches (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      query TEXT NOT NULL,
      location TEXT NOT NULL DEFAULT '',
      remote INTEGER NOT NULL DEFAULT 0,
      paused INTEGER NOT NULL DEFAULT 0,
      last_run_at INTEGER,
      last_result_ids TEXT NOT NULL DEFAULT '[]',
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )`,
    `CREATE TABLE IF NOT EXISTS saved_job_shortlist (
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
    )`,
    `CREATE TABLE IF NOT EXISTS job_discovery_alerts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      alert_type TEXT NOT NULL DEFAULT 'new_match',
      title TEXT NOT NULL DEFAULT '',
      detail TEXT NOT NULL DEFAULT '',
      seen INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )`,
  ]) {
    try {
      await db.execute(statement);
    } catch {
      // Already exists — safe to ignore
    }
  }

  console.log('Migration complete');
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
