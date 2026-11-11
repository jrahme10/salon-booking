-- Supporting customer relationship and payroll records.
-- Apply after 0002_core_platform.sql. Safe to re-run.
-- The composite key is required by the tenant-scoped foreign keys below and
-- repairs databases where 0002 stopped at its first composite-FK statement.
create unique index if not exists appointments_business_id_id_uq
  on private.appointments(business_id,id);

create table if not exists private.payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references private.businesses(id) on delete cascade,
  appointment_id uuid not null,
  amount numeric(12,2) not null check (amount > 0),
  method text not null check (method in ('cash','card','bank_transfer','other')),
  paid_at timestamptz not null default now(),
  note text,
  created_at timestamptz not null default now(),
  foreign key (business_id,appointment_id) references private.appointments(business_id,id)
);
create index if not exists payments_business_paid_idx on private.payments(business_id,paid_at desc);

create table if not exists private.client_appointment_requests (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references private.businesses(id) on delete cascade,
  appointment_id uuid not null,
  customer_id uuid not null,
  kind text not null check (kind in ('cancellation','reschedule')),
  status text not null default 'pending' check (status in ('pending','approved','declined')),
  requested_starts_at timestamptz,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  foreign key (business_id,appointment_id) references private.appointments(business_id,id),
  foreign key (business_id,customer_id) references private.customers(business_id,id)
);
create index if not exists client_requests_business_status_idx
  on private.client_appointment_requests(business_id,status,created_at);

create table if not exists private.customer_consent_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references private.businesses(id) on delete cascade,
  customer_id uuid not null,
  action text not null check (action in ('granted','revoked')),
  channel text not null check (channel in ('whatsapp','email','sms','all')),
  source text not null check (source in ('in_person','whatsapp','email','phone','website','other')),
  note text,
  captured_at timestamptz not null,
  customer_confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (business_id, customer_id) references private.customers(business_id,id)
);
create index if not exists customer_consent_business_customer_idx
  on private.customer_consent_events(business_id,customer_id,captured_at desc);

create table if not exists private.customer_reminders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references private.businesses(id) on delete cascade,
  customer_id uuid not null,
  due_at timestamptz not null,
  note text not null,
  status text not null default 'pending' check (status in ('pending','completed','cancelled')),
  created_at timestamptz not null default now(),
  foreign key (business_id, customer_id) references private.customers(business_id,id)
);
create index if not exists customer_reminders_business_due_idx
  on private.customer_reminders(business_id,due_at);

create table if not exists private.commission_entries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references private.businesses(id) on delete cascade,
  appointment_id uuid not null,
  employee_id uuid not null,
  service_name text not null,
  base_amount numeric(12,2) not null check (base_amount >= 0),
  commission_type text not null check (commission_type in ('percentage','fixed')),
  commission_value numeric(12,2) not null check (commission_value >= 0),
  amount numeric(12,2) not null check (amount >= 0),
  earned_at timestamptz not null,
  unique (business_id,appointment_id),
  foreign key (business_id,appointment_id) references private.appointments(business_id,id),
  foreign key (business_id,employee_id) references private.employees(business_id,id)
);
create index if not exists commission_entries_business_employee_idx
  on private.commission_entries(business_id,employee_id,earned_at desc);

create table if not exists private.payroll_payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references private.businesses(id) on delete cascade,
  employee_id uuid not null,
  amount numeric(12,2) not null check (amount > 0),
  method text not null check (method in ('cash','card','bank_transfer','other')),
  paid_at timestamptz not null,
  note text,
  foreign key (business_id,employee_id) references private.employees(business_id,id)
);
create index if not exists payroll_payments_business_employee_idx
  on private.payroll_payments(business_id,employee_id,paid_at desc);

revoke all on private.customer_consent_events, private.customer_reminders,
  private.commission_entries, private.payroll_payments from public;
