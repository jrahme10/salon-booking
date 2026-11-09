# Salon Reservation

A salon management and appointment discovery platform for Lebanon, designed to expand internationally.

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

This is an active development branch, not a production deployment. Demo records are not shared across devices, authentication is not connected, and booking availability must be enforced server-side before real customers can book. Do not use the demo repository for real customer or payment data.
