import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { createClient } from '@libsql/client';

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
  const tablesNeedingUserId = ['resumes', 'job_applications', 'tailored_resumes', 'cover_letters', 'stash_entries', 'outreach_emails'];
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
    await db.execute(`CREATE UNIQUE INDEX IF NOT EXISTS idx_job_applications_cleaned_url ON job_applications (url) WHERE user_id IS NULL`);
    console.log('Created idx_job_applications_cleaned_url index');
  } catch {
    // Index already exists — safe to ignore
  }

  console.log('Migration complete');
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
