# Calendar integrations

## Current implementation status

The provider settings UI now exposes preferences for two-way calendar sync with Google Calendar and Apple Calendar. These preferences are stored with the business in the current browser demo repository. Provider connection actions intentionally remain disabled until a trusted backend exists.

**No external calendar account is connected yet.** The frontend does not store OAuth tokens, iCloud passwords, or app-specific passwords. Do not enable connection buttons by removing the disabled state: doing so without server endpoints would create a misleading and unsafe flow.

## Providers and supported behavior

- Google Calendar: OAuth 2.0 authorization-code flow with PKCE; Google Calendar API.
- Apple Calendar: CalDAV against the user's iCloud calendar, authenticated only from a server using an app-specific password. Never request or store an Apple ID password in the browser.
- Both providers: per-owner and per-employee account connections; user-selected calendars; two-way sync; busy-time import; appointment create/update/cancel; sync health and last-sync status.

## Required backend

A first version-controlled Supabase schema foundation now exists at `supabase/migrations/20261111202000_calendar_connection_security_foundation.sql`. It creates private, RLS-enabled calendar metadata, busy-interval, sync-queue, OAuth-state and encrypted-secret tables. It has **not** been applied to a database, and it deliberately does not grant browser roles access. The app still has no live Supabase connection or deployed Edge Functions.

Supabase has not yet been provisioned for this project. Once it is available, implement:

1. Authenticated, tenant-scoped calendar connection records.
2. A server-side OAuth callback and token refresh service for Google.
3. A server-side CalDAV adapter for iCloud. Store app-specific credentials encrypted with a server-managed key; never expose them to the client.
4. A sync queue/worker with retry, exponential backoff, idempotency keys and dead-letter handling.
5. Google push notifications where configured, plus periodic reconciliation. CalDAV requires scheduled polling/reconciliation.
6. A booking validation endpoint that checks internal appointments and imported busy intervals atomically before confirming or rescheduling.
7. Audit events, disconnect/revoke handling, token rotation and deletion of imported event details when a connection is removed.

## Suggested data model

- `calendar_connections`: id, business_id, employee_id nullable (owner/business connection), provider, provider_account_id, encrypted_refresh_token or encrypted CalDAV credential reference, status, connected_at, last_sync_at, last_error.
- `calendar_resources`: id, connection_id, provider_calendar_id, display_name, sync_to_provider, read_busy_time, timezone, enabled.
- `calendar_event_links`: id, connection_id, appointment_id, provider_event_id, provider_calendar_id, etag/version, last_synced_at. Unique on connection + provider event and connection + appointment.
- `external_busy_intervals`: id, connection_id, provider_event_id, starts_at, ends_at, availability_scope, last_seen_at. Store only the minimum event data needed for availability; do not import private event titles or descriptions.
- `calendar_sync_jobs`: id, connection_id, operation, idempotency_key, payload, attempts, run_after, completed_at, last_error.

Every table must have tenant-aware foreign keys and RLS. Credentials must be encrypted server-side and inaccessible to browser clients, logs, analytics and support exports.

## Sync rules

- Publish confirmed appointments by default. Pending requests remain private unless the owner opts in.
- Write a stable Salon Reservation event ID in provider event metadata so events can be recognized on later syncs.
- Update/delete only provider events linked to Salon Reservation records. Never edit or delete unrelated personal events.
- Read external events as busy intervals only. Do not copy titles, notes, attendees or locations into the salon system.
- Ignore Salon Reservation's own linked events when importing busy intervals to avoid self-conflicts.
- Use half-open interval overlap checks: start < other end AND end > other start. Adjacent appointments are allowed.
- Treat all-day events as busy for the full local calendar day. Normalize timed events to UTC while preserving the calendar's IANA timezone and DST rules.
- On provider API failure, retain the last successful busy snapshot and show its age; do not silently assume the calendar is free.
- Resolve simultaneous edits conservatively: salon appointment changes remain authoritative for salon records; personal event changes only affect availability. If a salon booking conflicts with a newly imported personal event, flag it for owner action rather than moving either event automatically.
- Disconnecting a provider stops future sync and revokes credentials where supported. It must not delete personal calendar events.

## API contract to implement

- `POST /calendar/connections/google/start` — create short-lived OAuth state and return authorization URL.
- `GET /calendar/connections/google/callback` — validate state, exchange code server-side, persist encrypted credentials.
- `POST /calendar/connections/apple` — accept an app-specific password over TLS and persist it only after server-side encryption; never log request bodies.
- `GET /calendar/connections` — list safe connection metadata, never secrets.
- `PATCH /calendar/resources/:id` — update calendar selection and sync direction.
- `POST /calendar/connections/:id/sync` — enqueue reconciliation.
- `DELETE /calendar/connections/:id` — disconnect, revoke and purge credentials.
- Internal worker: process provider notifications, sync jobs and periodic reconciliation.

## Rollout checklist

- [ ] Provision Supabase and configure Auth, RLS, encrypted secret storage and scheduled worker.
- [ ] Register Google OAuth consent screen, client ID/secret and approved redirect URI.
- [ ] Implement and verify Google OAuth, token refresh, event CRUD and push notifications.
- [ ] Implement Apple app-specific-password onboarding and CalDAV discovery/event CRUD.
- [ ] Add employee sign-in and per-employee connection ownership.
- [ ] Integrate imported busy intervals into slot generation and server-side atomic booking validation.
- [ ] Add sync health, reconnect, disconnect and conflict review UI.
- [ ] Test DST transitions, recurring events, all-day events, deleted/edited events, revoked tokens, rate limits, retries and duplicate delivery.
- [ ] Complete privacy review and user-facing consent before production rollout.
