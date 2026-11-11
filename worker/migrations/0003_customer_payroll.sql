-- Repair/complete the core schema and add customer relationship + payroll records.
-- Apply after 0002_core_platform.sql. Safe to run whether 0002 completed or stopped partway.
create extension if not exists btree_gist;

create table if not exists private.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  category text not null default 'Beauty',
  city text not null,
  address text not null default '',
  phone text,email text,website text,description text,
  currency char(3) not null default 'USD',
  timezone text not null default 'Asia/Beirut',
  marketplace_visible boolean not null default false,
  working_hours jsonb not null default '{}'::jsonb,
  booking_rules jsonb not null default '{"allowOnlineBooking":true,"minimumNoticeHours":2,"cancellationNoticeHours":24,"slotIntervalMinutes":30}'::jsonb,
  created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);

create table if not exists private.app_users (
  id uuid primary key default gen_random_uuid(),
  email text not null,phone text,display_name text not null,password_hash text not null,
  email_verified_at timestamptz,disabled_at timestamptz,
  created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create unique index if not exists app_users_email_lower_uq on private.app_users(lower(email));
create unique index if not exists app_users_phone_uq on private.app_users(phone) where phone is not null;

do $$ begin
  if not exists(select 1 from pg_constraint where conname='business_memberships_business_fk') then
    alter table private.business_memberships add constraint business_memberships_business_fk
      foreign key(business_id) references private.businesses(id) on delete cascade;
  end if;
  if not exists(select 1 from pg_constraint where conname='business_memberships_user_fk') then
    alter table private.business_memberships add constraint business_memberships_user_fk
      foreign key(user_id) references private.app_users(id) on delete cascade;
  end if;
end $$;

create table if not exists private.auth_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references private.app_users(id) on delete cascade,
  token_hash bytea not null unique,expires_at timestamptz not null,revoked_at timestamptz,
  created_at timestamptz not null default now(),last_used_at timestamptz
);
create index if not exists auth_sessions_user_idx on private.auth_sessions(user_id,expires_at);

create table if not exists private.employees (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references private.businesses(id) on delete cascade,
  user_id uuid references private.app_users(id) on delete set null,
  name text not null check(length(trim(name)) between 1 and 160),
  role text not null default 'Team member',initials text not null default '',active boolean not null default true,
  service_ids uuid[] not null default '{}',working_hours jsonb not null default '{}'::jsonb,time_off date[] not null default '{}',
  commission_type text check(commission_type in ('percentage','fixed')),
  commission_value numeric(12,2) not null default 0 check(commission_value>=0),
  created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
  unique(business_id,id)
);
create index if not exists employees_business_idx on private.employees(business_id,active);

create table if not exists private.services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references private.businesses(id) on delete cascade,
  name text not null check(length(trim(name)) between 1 and 160),
  category text not null default 'Other',
  duration_minutes integer not null check(duration_minutes between 5 and 1440),
  price numeric(12,2) not null check(price>=0),active boolean not null default true,
  created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
  unique(business_id,id)
);
create index if not exists services_business_idx on private.services(business_id,active);

create table if not exists private.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references private.businesses(id) on delete cascade,
  name text not null check(length(trim(name)) between 1 and 160),phone text not null,email text not null default '',
  birthday date,marketing_opt_in boolean not null default false,marketing_opt_in_updated_at timestamptz,
  created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
  unique(business_id,id)
);
create index if not exists customers_business_phone_idx on private.customers(business_id,phone);

create table if not exists private.appointments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references private.businesses(id) on delete cascade,
  customer_id uuid not null,service_id uuid not null,employee_id uuid not null,
  starts_at timestamptz not null,ends_at timestamptz not null,
  status text not null default 'pending' check(status in ('pending','confirmed','completed','cancelled')),
  source text not null default 'provider' check(source in ('provider','client')),
  created_by uuid references private.app_users(id) on delete set null,
  created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
  check(ends_at>starts_at),
  foreign key(business_id,customer_id) references private.customers(business_id,id),
  foreign key(business_id,service_id) references private.services(business_id,id),
  foreign key(business_id,employee_id) references private.employees(business_id,id)
);
create unique index if not exists appointments_business_id_id_uq on private.appointments(business_id,id);
do $$ begin
  if not exists(select 1 from pg_constraint where conname='appointments_employee_no_overlap') then
    alter table private.appointments add constraint appointments_employee_no_overlap
      exclude using gist(employee_id with =,tstzrange(starts_at,ends_at,'[)') with &&)
      where(status in ('pending','confirmed'));
  end if;
