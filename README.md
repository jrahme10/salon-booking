# Salon Reservation

A salon management and appointment discovery platform for Lebanon, designed to expand internationally.

## Live preview

Once the GitHub Pages deployment workflow has completed successfully:

https://jrahme10.github.io/salon-booking/

The preview deploys from the `production-foundation` branch. It is a frontend demo and is not ready for real customer bookings.

## Current implementation

- React + TypeScript + Vite frontend
- Provider workspace with overview, calendar, bookings, services, team, customers, analytics, finances and settings routes
- Client-side marketplace preview
- Typed repository interface separating UI pages from persistence
- Local demo repository with browser persistence for appointment status changes
- Responsive layouts for desktop and mobile

## Run locally

```bash
npm install
npm run dev
```

Create a production build:

```bash
npm run build
npm run preview
```

## GitHub Pages deployment

Every push to `production-foundation` runs `.github/workflows/deploy-pages.yml`, builds the Vite app, and deploys the `dist` directory to GitHub Pages. The Vite base path and router basename are configured for the repository URL. A `404.html` fallback is included for client-side routes.

If the first deployment does not start, enable GitHub Pages in repository Settings → Pages and set the build and deployment source to **GitHub Actions**. Then re-run the Deploy Salon Reservation to GitHub Pages workflow from the Actions tab.

## Architecture direction

The current repository adapter uses local demo data so the frontend can be developed before the Supabase project is available. Supabase will be introduced behind the repository contracts; UI components should not call the Supabase SDK directly.

Planned backend foundations:
- Supabase Auth for client, employee and business-owner identities
- PostgreSQL with tenant-aware Row Level Security
- Business locations, services, employees, schedules and appointment records
- Server-side booking availability and conflict prevention
- Storage policies for provider imagery
- Realtime updates for booking status and calendar changes

## Important status

This is an active development preview, not a production service. Demo records are not shared across devices, authentication is not connected, and booking availability must be enforced server-side before real customers can book. Do not use the demo repository for real customer or payment data.
