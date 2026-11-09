# Salon Reservation

A salon and beauty-business platform for Lebanon, designed for international expansion. It combines a provider workspace, client discovery marketplace and independent public booking pages.

## Frontend foundation
- React + TypeScript + Vite
- React Router
- Provider workspace: overview, calendar, bookings, services, team, customers, analytics, finances and settings
- Client discovery preview
- Typed domain models and replaceable repository abstraction

## Run locally
```bash
npm install
npm run dev
npm run build
```

## Backend strategy
Supabase setup is intentionally postponed. The UI uses `SalonRepository` and a demo adapter so a Supabase implementation can be introduced later without coupling pages to database calls. Never expose service-role or secret keys in browser code.

## Product requirements
- Multiple employees and future multiple business locations
- Provider manually confirms appointment requests
- Manual payment recording (cash, card, bank transfer, other); no online payment gateway initially
- USD and LBP support for Lebanon
- English and Arabic/RTL planned
- Tenant isolation and role permissions must be enforced before production data is enabled

## Release status
This branch is a frontend foundation, not yet a production release. Authentication, onboarding, full booking flow, shared persistence, secure availability/concurrency, role permissions, notifications, financial ledger, automated tests and deployment configuration remain to be implemented and verified.