# Supabase backend workspace

This directory is the version-controlled backend foundation. It is not connected to a hosted Supabase project yet.

## Current status

- The calendar schema migration is prepared but has **not** been applied to any database.
- No Edge Functions have been deployed.
- Google OAuth and Apple CalDAV credentials are not configured.
- The frontend Connect buttons must remain disabled until the authenticated endpoints and provider adapters are deployed and tested.

## Local setup

Install the Supabase CLI and Docker-compatible runtime, then run:

```bash
supabase --help
supabase init
```

If `supabase init` reports that this directory is already initialized, keep the existing generated configuration. Create migrations through the CLI:

```bash
supabase migration new calendar_connection_security_foundation
```

Move the reviewed SQL from the prepared migration file into the CLI-generated migration (or rename the prepared file to the generated timestamp only after confirming the CLI naming convention). Then start the local stack and validate from a clean database:

```bash
supabase start
supabase db reset
supabase migration list
```

Do not link or push to a hosted project until the correct project has been selected and its schema has been reviewed. Current app records are browser-local demo data and are not migrated by this calendar foundation.

## Security model

- Calendar tables and credentials live in the non-exposed `private` schema.
- RLS is enabled on every table. No `anon` or `authenticated` table grants are made.
- Edge Functions authenticate the caller, verify their business membership and role, then use a server-only secret key for database operations.
- OAuth access/refresh tokens and Apple app-specific passwords are encrypted by server code before writing to `private.calendar_connection_secrets`.
- Encryption keys and provider client secrets belong in Edge Function secrets, never in Vite variables or Git.
- Store only external event busy intervals, not personal event titles, descriptions, attendees or locations.
- A sync worker may update/delete only events represented by a matching `calendar_event_links` row.

## Schema integration note

The current frontend is still localStorage-based. The migration reserves UUID business and appointment identifiers, but intentionally does not invent foreign keys to core business tables that do not exist yet. When the canonical businesses, employees and appointments schema is introduced, add and validate those foreign keys in a follow-up migration before production use.

## Supabase CLI v3 note

CLI v3 targets the local stack by default. Hosted changes require an explicit remote target and confirmation; CI deployments must pass the explicit confirmation flag where required. Always inspect `supabase <command> --help` before running deployment commands.