end $$;
create index if not exists appointments_business_time_idx on private.appointments(business_id,starts_at);
create index if not exists appointments_customer_idx on private.appointments(customer_id,starts_at desc);
create index if not exists appointments_employee_time_idx on private.appointments(employee_id,starts_at);

create table if not exists private.payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references private.businesses(id) on delete cascade,
  appointment_id uuid not null,amount numeric(12,2) not null check(amount>0),
  method text not null check(method in ('cash','card','bank_transfer','other')),
  paid_at timestamptz not null default now(),note text,created_at timestamptz not null default now(),
  foreign key(business_id,appointment_id) references private.appointments(business_id,id)
);
create index if not exists payments_business_paid_idx on private.payments(business_id,paid_at desc);

create table if not exists private.expenses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references private.businesses(id) on delete cascade,
  amount numeric(12,2) not null check(amount>0),
  category text not null check(category in ('rent','salary','supplies','utilities','maintenance','marketing','other')),
  description text not null,incurred_at timestamptz not null,
  payment_method text not null check(payment_method in ('cash','card','bank_transfer','other')),
  created_at timestamptz not null default now()
);
create index if not exists expenses_business_date_idx on private.expenses(business_id,incurred_at desc);

create table if not exists private.client_appointment_requests (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references private.businesses(id) on delete cascade,
  appointment_id uuid not null,customer_id uuid not null,
  kind text not null check(kind in ('cancellation','reschedule')),
  status text not null default 'pending' check(status in ('pending','approved','declined')),
  requested_starts_at timestamptz,created_at timestamptz not null default now(),reviewed_at timestamptz,
  foreign key(business_id,appointment_id) references private.appointments(business_id,id),
  foreign key(business_id,customer_id) references private.customers(business_id,id)
);
create index if not exists client_requests_business_status_idx on private.client_appointment_requests(business_id,status,created_at);

create table if not exists private.customer_consent_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references private.businesses(id) on delete cascade,customer_id uuid not null,
  action text not null check(action in ('granted','revoked')),
  channel text not null check(channel in ('whatsapp','email','sms','all')),
  source text not null check(source in ('in_person','whatsapp','email','phone','website','other')),
  note text,captured_at timestamptz not null,customer_confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key(business_id,customer_id) references private.customers(business_id,id)
);
create index if not exists customer_consent_business_customer_idx on private.customer_consent_events(business_id,customer_id,captured_at desc);

create table if not exists private.customer_reminders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references private.businesses(id) on delete cascade,customer_id uuid not null,
  due_at timestamptz not null,note text not null,
  status text not null default 'pending' check(status in ('pending','completed','cancelled')),
  created_at timestamptz not null default now(),
  foreign key(business_id,customer_id) references private.customers(business_id,id)
);
create index if not exists customer_reminders_business_due_idx on private.customer_reminders(business_id,due_at);

create table if not exists private.commission_entries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references private.businesses(id) on delete cascade,
  appointment_id uuid not null,employee_id uuid not null,service_name text not null,
  base_amount numeric(12,2) not null check(base_amount>=0),
  commission_type text not null check(commission_type in ('percentage','fixed')),
  commission_value numeric(12,2) not null check(commission_value>=0),
  amount numeric(12,2) not null check(amount>=0),earned_at timestamptz not null,
  unique(business_id,appointment_id),
  foreign key(business_id,appointment_id) references private.appointments(business_id,id),
  foreign key(business_id,employee_id) references private.employees(business_id,id)
);
create index if not exists commission_entries_business_employee_idx on private.commission_entries(business_id,employee_id,earned_at desc);

create table if not exists private.payroll_payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references private.businesses(id) on delete cascade,employee_id uuid not null,
  amount numeric(12,2) not null check(amount>0),
  method text not null check(method in ('cash','card','bank_transfer','other')),
  paid_at timestamptz not null,note text,
  foreign key(business_id,employee_id) references private.employees(business_id,id)
);
create index if not exists payroll_payments_business_employee_idx on private.payroll_payments(business_id,employee_id,paid_at desc);

revoke all on all tables in schema private from public;
