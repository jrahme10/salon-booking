import type { neon } from "@neondatabase/serverless";
import { validatePublicBooking, type RuleBusiness, type RuleEmployee, type RuleService } from "./booking-rules";

type Sql = ReturnType<typeof neon<false, false>>;
type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type JsonFn = (body: Record<string, unknown>, status: number, origin: string | null) => Response;

export interface PublicContext {
  request: Request;
  url: URL;
  sql: Sql;
  origin: string | null;
  json: JsonFn;
  readBody: (request: Request) => Promise<Record<string, unknown> | null>;
  sha256Hex: (value: string) => Promise<string>;
  randomHex: (size: number) => string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN = /^[a-f0-9]{64}$/;
const MAX_CLIENT_BOOKINGS_PER_HOUR = 60;
const MAX_PENDING_PER_PHONE = 3;
const rows = async (query: Promise<unknown>) => (await query) as Row[];
const iso = (value: unknown) => new Date(value as string).toISOString();
const text = (body: Record<string, unknown>, key: string) => (typeof body[key] === "string" ? (body[key] as string).trim() : "");

async function findBusiness(sql: Sql, slug: string): Promise<Row | null> {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length > 80) return null;
  const found = await sql`select id::text, name, slug, category, city, address, phone, email, website, description, currency, timezone,
    working_hours as "workingHours", booking_rules as "bookingRules",
    calendar_preferences->'brandTheme' as "brandTheme", calendar_preferences->'logoDataUrl' as "logoDataUrl"
    from private.businesses where slug=${slug} limit 1` as unknown as Row[];
  return found[0] ?? null;
}

async function findBusinessById(sql: Sql, id: string): Promise<Row | null> {
  const found = await sql`select id::text, name, slug, category, city, address, phone, email, website, description, currency, timezone,
    working_hours as "workingHours", booking_rules as "bookingRules",
    calendar_preferences->'brandTheme' as "brandTheme", calendar_preferences->'logoDataUrl' as "logoDataUrl"
    from private.businesses where id=${id}::uuid limit 1` as unknown as Row[];
  return found[0] ?? null;
}

/** Only fields a visitor needs: no commission rates, no customer data. */
async function publicCatalog(sql: Sql, businessId: string) {
  const services = await rows(sql`select id::text, business_id::text as "businessId", name, category,
    duration_minutes as "durationMinutes", price::float8 as price, active
    from private.services where business_id=${businessId}::uuid and active order by name`);
  const employees = await rows(sql`select id::text, business_id::text as "businessId", name, role, initials, active,
    service_ids::text[] as "serviceIds", working_hours as "workingHours", time_off::text[] as "timeOff"
    from private.employees where business_id=${businessId}::uuid and active order by name`);
  return { services, employees };
}

/** Other people's appointments, anonymised to what availability needs. */
async function busyAppointments(sql: Sql, businessId: string, excludeIds: string[]) {
  const found = await rows(sql`select id::text, employee_id::text as "employeeId", service_id::text as "serviceId", starts_at as "startsAt", status
    from private.appointments
    where business_id=${businessId}::uuid and status in ('pending','confirmed') and ends_at>now() and starts_at<now()+interval '200 days'
      and id<>all(${excludeIds}::uuid[])
    order by starts_at limit 5000`);
  return found.map((row) => ({ id: "busy-" + row.id, businessId, customerId: "", serviceId: row.serviceId, employeeId: row.employeeId,
    startsAt: iso(row.startsAt), status: row.status, paidAmount: 0 }));
}

const ruleBusiness = (business: Row): RuleBusiness => ({
  timezone: business.timezone || "Asia/Beirut",
  workingHours: business.workingHours ?? {},
  bookingRules: business.bookingRules ?? {},
});
const ruleService = (service: Row): RuleService => ({ id: service.id, active: service.active, durationMinutes: service.durationMinutes });
const ruleEmployee = (employee: Row): RuleEmployee => ({
  active: employee.active,
  serviceIds: Array.isArray(employee.serviceIds) ? employee.serviceIds : null,
  workingHours: employee.workingHours ?? {},
  timeOff: Array.isArray(employee.timeOff) ? employee.timeOff : [],
});

