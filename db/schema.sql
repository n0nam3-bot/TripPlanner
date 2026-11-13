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


-- Sanitized request telemetry for the private /admin dashboard.
-- Search text, booking tokens, API keys and raw client IP addresses are never stored.
CREATE TABLE IF NOT EXISTS tripfinder_api_event_log (
  id bigserial PRIMARY KEY,
  provider text NOT NULL,
  category text NOT NULL,
  event_type text NOT NULL,
  outcome text NOT NULL,
  cache_status text NOT NULL DEFAULT 'none',
  http_status integer,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tripfinder_api_event_log_created_idx
  ON tripfinder_api_event_log (created_at DESC);
CREATE INDEX IF NOT EXISTS tripfinder_api_event_log_provider_idx
  ON tripfinder_api_event_log (provider, category, created_at DESC);

-- Persistent login throttling, keyed by a one-way client-address hash.
CREATE TABLE IF NOT EXISTS tripfinder_admin_login_attempts (
  client_key text PRIMARY KEY,
  attempts integer NOT NULL DEFAULT 0,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz
);

-- Optional Geoapify / OpenStreetMap provider usage and shared request-rate control.
CREATE TABLE IF NOT EXISTS tripfinder_geoapify_daily_usage (
  usage_date date PRIMARY KEY,
  credit_count integer NOT NULL DEFAULT 0 CHECK (credit_count >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tripfinder_geoapify_client_daily_usage (
  client_key text NOT NULL,
  usage_date date NOT NULL,
  credit_count integer NOT NULL DEFAULT 0 CHECK (credit_count >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (client_key, usage_date)
);

CREATE TABLE IF NOT EXISTS tripfinder_geoapify_request_gate (
  gate_key text PRIMARY KEY,
  next_allowed_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);


-- Anonymous saved trip drafts. Share and owner tokens are stored only as SHA-256 hashes.
-- The public share link is read-only; owner tokens authorize updates from the original browser.
CREATE TABLE IF NOT EXISTS tripfinder_saved_trips (
  id uuid PRIMARY KEY,
  share_token_hash text NOT NULL UNIQUE,
  owner_token_hash text NOT NULL,
  search jsonb NOT NULL,
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS tripfinder_saved_trips_expiry_idx
  ON tripfinder_saved_trips (expires_at);

CREATE TABLE IF NOT EXISTS tripfinder_saved_trip_daily_usage (
  client_key text NOT NULL,
  usage_date date NOT NULL,
  save_count integer NOT NULL DEFAULT 0 CHECK (save_count >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (client_key, usage_date)
);
