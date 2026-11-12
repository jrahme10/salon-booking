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


### Customer relationship insights

- Customer insights provides 30-day, 90-day and all-time reporting.
- Most loyal customers are ranked by completed lifetime visits, with actual lifetime collections used as a tie-breaker.
- Lapsed customers have no completed visit in the last 60 days and no future pending or confirmed appointment.
- Repeat-visit rate measures customers with at least two completed visits in the selected period divided by customers with at least one completed visit in that period.
- New versus returning classification compares the customer's first completed visit with the selected period; all-time reporting treats one-visit customers as new and multi-visit customers as returning.
- Average customer spend is actual recorded payments in the selected payment-date window divided by the number of customers with recorded payments in that window.
- Selecting a customer opens their full appointment history, service, team member, status, and recorded collections. Partial payments are summed per appointment.
- Visit metrics use completed appointment dates; spending uses payment transaction dates. The data is local demo data until Supabase is connected.


### Customer retention workflows

- Customer profiles can store a birthday date. The dashboard surfaces birthdays coming up in the next 30 days.
- Follow-up reminders can be created for any customer with a due date and note, then marked complete. Reminder records persist in the browser demo repository.
- The inactive-customer campaign targets customers with no completed visit in the last 60 days and no future pending or confirmed appointment, and includes only customers whose promotional consent is explicitly recorded on their profile.
- Campaign messages support `{name}` and `{business}` personalization tokens, are saved as a browser-local draft and previewed per eligible customer.
- Birthday greetings, follow-up reminders and inactive-customer campaign links open prefilled WhatsApp or email messages for manual review. The app does not send messages automatically; an approved messaging provider and server-side consent/opt-out handling are required before automated delivery.
- Customer birthday, marketing-consent, and reminder records remain local to the current browser until Supabase persistence and access controls are connected.


### Free-first customer messaging

- Birthday greetings, follow-up reminders and inactive-customer campaign links use shared message-template helpers and open prefilled WhatsApp/email messages for manual review.
- Promotional actions require the latest recorded consent event to grant permission for the specific channel. Consent records include channel, source, timestamp and optional evidence note; grant and opt-out events are retained as an append-only history. Legacy opt-in booleans without an audit event do not qualify.
- Owners can enable browser notifications for due follow-up reminders. Permission is requested only after clicking the enable control; duplicate alerts are suppressed in browser storage.
- Browser alerts work only while the app is open. This free-first workflow does not send messages automatically or run while the app is closed. Reliable scheduled delivery requires a backend scheduler and an approved messaging provider; WhatsApp Business Platform fees may apply.
- Reminder and consent data remains browser-local until Supabase persistence and access controls are connected.


### Multi-salon marketplace preview
- Added salon discovery with text search, city filtering, service-category filters, and sorting.
- Added salon-specific profile routes at `/salon/:slug`, with business details, service menus, starting prices, staff selection, available slots, and a manual-confirmation booking request flow.
- Added owner controls for the public booking slug and marketplace visibility in Business Settings. Active services appear in the salon profile.
- The directory currently contains clearly labeled sample listings. Their sample ratings/review counts are not presented as customer ratings.
- Marketplace demo data and non-primary sample requests are browser-local previews only. They are not connected to a shared provider inbox, real salon accounts, or Supabase. A production marketplace still requires server-backed business discovery, tenant-scoped data, listing moderation, verified ratings, and transactional booking storage.


## Calendar integrations

The provider settings include two-way sync preferences for Google Calendar and Apple Calendar. The current frontend is a setup foundation only: external accounts are not connected until the secure server-side OAuth/CalDAV services, encrypted credential storage, sync worker and atomic availability validation described in [CALENDAR_INTEGRATION.md](./CALENDAR_INTEGRATION.md) are deployed. No calendar credentials are stored in browser storage.
