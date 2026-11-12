-- Neon/PostgreSQL calendar integration foundation.
-- Apply only after the Worker database health check succeeds.
-- This schema is intentionally private to the backend; no browser credentials
-- or direct database connections belong in the frontend.

create schema if not exists private;
revoke all on schema private from public;

create table if not exists private.business_memberships (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  user_id uuid not null,
  role text not null check (role in ('owner', 'admin', 'employee')),
  created_at timestamptz not null default now(),
  unique (business_id, user_id)
);

create index if not exists business_memberships_user_idx
  on private.business_memberships(user_id, business_id);

create table if not exists private.calendar_connections (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  employee_user_id uuid,
  provider text not null check (provider in ('google', 'apple')),
  account_label text,
  status text not null default 'pending'
    check (status in ('pending', 'connected', 'attention_required', 'disconnected')),
  created_by uuid not null,
  connected_at timestamptz,
  last_sync_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (account_label is null or length(account_label) <= 254)
);

create index if not exists calendar_connections_business_idx
  on private.calendar_connections(business_id, provider, status);

create index if not exists calendar_connections_employee_idx
  on private.calendar_connections(employee_user_id)
  where employee_user_id is not null;

create table if not exists private.calendar_resources (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references private.calendar_connections(id) on delete cascade,
  provider_calendar_id text not null,
  display_name text not null,
  timezone text,
  read_busy_time boolean not null default true,
  sync_to_provider boolean not null default true,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, provider_calendar_id)
);

create table if not exists private.calendar_event_links (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references private.calendar_connections(id) on delete cascade,
  appointment_id uuid not null,
  provider_calendar_id text not null,
  provider_event_id text not null,
  provider_etag text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  unique (connection_id, appointment_id, provider_calendar_id),
  unique (connection_id, provider_event_id)
);

create table if not exists private.external_busy_intervals (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references private.calendar_connections(id) on delete cascade,
  provider_calendar_id text not null,
  provider_event_id text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_all_day boolean not null default false,
  last_seen_at timestamptz not null default now(),
  check (ends_at > starts_at),
  unique (connection_id, provider_calendar_id, provider_event_id)
);

create index if not exists external_busy_intervals_connection_time_idx
  on private.external_busy_intervals(connection_id, starts_at, ends_at);

create table if not exists private.calendar_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references private.calendar_connections(id) on delete cascade,
  operation text not null check (operation in ('initial_sync', 'pull_busy', 'push_appointment', 'delete_linked_event', 'reconcile')),
  idempotency_key text not null unique,
  attempts integer not null default 0 check (attempts >= 0),
  run_after timestamptz not null default now(),
  locked_at timestamptz,
  completed_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now()
);

create index if not exists calendar_sync_jobs_ready_idx
  on private.calendar_sync_jobs(run_after, created_at)
  where completed_at is null;

create table if not exists private.calendar_connection_secrets (
  connection_id uuid primary key references private.calendar_connections(id) on delete cascade,
  encrypted_secret bytea not null,
  encryption_key_version text not null,
  updated_at timestamptz not null default now()
);

create table if not exists private.calendar_oauth_states (
  state_hash bytea primary key,
  business_id uuid not null,
  user_id uuid not null,
  provider text not null check (provider = 'google'),
  employee_user_id uuid,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists calendar_oauth_states_expiry_idx
  on private.calendar_oauth_states(expires_at);

-- No direct browser grants. The Worker is the only intended database client.
-- Tenant authorization must be enforced by authenticated Worker handlers before
-- any calendar records are read or changed. Do not add public API routes for
-- these tables until that authorization layer is in place.
