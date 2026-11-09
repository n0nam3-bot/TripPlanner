-- Tripfinder initial database schema
-- Safe to run more than once. The application can also create these tables
-- automatically when /api/health is opened or the first live search is made.

CREATE TABLE IF NOT EXISTS tripfinder_provider_cache (
  cache_key text PRIMARY KEY,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS tripfinder_provider_cache_expiry_idx
  ON tripfinder_provider_cache (expires_at);

CREATE TABLE IF NOT EXISTS tripfinder_provider_usage (
  month_key text PRIMARY KEY,
  search_count integer NOT NULL DEFAULT 0 CHECK (search_count >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tripfinder_provider_hourly_usage (
  hour_bucket timestamptz PRIMARY KEY,
  search_count integer NOT NULL DEFAULT 0 CHECK (search_count >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tripfinder_client_usage (
  client_key text NOT NULL,
  usage_date date NOT NULL,
  hour_bucket timestamptz NOT NULL,
  hour_count integer NOT NULL DEFAULT 0 CHECK (hour_count >= 0),
  day_count integer NOT NULL DEFAULT 0 CHECK (day_count >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (client_key, usage_date)
);

CREATE INDEX IF NOT EXISTS tripfinder_client_usage_date_idx
  ON tripfinder_client_usage (usage_date);
CREATE INDEX IF NOT EXISTS tripfinder_provider_hourly_usage_bucket_idx
  ON tripfinder_provider_hourly_usage (hour_bucket);
