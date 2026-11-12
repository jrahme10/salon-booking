# Calendar integrations

## Current implementation status

The provider settings UI contains preferences for two-way sync with Google Calendar and Apple Calendar. The connection actions remain disabled until the authenticated provider flows and sync worker are implemented.

The backend foundation is being moved to **Cloudflare Workers + Neon PostgreSQL**. The Worker currently provides safe health checks only; no salon data, OAuth tokens, iCloud credentials or calendar events are exposed through API routes.

## Backend

- Worker source: `worker/src/index.ts`
- Worker deployment config: `worker/wrangler.toml`
- Neon migration: `worker/migrations/0001_calendar_foundation.sql`
- Runtime database secret: `DATABASE_URL` in Cloudflare Worker secrets
- Health endpoints: `GET /health` and `GET /health/db`

The calendar schema migration is prepared but must not be applied until `/health/db` reports a successful Neon connection. The app remains browser-local; no production authentication, shared database records or server-side booking locks are live yet.

## Providers and intended behavior

- Google Calendar: OAuth 2.0 authorization-code flow with PKCE; Google Calendar API.
- Apple Calendar: CalDAV against the user's iCloud calendar, authenticated only from the server using an app-specific password. The Worker follows iCloud redirects and discovers the account principal and calendar-home URL. Never request or store an Apple Account password in the browser.
- Both providers: per-owner and per-employee connections; user-selected calendars; two-way sync; busy-time import; appointment create/update/cancel; sync health and last-sync status.

## Required implementation before enabling Connect

1. Select and integrate an authentication provider; validate access tokens in the Worker.
2. Enforce business membership and role authorization on every business-scoped request.
3. Register Google OAuth consent screen, client ID/secret and exact callback URI.
4. Implement server-side Google OAuth state/PKCE, token exchange, refresh and revocation.
5. Implement Apple CalDAV calendar listing and event CRUD using the discovered principal and calendar-home URLs.
6. Encrypt provider credentials with a server-side key. Never log request bodies, tokens or passwords.
7. Implement scheduled sync queue processing, retries, exponential backoff, idempotency and reconciliation.
8. Integrate imported busy intervals into availability generation and atomic server-side booking validation.
9. Add audit events, disconnect/revoke handling, conflict review and deletion of imported event details when a connection is removed.

## Sync rules

- Publish confirmed appointments by default. Pending requests remain private unless the owner opts in.
- Write a stable Salon Reservation event ID in provider event metadata so events can be recognized on later syncs.
- Update/delete only provider events linked to Salon Reservation records. Never edit or delete unrelated personal events.
- Read external events as busy intervals only. Do not copy titles, notes, attendees or locations into the salon system.
- Ignore Salon Reservation's own linked events when importing busy intervals to avoid self-conflicts.
- Use half-open interval overlap checks: start < other end AND end > other start. Adjacent appointments are allowed.
- Treat all-day events as busy for the full local calendar day. Normalize timed events to UTC while preserving the calendar's IANA timezone and DST rules.
- On provider API failure, retain the last successful busy snapshot and show its age; do not silently assume the calendar is free.
- Resolve simultaneous edits conservatively: salon appointment changes remain authoritative for salon records; personal event changes only affect availability.
- Disconnecting a provider stops future sync and revokes credentials where supported. It must not delete personal calendar events.

## Security and rollout

The Worker health check is not a production booking API. Do not enable the calendar Connect buttons or use this backend for real bookings until authentication, tenant authorization, restricted database access, encrypted secrets, provider integrations, background sync and transactional booking checks have been implemented and tested.
