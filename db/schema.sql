CREATE TABLE IF NOT EXISTS jobs (
  id BIGSERIAL PRIMARY KEY,
  fingerprint TEXT NOT NULL UNIQUE,
  content_hash TEXT NOT NULL,
  title TEXT NOT NULL,
  agency TEXT NOT NULL,
  agency_short TEXT NOT NULL DEFAULT '',
  location_city TEXT NOT NULL DEFAULT '',
  location_country TEXT NOT NULL DEFAULT '',
  country_code CHAR(2),
  flag TEXT,
  contract_type TEXT NOT NULL DEFAULT 'EU contract',
  grade TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL,
  salary_summary TEXT NOT NULL DEFAULT 'Salary not listed',
  salary_min INTEGER,
  salary_max INTEGER,
  deadline_date DATE,
  deadline_text TEXT NOT NULL DEFAULT '',
  indefinite_contract BOOLEAN,
  apply_url TEXT NOT NULL DEFAULT '',
  source_post_id BIGINT,
  source_post_title TEXT NOT NULL DEFAULT '',
  source_post_url TEXT NOT NULL DEFAULT '',
  source_published_at TIMESTAMPTZ,
  edition_ids BIGINT[] NOT NULL DEFAULT '{}',
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  times_seen INTEGER NOT NULL DEFAULT 1,
  raw JSONB
);

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS edition_ids BIGINT[] NOT NULL DEFAULT '{}';
UPDATE jobs
SET edition_ids = ARRAY[source_post_id]::bigint[]
WHERE cardinality(edition_ids) = 0 AND source_post_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS jobs_deadline_idx ON jobs (deadline_date);
CREATE INDEX IF NOT EXISTS jobs_category_idx ON jobs (category);
CREATE INDEX IF NOT EXISTS jobs_country_idx ON jobs (country_code);
CREATE INDEX IF NOT EXISTS jobs_source_idx ON jobs (source_post_id);
CREATE INDEX IF NOT EXISTS jobs_first_seen_idx ON jobs (first_seen_at DESC);
CREATE INDEX IF NOT EXISTS jobs_open_idx ON jobs (deadline_date NULLS LAST);

CREATE TABLE IF NOT EXISTS sync_runs (
  id BIGSERIAL PRIMARY KEY,
  trigger TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'running',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  duration_ms INTEGER,
  posts_scanned INTEGER NOT NULL DEFAULT 0,
  jobs_found INTEGER NOT NULL DEFAULT 0,
  inserted INTEGER NOT NULL DEFAULT 0,
  updated INTEGER NOT NULL DEFAULT 0,
  duplicates_skipped INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  meta JSONB
);

CREATE INDEX IF NOT EXISTS sync_runs_finished_idx ON sync_runs (finished_at DESC NULLS LAST);