async function loadServiceAndEmployee(sql: Sql, businessId: string, serviceId: string, employeeId: string) {
  const serviceRows = await rows(sql`select id::text, duration_minutes as "durationMinutes", active, name
    from private.services where id=${serviceId}::uuid and business_id=${businessId}::uuid`);
  const employeeRows = await rows(sql`select id::text, active, service_ids::text[] as "serviceIds", working_hours as "workingHours", time_off::text[] as "timeOff"
    from private.employees where id=${employeeId}::uuid and business_id=${businessId}::uuid`);
  return { service: serviceRows[0] ?? null, employee: employeeRows[0] ?? null };
}

/** Returns a Response for /public/* routes, or null when the path is not a public route. */
export async function handlePublicRequest(ctx: PublicContext): Promise<Response | null> {
  const { request, url, sql, origin, json } = ctx;
  if (!url.pathname.startsWith("/public/")) return null;
  const parts = url.pathname.split("/").filter(Boolean); // ["public", ...]
  try {
    // GET /public/salons/:slug
    if (request.method === "GET" && parts[1] === "salons" && parts.length === 3) {
      const business = await findBusiness(ctx.sql, parts[2]);
      if (!business) return json({ error: "Salon not found." }, 404, origin);
      const catalog = await publicCatalog(sql, business.id);
      const appointments = await busyAppointments(sql, business.id, []);
      return json({ business, ...catalog, appointments }, 200, origin);
    }

    // POST /public/salons/:slug/bookings
    if (request.method === "POST" && parts[1] === "salons" && parts[3] === "bookings" && parts.length === 4) {
      const body = await ctx.readBody(request);
      if (!body) return json({ error: "A valid JSON request body is required." }, 400, origin);
      const business = await findBusiness(sql, parts[2]);
      if (!business) return json({ error: "Salon not found." }, 404, origin);
      const name = text(body, "name"), phone = text(body, "phone"), email = text(body, "email");
      const serviceId = text(body, "serviceId"), employeeId = text(body, "employeeId"), startsAtRaw = text(body, "startsAt");
      const digits = phone.replace(/\D/g, "");
      if (!name || name.length > 160 || !/^[-+0-9() .]{6,25}$/.test(phone) || digits.length < 6)
        return json({ error: "Enter your name and a valid phone number." }, 400, origin);
      if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return json({ error: "Enter a valid email address." }, 400, origin);
      if (!UUID.test(serviceId) || !UUID.test(employeeId) || !Number.isFinite(Date.parse(startsAtRaw)))
        return json({ error: "Choose a service, team member and valid time." }, 400, origin);
      const startsAt = new Date(startsAtRaw);

      const { service, employee } = await loadServiceAndEmployee(sql, business.id, serviceId, employeeId);
      if (!service || !employee) return json({ error: "The selected service or team member is unavailable." }, 400, origin);
      const reason = validatePublicBooking({ business: ruleBusiness(business), service: ruleService(service), employee: ruleEmployee(employee), startsAt });
      if (reason) return json({ error: reason }, 400, origin);

      // Abuse caps (no per-IP store is available, so cap per salon and per phone number).
      const recent = await rows(sql`select count(*)::int as n from private.appointments
        where business_id=${business.id}::uuid and source='client' and created_at>now()-interval '1 hour'`);
      if (recent[0].n >= MAX_CLIENT_BOOKINGS_PER_HOUR) return json({ error: "This salon is receiving many requests. Please try again later." }, 429, origin);
      const pending = await rows(sql`select count(*)::int as n from private.appointments a join private.customers c on c.id=a.customer_id
        where a.business_id=${business.id}::uuid and a.source='client' and a.status='pending' and a.starts_at>now()
          and regexp_replace(c.phone,'\\D','','g')=${digits}`);
      if (pending[0].n >= MAX_PENDING_PER_PHONE) return json({ error: "You already have several pending requests. Please wait for the salon to confirm them." }, 429, origin);

      let customerId: string;
      const existing = await rows(sql`select id::text from private.customers where business_id=${business.id}::uuid
        and regexp_replace(phone,'\\D','','g')=${digits} order by created_at limit 1`);
      if (existing.length) customerId = existing[0].id;
      else {
        const created = await rows(sql`insert into private.customers(business_id,name,phone,email)
          values(${business.id}::uuid,${name},${phone},${email}) returning id::text`);
        customerId = created[0].id;
      }

      let appointment: Row;
      try {
        const inserted = await rows(sql`insert into private.appointments(business_id,customer_id,service_id,employee_id,starts_at,ends_at,status,source)
          values(${business.id}::uuid,${customerId}::uuid,${serviceId}::uuid,${employeeId}::uuid,${startsAt.toISOString()}::timestamptz,
            ${startsAt.toISOString()}::timestamptz+make_interval(mins=>${service.durationMinutes}),'pending','client')
          returning id::text,starts_at as "startsAt",status`);
        appointment = inserted[0];
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (message.includes("appointments_employee_no_overlap") || message.includes("exclusion"))
          return json({ error: "That time was just taken. Please choose another time." }, 409, origin);
        throw error;
      }

      // Reuse the caller's token only when it already belongs to this salon; otherwise issue a new one.
      let token = text(body, "accessToken");
      let reuse = false;
      if (TOKEN.test(token)) {
        const hash = await ctx.sha256Hex(token);
        const owned = await rows(sql`select 1 as ok from private.booking_access_tokens where token_hash=decode(${hash},'hex') and business_id=${business.id}::uuid limit 1`);
        reuse = owned.length > 0;
      }
      if (!reuse) token = ctx.randomHex(32);
      const hash = await ctx.sha256Hex(token);
      await sql`insert into private.booking_access_tokens(token_hash,business_id,appointment_id,display_name)
        values(decode(${hash},'hex'),${business.id}::uuid,${appointment.id}::uuid,${name})`;
      return json({ appointment: { id: appointment.id, startsAt: iso(appointment.startsAt), status: appointment.status }, accessToken: token }, 201, origin);
    }

    // POST /public/my-bookings  { accessToken }
    if (request.method === "POST" && parts[1] === "my-bookings" && parts.length === 2) {
      const body = await ctx.readBody(request);
      const token = body ? text(body, "accessToken") : "";
      if (!TOKEN.test(token)) return json({ error: "No bookings were found for this browser." }, 404, origin);
      const hash = await ctx.sha256Hex(token);
      const own = await rows(sql`select a.id::text, a.business_id::text as "businessId", a.service_id::text as "serviceId", a.employee_id::text as "employeeId",
          a.starts_at as "startsAt", a.status, t.display_name as "displayName"
        from private.booking_access_tokens t join private.appointments a on a.id=t.appointment_id and a.business_id=t.business_id
        where t.token_hash=decode(${hash},'hex') order by a.starts_at`);
      if (!own.length) return json({ error: "No bookings were found for this browser." }, 404, origin);
      const business = await findBusinessById(sql, own[0].businessId);
      if (!business) return json({ error: "Salon not found." }, 404, origin);
      const ids = own.map((row) => row.id);
      const requests = await rows(sql`select id::text, business_id::text as "businessId", appointment_id::text as "appointmentId", kind, status,
          requested_starts_at as "requestedStartsAt", created_at as "createdAt"
        from private.client_appointment_requests where appointment_id=any(${ids}::uuid[]) order by created_at`);
      const catalog = await publicCatalog(sql, business.id);
      const busy = await busyAppointments(sql, business.id, ids);
      const mine = own.map((row) => ({ id: row.id, businessId: row.businessId, customerId: "me", serviceId: row.serviceId, employeeId: row.employeeId,
        startsAt: iso(row.startsAt), status: row.status, paidAmount: 0, source: "client" }));
      return json({ displayName: own[0].displayName, business, ...catalog, appointments: [...mine, ...busy],
        clientRequests: requests.map((row) => ({ ...row, customerId: "me", requestedStartsAt: row.requestedStartsAt ? iso(row.requestedStartsAt) : undefined, createdAt: iso(row.createdAt) })) }, 200, origin);
    }

    // POST /public/my-bookings/requests  { accessToken, appointmentId, kind, requestedStartsAt? }
    if (request.method === "POST" && parts[1] === "my-bookings" && parts[2] === "requests" && parts.length === 3) {
      const body = await ctx.readBody(request);
      if (!body) return json({ error: "A valid JSON request body is required." }, 400, origin);
      const token = text(body, "accessToken"), appointmentId = text(body, "appointmentId"), kind = text(body, "kind"), requestedRaw = text(body, "requestedStartsAt");
      if (!TOKEN.test(token) || !UUID.test(appointmentId) || !["cancellation", "reschedule"].includes(kind))
        return json({ error: "Choose a valid request." }, 400, origin);
      const hash = await ctx.sha256Hex(token);
      const found = await rows(sql`select a.id::text, a.business_id::text as "businessId", a.customer_id::text as "customerId", a.service_id::text as "serviceId",
          a.employee_id::text as "employeeId", a.starts_at as "startsAt", a.status
        from private.booking_access_tokens t join private.appointments a on a.id=t.appointment_id and a.business_id=t.business_id
        where t.token_hash=decode(${hash},'hex') and a.id=${appointmentId}::uuid limit 1`);
      const appointment = found[0];
      if (!appointment) return json({ error: "This appointment could not be found." }, 404, origin);
      if (!["pending", "confirmed"].includes(appointment.status)) return json({ error: "Only active appointments can be changed." }, 409, origin);
      const startsAt = new Date(appointment.startsAt);
      if (startsAt.getTime() <= Date.now()) return json({ error: "Requests are only available for future appointments." }, 409, origin);
      const business = await findBusinessById(sql, appointment.businessId);
      if (!business) return json({ error: "Salon not found." }, 404, origin);
      const waiting = await rows(sql`select 1 as ok from private.client_appointment_requests where appointment_id=${appointmentId}::uuid and status='pending' limit 1`);
      if (waiting.length) return json({ error: "There is already a request waiting for this appointment." }, 409, origin);

      let requestedStartsAt: string | null = null;
      if (kind === "cancellation") {
        const notice = Number(business.bookingRules?.cancellationNoticeHours ?? 0);
        if (startsAt.getTime() < Date.now() + notice * 3_600_000) return json({ error: "The cancellation notice period has passed. Please contact the salon directly." }, 409, origin);
      } else {
        if (!Number.isFinite(Date.parse(requestedRaw))) return json({ error: "Choose a new date and time." }, 400, origin);
        const requested = new Date(requestedRaw);
        const { service, employee } = await loadServiceAndEmployee(sql, business.id, appointment.serviceId, appointment.employeeId);
        if (!service || !employee) return json({ error: "The appointment service or team member is no longer available." }, 409, origin);
        const reason = validatePublicBooking({ business: ruleBusiness(business), service: ruleService(service), employee: ruleEmployee(employee), startsAt: requested });
        if (reason) return json({ error: reason }, 400, origin);
        const clash = await rows(sql`select 1 as ok from private.appointments a join private.services s on s.id=a.service_id
          where a.employee_id=${appointment.employeeId}::uuid and a.id<>${appointmentId}::uuid and a.status in ('pending','confirmed')
            and tstzrange(a.starts_at,a.ends_at,'[)') && tstzrange(${requested.toISOString()}::timestamptz,${requested.toISOString()}::timestamptz+make_interval(mins=>${service.durationMinutes}),'[)') limit 1`);
        if (clash.length) return json({ error: "That time is no longer available. Please choose another." }, 409, origin);
        requestedStartsAt = requested.toISOString();
      }
      const created = await rows(sql`insert into private.client_appointment_requests(business_id,appointment_id,customer_id,kind,requested_starts_at)
        values(${appointment.businessId}::uuid,${appointmentId}::uuid,${appointment.customerId}::uuid,${kind},${requestedStartsAt}::timestamptz)
        returning id::text,business_id::text as "businessId",appointment_id::text as "appointmentId",kind,status,requested_starts_at as "requestedStartsAt",created_at as "createdAt"`);
      const row = created[0];
      return json({ request: { ...row, customerId: "me", requestedStartsAt: row.requestedStartsAt ? iso(row.requestedStartsAt) : undefined, createdAt: iso(row.createdAt) } }, 201, origin);
    }

    return json({ error: "Not found" }, 404, origin);
  } catch (error) {
    console.error("public_request_failed", { name: error instanceof Error ? error.name : "UnknownError" });
    return json({ error: "We could not complete your request. Please try again." }, 500, origin);
  }
}
