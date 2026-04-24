# JobSpy sidecar

Tiny FastAPI service that wraps [python-jobspy](https://github.com/speedyapply/JobSpy)
to do multi-platform job search (Indeed / LinkedIn / Google / Glassdoor / ZipRecruiter)
for the RolePatch web app.

Kept as a separate service because `python-jobspy` is a Python library with heavy
scraping dependencies we don't want in the Next.js runtime.

## Endpoints

### `GET /health`

Liveness. Returns `{ "status": "ok", ... }`. **Ping this regularly** on free-tier
hosts (Render/Fly) to avoid cold starts — first boot after idle is slow because
of pandas + scraping deps (10-30s).

Recommended: a free cron ping every 10 minutes from
[cron-job.org](https://cron-job.org) or GitHub Actions.

### `POST /search`

Auth: `Authorization: Bearer $JOBSPY_API_KEY` (shared secret with the web app).

Request body:

```json
{
  "query": "python engineer",
  "location": "Remote",          // optional
  "remote": true,                 // optional
  "results_wanted": 25,           // default 25, max 100
  "hours_old": 168,               // default 7d, max 30d
  "sites": ["indeed", "linkedin"] // default all 5
}
```

Response:

```json
{
  "count": 17,
  "query": "...",
  "location": "...",
  "sites": [...],
  "jobs": [
    {
      "id": "<sha1(job_url) first 16 hex>",
      "site": "indeed",
      "title": "...",
      "company": "...",
      "location": "...",
      "is_remote": true,
      "date_posted": "2026-04-22",
      "job_type": "fulltime",
      "min_amount": 120000,
      "max_amount": 160000,
      "currency": "USD",
      "job_url": "https://...",
      "description": "full text...",
      "description_short": "first 500 chars...",
      "company_url": "...",
      "emails": null
    }
  ]
}
```

Rate limit: 10 requests / minute / IP.

## Local development

Requires Python 3.12.

```bash
cd jobspy-service
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# edit .env to set JOBSPY_API_KEY
export $(grep -v '^#' .env | xargs)
uvicorn main:app --reload --port 8000
```

### Smoke test

```bash
# Health
curl http://localhost:8000/health

# Search (replace $KEY with your JOBSPY_API_KEY)
curl -H "Authorization: Bearer $JOBSPY_API_KEY" \
     -H "Content-Type: application/json" \
     -X POST http://localhost:8000/search \
     -d '{"query":"python engineer","location":"Remote","results_wanted":10}'
```

Expect a JSON payload with `count` and `jobs[]`. First call is slow (scrapers spin up).

## Deploy: Render (recommended, free tier)

1. Push this repo to GitHub.
2. In Render, *New → Web Service*, point at this folder (`jobspy-service`).
3. **Runtime**: Python. **Build**: `pip install -r requirements.txt`.
   **Start**: `uvicorn main:app --host 0.0.0.0 --port $PORT`.
4. Env vars: `JOBSPY_API_KEY=<long random hex>`.
5. Free plan sleeps after 15 min idle. Set up a cron ping to `/health` every
   10 minutes to keep it warm (cron-job.org is free).
6. Copy the service URL (e.g. `https://jobspy-sidecar.onrender.com`) into the
   web app's `JOBSPY_SERVICE_URL` env var, and the same `JOBSPY_API_KEY` into
   `JOBSPY_SERVICE_KEY`.

## Deploy: Fly.io (alt)

```bash
fly launch --no-deploy --name rolepatch-jobspy
fly secrets set JOBSPY_API_KEY=<your-secret>
fly deploy
```

A minimal `Dockerfile` isn't bundled here — `fly launch` autogenerates one from
`requirements.txt` + `Procfile`. Accept the defaults.

Fly's free allowance (shared-1x, 256MB) is enough; scale to 512MB if pandas OOMs.

## Notes

- python-jobspy calls out to Indeed/LinkedIn/etc. directly. No API keys needed,
  but scrapers can break when those sites change. Pin the version and upgrade
  deliberately.
- LinkedIn is the most fragile — you may see empty results there while other
  sources work fine. The sidecar degrades gracefully (returns `count: 0` rather
  than erroring out if jobspy returns nothing).
- Rate limit is in-process only. If you scale to >1 replica, either add a
  shared Redis limiter or rely on the web app's per-user 5/min limit.
