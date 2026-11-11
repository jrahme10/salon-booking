# Salon Reservation API (Cloudflare Workers + Neon)

## Current state

- Cloudflare Worker: `salon-reservation-api`
- Neon PostgreSQL database: `salon-reservation`
- The Worker reads the Neon connection string from the Cloudflare secret `DATABASE_URL`.
- The Worker currently exposes only health checks. No business data or calendar credentials are exposed.
- The calendar migration is prepared but must not be applied until the database connection test succeeds.
- Authentication, tenant authorization, Google OAuth, Apple CalDAV, and background sync are not implemented yet.
- Git deployment connection smoke-test marker: 2026-11-11.

## Local development

From this directory:

```powershell
npm install
npx wrangler dev
```

For local development, set `DATABASE_URL` using a local `.dev.vars` file (never commit it):

```text
DATABASE_URL=postgresql://...
```

Add `.dev.vars` to gitignore before using it. Do not use a Vite `VITE_*` variable for database credentials.

## Deploy

From this directory:

```powershell
npx wrangler login
npx wrangler deploy
```

The existing Cloudflare Worker secret named `DATABASE_URL` should remain configured on the deployed Worker. If deploying to a different Worker service, add it there separately.

## Health checks

- `GET /` or `GET /health`: Worker status only.
- `GET /health/db`: runs a minimal `SELECT 1` against Neon. It never returns connection details.

## Database migration

After `/health/db` reports `database: connected`, apply:

```powershell
npx neonctl auth
npx neonctl connection-string
```

Use the Neon SQL Editor to execute `migrations/0001_calendar_foundation.sql`. Review the target project and database before executing it.

## Security requirements before production data access

1. Add an authentication provider and validate access tokens in the Worker.
2. Enforce business membership and role authorization on every business-scoped request.
3. Use a restricted database role for application access; keep owner credentials out of runtime where possible.
4. Encrypt provider credentials with a server-side key and never log request bodies or tokens.
5. Implement OAuth state/PKCE, CSRF protection, token refresh, revocation and audit events.
6. Add scheduled queue processing, retries, idempotency and reconciliation.
7. Add atomic server-side booking conflict checks before enabling production booking.

The current health-check Worker is deliberately not a production booking API.
