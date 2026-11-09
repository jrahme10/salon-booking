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
- Local demo repository with browser persistence for appointment, service, employee and customer changes
- Employee working hours, recurring weekly days off and date-specific time off
- Service-to-employee assignments and available appointment slot calculation
- Booking validation for past times, inactive services/staff, working hours and overlapping appointments
- Provider service and team CRUD workflows
- Client booking request flow with a shareable `/book/<business-slug>` page and manual salon confirmation
- Business settings for profile, currency, opening hours, timezone and booking rules
- Manual payment ledger supporting full and partial appointment payments
- Expense tracking with categories, payment methods and dates
- Monthly finance reports with six-month income/expense trends and category/payment-method breakdowns
- Employee performance dashboard with 30-day, 90-day and all-time filters, completed appointments, estimated service value, payments collected, commission earned and outstanding commission balances
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

The current repository adapter uses local demo data so the frontend can be developed before the Supabase project is available. Payment and expense records, including monthly report inputs, are also stored locally in the browser; do not use this demo for real financial records. Supabase will be introduced behind the repository contracts; UI components should not call the Supabase SDK directly.

Planned backend foundations:
- Supabase Auth for client, employee and business-owner identities
- PostgreSQL with tenant-aware Row Level Security
- Business locations, services, employees, schedules and appointment records
- Server-side booking availability and conflict prevention
- Storage policies for provider imagery
- Realtime updates for booking status and calendar changes

## Important status

This is an active development preview, not a production service. Demo records are not shared across devices, authentication is not connected, and the current browser-only booking guard is not a substitute for server-side transactional locking. Multiple devices can still create conflicting requests because localStorage is not shared or concurrency-safe. Authentication, tenant isolation, Supabase persistence, server-side availability validation and transactional conflict prevention are required before real customers can book. Do not use the demo repository for real customer or payment data.


### Employee commissions and payroll

- Team members can have a percentage commission or a fixed amount per completed appointment; zero disables commission.
- Commissions are generated once when an appointment moves to completed. Each earning snapshots the service name, service price, commission type and rate so later changes do not rewrite historical earnings.
- Finance → Team payroll shows earned commission, payouts and outstanding balances. Payouts can be partial, but cannot exceed the unpaid commission balance.
- Payroll payouts are stored separately from operating expenses and included as salary expenses in monthly cash-flow reports, preventing double counting.
- This first version records commission payouts only; fixed monthly salaries, payroll tax, deductions and payslips are not included. Data is still browser-local demo data until Supabase is connected.


### Employee performance reporting

- Analytics compares each team member's completed appointments, cancellations, completion rate, unique clients served, recorded collections, commissions earned and outstanding lifetime commission balance.
- Filters include the last 30 days, last 90 days and all time. Activity, collections, and commissions earned follow the selected period; unpaid commission is shown as a lifetime balance.
- Service value is an estimate calculated from completed appointment counts and current service prices. It is not a historical invoice total because appointment records do not yet snapshot service prices.
- Collected revenue is based on recorded payment ledger entries linked to the employee's appointments.


### Owner business dashboard

- The owner home screen includes 30-day and 90-day reporting windows, recorded revenue compared with the immediately preceding equal-length period, net cash flow, appointment status counts and completion rate.
- A six-month cash trend compares recorded payments with recorded expenses and payroll payouts by transaction date.
- The dashboard highlights the top three active employees using estimated service value and separately displays recorded collections.
- Revenue means payments recorded in the payment ledger; it is not the total value of appointments or unpaid balances. Period comparisons use payment dates for revenue and expense/payroll transaction dates for costs.
- Appointment counts use appointment start dates. Employee service value uses current service prices and is an estimate, not a historical invoice total. All dashboard data remains browser-local demo data until Supabase and secure shared storage are connected.


### Service performance analytics

- The owner dashboard ranks active services by actual payments recorded against their appointments, using payment transaction dates for collections.
- Booking counts, completed appointments and cancellations use appointment start dates in the selected 30-day or 90-day window.
- The dashboard shows completion rate and current-price service value estimates alongside collected payments.
- Services without activity remain visible with zero metrics. Inactive services are excluded.
- Collected revenue is not the same as estimated service value; appointment and payment date windows are intentionally separate.
