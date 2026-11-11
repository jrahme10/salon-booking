# Legacy Supabase foundation (not active)

The project backend direction has changed to **Cloudflare Workers + Neon PostgreSQL** because the Supabase project limit was reached.

Do not create, link, migrate or deploy a Supabase project for this application. The active backend implementation is in the `worker/` directory.

The former Supabase-specific calendar migration is retained in Git history only. Use `worker/migrations/0001_calendar_foundation.sql` for the Neon schema after the Worker database health check succeeds.
