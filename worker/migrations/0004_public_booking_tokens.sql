-- Access tokens for public (no-account) clients to view and manage only the bookings they created.
-- Apply after 0003_customer_payroll.sql. Only a SHA-256 hash of the token is stored.
create table if not exists private.booking_access_tokens (
  token_hash bytea not null,
  business_id uuid not null,
  appointment_id uuid not null,
  display_name text not null,
  created_at timestamptz not null default now(),
  primary key (token_hash, appointment_id),
  foreign key (business_id, appointment_id) references private.appointments(business_id, id) on delete cascade
);
create index if not exists booking_access_tokens_hash_idx on private.booking_access_tokens(token_hash);
