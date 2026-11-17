# Graph Report - salon-booking-main  (2026-11-17)

## Corpus Check
- 66 files · ~28,794 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: .css 5, .webmanifest 1, .tsbuildinfo 1)

## Summary
- 674 nodes · 1499 edges · 30 communities (25 shown, 5 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `bc834af8`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- demo-repository.ts
- types.ts
- MonthlyFinanceReport.tsx
- App.tsx
- DemoRepository
- scheduling.ts
- worker/package.json
- public.ts
- package.json
- index.ts
- ApiRepository
- Important status
- 0003_customer_payroll.sql
- compilerOptions
- PayrollPayment
- compilerOptions
- 0002_core_platform.sql
- 0001_calendar_foundation.sql
- compilerOptions
- Salon Reservation API (Cloudflare Workers + Neon)
- Customer consent and opt-out history
- Calendar provider setup
- private.booking_access_tokens
- supabase/README.md
- BusinessDashboard.tsx
- Appointment
- types.ts
- EmployeePerformance.tsx
- FinanceManager.tsx

## God Nodes (most connected - your core abstractions)
1. `DemoRepository` - 42 edges
2. `Appointment` - 38 edges
3. `salonRepository` - 37 edges
4. `ApiRepository` - 37 edges
5. `Service` - 36 edges
6. `Employee` - 32 edges
7. `copy()` - 27 edges
8. `Business` - 27 edges
9. `Payment` - 25 edges
10. `Customer` - 21 edges

## Surprising Connections (you probably didn't know these)
- `EmployeePerformanceRow` --references--> `Employee`  [EXTRACTED]
  src/domain/employee-performance.ts → src/types.ts
- `ServicePerformanceRow` --references--> `Service`  [EXTRACTED]
  src/domain/service-performance.ts → src/types.ts
- `Provider()` --calls--> `CustomerInsights()`  [EXTRACTED]
  src/App.tsx → src/components/CustomerInsights.tsx
- `Provider()` --calls--> `FinanceManager()`  [EXTRACTED]
  src/App.tsx → src/components/FinanceManager.tsx
- `Provider()` --calls--> `getAuthSession()`  [EXTRACTED]
  src/App.tsx → src/services/auth.ts

## Import Cycles
- None detected.

## Communities (30 total, 5 thin omitted)

### Community 0 - "demo-repository.ts"
Cohesion: 0.18
Nodes (8): appointment, service, validateExpense(), validatePayment(), StoredState, BusinessBookingRules, Expense, Payment

### Community 1 - "types.ts"
Cohesion: 0.09
Nodes (34): vitest, birthdayDate(), CustomerInsights(), dateLabel(), localDate(), money(), phoneDigits(), Props (+26 more)

### Community 2 - "MonthlyFinanceReport.tsx"
Cohesion: 0.20
Nodes (12): categoryNames, currentMonth(), methodNames, money(), monthLabel(), MonthlyFinanceReport(), Props, buildMonthlyFinanceReport() (+4 more)

### Community 3 - "App.tsx"
Cohesion: 0.07
Nodes (59): lucide-react, react, Analytics(), App(), BookingDialog(), Bookings(), Client(), Data (+51 more)

### Community 4 - "DemoRepository"
Cohesion: 0.11
Nodes (5): validateBooking(), copy(), DemoRepository, seed(), validateBusinessWindow()

### Community 5 - "scheduling.ts"
Cohesion: 0.10
Nodes (35): ClientAppointments(), ClientData, formatTime(), localToday(), ClientBooking(), clock(), dateKey(), formatMoney() (+27 more)

### Community 6 - "worker/package.json"
Cohesion: 0.12
Nodes (16): @neondatabase/serverless, wrangler, dependencies, @neondatabase/serverless, devDependencies, typescript, wrangler, typescript (+8 more)

### Community 7 - "public.ts"
Cohesion: 0.09
Nodes (35): fits(), isTime(), localParts(), MAX_BOOKING_HORIZON_DAYS, RuleBusiness, RuleEmployee, RuleService, Schedule (+27 more)

### Community 8 - "package.json"
Cohesion: 0.06
Nodes (28): dependencies, lucide-react, react, react-dom, react-router-dom, devDependencies, @types/react, @types/react-dom (+20 more)

### Community 9 - "index.ts"
Cohesion: 0.11
Nodes (31): appleCalDavRequest(), basicAuth(), CalendarEnv, digest(), discoverAppleCalendar(), encoder, encryptSecret(), handleCalendarRequest() (+23 more)

### Community 11 - "Important status"
Cohesion: 0.08
Nodes (23): Backend, Calendar integrations, Current implementation status, Providers and intended behavior, Required implementation before enabling Connect, Security and rollout, Sync rules, Architecture direction (+15 more)

### Community 12 - "0003_customer_payroll.sql"
Cohesion: 0.16
Nodes (20): app_users_email_lower_uq, app_users_phone_uq, auth_sessions_user_idx, client_requests_business_status_idx, commission_entries_business_employee_idx, customer_consent_business_customer_idx, customer_reminders_business_due_idx, expenses_business_date_idx (+12 more)

### Community 13 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, jsx, lib, module, moduleDetection, moduleResolution, noEmit (+11 more)

### Community 15 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+8 more)

### Community 16 - "0002_core_platform.sql"
Cohesion: 0.21
Nodes (12): app_users_email_lower_uq, app_users_phone_uq, auth_sessions_user_idx, client_requests_business_status_idx, expenses_business_date_idx, payments_business_paid_idx, private.app_users, private.auth_sessions (+4 more)

### Community 17 - "0001_calendar_foundation.sql"
Cohesion: 0.24
Nodes (14): business_memberships_user_idx, calendar_connections_business_idx, calendar_connections_employee_idx, calendar_oauth_states_expiry_idx, calendar_sync_jobs_ready_idx, external_busy_intervals_connection_time_idx, private.business_memberships, private.calendar_connection_secrets (+6 more)

### Community 18 - "compilerOptions"
Cohesion: 0.20
Nodes (9): compilerOptions, lib, module, moduleResolution, noEmit, skipLibCheck, strict, target (+1 more)

### Community 19 - "Salon Reservation API (Cloudflare Workers + Neon)"
Cohesion: 0.25
Nodes (7): Current state, Database migration, Deploy, Health checks, Local development, Salon Reservation API (Cloudflare Workers + Neon), Security requirements before production data access

### Community 20 - "Customer consent and opt-out history"
Cohesion: 0.29
Nodes (6): Current limitations, Customer consent and opt-out history, Purpose, Recording a grant, Recording an opt-out, Sending safeguards

### Community 21 - "Calendar provider setup"
Cohesion: 0.33
Nodes (5): Apple Calendar (iCloud), Calendar provider setup, Current implementation boundary, Google Calendar OAuth, Required Cloudflare Worker secrets

### Community 25 - "BusinessDashboard.tsx"
Cohesion: 0.11
Nodes (23): BusinessDashboard(), greeting(), initialsOf(), money(), monthLabel(), Props, timeOf(), buildBusinessDashboardReport() (+15 more)

### Community 26 - "Appointment"
Cohesion: 0.11
Nodes (9): CustomerBookingHistoryRow, salonRepository, Appointment, ClientAppointmentRequest, CustomerConsentEvent, CustomerReminder, CustomerReminderStatus, Employee (+1 more)

### Community 27 - "types.ts"
Cohesion: 0.13
Nodes (14): appointments, business, customers, employees, services, BookingStatus, BusinessBrandTheme, ClientRequestKind (+6 more)

### Community 28 - "EmployeePerformance.tsx"
Cohesion: 0.14
Nodes (15): EmployeePerformance(), money(), Props, buildEmployeePerformanceReport(), EmployeePerformanceReport, EmployeePerformanceRow, PerformancePeriod, base (+7 more)

### Community 29 - "FinanceManager.tsx"
Cohesion: 0.24
Nodes (10): categories, FinanceManager(), methods, money(), Props, today(), methods, money() (+2 more)

## Knowledge Gaps
- **5 isolated node(s):** `@types/react`, `@types/react-dom`, `typescript`, `typescript`, `wrangler`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 230 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `types.ts` to `demo-repository.ts`, `MonthlyFinanceReport.tsx`, `scheduling.ts`, `public.ts`, `package.json`, `PayrollPayment`, `BusinessDashboard.tsx`, `EmployeePerformance.tsx`?**
  _High betweenness centrality (0.184) - this node is a cross-community bridge._
- **What connects `@types/react`, `@types/react-dom`, `typescript` to the rest of the system?**
  _5 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `types.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0898989898989899 - nodes in this community are weakly interconnected._
- **Why does `Appointment` connect `Appointment` to `demo-repository.ts`, `types.ts`, `App.tsx`, `DemoRepository`, `scheduling.ts`, `ApiRepository`, `PayrollPayment`, `BusinessDashboard.tsx`, `types.ts`, `EmployeePerformance.tsx`, `FinanceManager.tsx`?**
  _High betweenness centrality (0.049) - this node is a cross-community bridge._
- **Should `App.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06506849315068493 - nodes in this community are weakly interconnected._
- **Should `DemoRepository` be split into smaller, more focused modules?**
  _Cohesion score 0.10993657505285412 - nodes in this community are weakly interconnected._
- **Should `scheduling.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0951219512195122 - nodes in this community are weakly interconnected._