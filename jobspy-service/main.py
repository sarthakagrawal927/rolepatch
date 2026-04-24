"""JobSpy sidecar — minimal FastAPI wrapper around python-jobspy.

Single endpoint: POST /search. Protected by bearer token, per-IP rate limited.
"""

from __future__ import annotations

import hashlib
import math
import os
import time
from collections import defaultdict, deque
from typing import Any, Optional

import pandas as pd
from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from jobspy import scrape_jobs
from pydantic import BaseModel, Field

API_KEY = os.environ.get("JOBSPY_API_KEY", "")
RATE_LIMIT_WINDOW = 60.0  # seconds
RATE_LIMIT_MAX = 10       # requests per window per IP

DEFAULT_SITES = ["indeed", "linkedin", "google", "glassdoor", "zip_recruiter"]

app = FastAPI(title="JobSpy Sidecar", version="0.1.0")

# Permissive CORS — auth happens via bearer token, not origin.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["*"],
)

# Per-IP sliding-window rate limiter.
_buckets: dict[str, deque[float]] = defaultdict(deque)


class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=200)
    location: Optional[str] = Field(default=None, max_length=200)
    remote: Optional[bool] = None
    results_wanted: int = Field(default=25, ge=1, le=100)
    hours_old: int = Field(default=168, ge=1, le=24 * 30)
    sites: Optional[list[str]] = None


def _client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _check_rate_limit(ip: str) -> None:
    now = time.time()
    bucket = _buckets[ip]
    while bucket and now - bucket[0] > RATE_LIMIT_WINDOW:
        bucket.popleft()
    if len(bucket) >= RATE_LIMIT_MAX:
        retry_after = int(RATE_LIMIT_WINDOW - (now - bucket[0])) + 1
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded. Retry in {retry_after}s.",
            headers={"Retry-After": str(retry_after)},
        )
    bucket.append(now)


def _require_auth(authorization: Optional[str]) -> None:
    if not API_KEY:
        raise HTTPException(status_code=500, detail="Service not configured (missing JOBSPY_API_KEY)")
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization.removeprefix("Bearer ").strip()
    if token != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid bearer token")


def _clean(value: Any) -> Any:
    """Convert pandas NaN / NaT / numpy scalars to JSON-safe values."""
    if value is None:
        return None
    if isinstance(value, float) and math.isnan(value):
        return None
    if pd.isna(value) if not isinstance(value, (list, dict)) else False:
        return None
    # pandas Timestamp → iso string
    if hasattr(value, "isoformat"):
        try:
            return value.isoformat()
        except Exception:
            return str(value)
    return value


def _stable_id(job_url: Optional[str], title: Optional[str], company: Optional[str]) -> str:
    key = job_url or f"{title or ''}|{company or ''}"
    return hashlib.sha1(key.encode("utf-8")).hexdigest()[:16]


def _normalize(df: pd.DataFrame) -> list[dict[str, Any]]:
    if df is None or df.empty:
        return []

    rows: list[dict[str, Any]] = []
    records = df.to_dict(orient="records")
    for r in records:
        # Tolerant column access — jobspy column names can shift across versions.
        def pick(*keys: str) -> Any:
            for k in keys:
                if k in r:
                    v = _clean(r[k])
                    if v is not None and v != "":
                        return v
            return None

        job_url = pick("job_url", "job_url_direct")
        title = pick("title")
        company = pick("company")

        description = pick("description") or ""
        description_short = description[:500] if isinstance(description, str) else None

        rows.append(
            {
                "id": _stable_id(job_url, title, company),
                "site": pick("site"),
                "title": title,
                "company": company,
                "location": pick("location"),
                "is_remote": bool(pick("is_remote")) if pick("is_remote") is not None else None,
                "date_posted": pick("date_posted"),
                "job_type": pick("job_type"),
                "min_amount": pick("min_amount"),
                "max_amount": pick("max_amount"),
                "currency": pick("currency"),
                "job_url": job_url,
                "description": description if isinstance(description, str) else None,
                "description_short": description_short,
                "company_url": pick("company_url", "company_url_direct"),
                "emails": pick("emails"),
            }
        )
    return rows


@app.get("/health")
def health() -> dict[str, Any]:
    return {"status": "ok", "service": "jobspy-sidecar", "version": app.version}


@app.post("/search")
def search(
    body: SearchRequest,
    request: Request,
    authorization: Optional[str] = Header(default=None),
) -> dict[str, Any]:
    _require_auth(authorization)
    _check_rate_limit(_client_ip(request))

    sites = body.sites or DEFAULT_SITES
    kwargs: dict[str, Any] = {
        "site_name": sites,
        "search_term": body.query,
        "results_wanted": body.results_wanted,
        "hours_old": body.hours_old,
    }
    if body.location:
        kwargs["location"] = body.location
    if body.remote is not None:
        kwargs["is_remote"] = body.remote

    try:
        df = scrape_jobs(**kwargs)
    except Exception as exc:  # noqa: BLE001 - surface scraper errors as 502
        raise HTTPException(status_code=502, detail=f"Upstream scrape failed: {exc}") from exc

    jobs = _normalize(df)
    return {
        "count": len(jobs),
        "query": body.query,
        "location": body.location,
        "sites": sites,
        "jobs": jobs,
    }
