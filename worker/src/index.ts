import { neon } from "@neondatabase/serverless";

interface Env {
  DATABASE_URL: string;
}

type WorkerHandler<E> = {
  fetch(request: Request, env: E): Response | Promise<Response>;
};

const allowedOrigins = new Set([
  "https://jrahme10.github.io",
  "http://localhost:5173",
]);

const SESSION_DAYS = 30;
const PASSWORD_ITERATIONS = 210_000;

function corsHeaders(origin: string | null): Headers {
  const headers = new Headers({
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  });
  if (origin && allowedOrigins.has(origin)) headers.set("Access-Control-Allow-Origin", origin);
  return headers;
}

function json(body: Record<string, unknown>, status: number, origin: string | null): Response {
  const headers = corsHeaders(origin);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(body), { status, headers });
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

function fromHex(value: string): Uint8Array {
  const result = new Uint8Array(value.length / 2);
  for (let i = 0; i < result.length; i++) result[i] = Number.parseInt(value.slice(i * 2, i * 2 + 2), 16);
  return result;
}

function randomHex(size: number): string {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

async function sha256Hex(value: string): Promise<string> {
  return toHex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))));
}

async function derivePassword(password: string, saltHex: string): Promise<string> {
  const saltBuffer = new ArrayBuffer(saltHex.length / 2);
  const saltBytes = new Uint8Array(saltBuffer);
  for (let i = 0; i < saltBytes.length; i++) saltBytes[i] = Number.parseInt(saltHex.slice(i * 2, i * 2 + 2), 16);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: saltBuffer, iterations: PASSWORD_ITERATIONS, hash: "SHA-256" },
    key,
    256,
  );
  return toHex(new Uint8Array(bits));
}

function safeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let i = 0; i < left.length; i++) difference |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return difference === 0;
}

function makeSlug(value: string): string {
  return value.normalize("NFKD").toLowerCase().replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "salon";
}

async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  const length = Number(request.headers.get("Content-Length") ?? 0);
  if (length > 16_384) return null;
  try {
    const value: unknown = await request.json();
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function validEmail(value: string): boolean {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

type NeonSql = ReturnType<typeof neon<false, false>>;

async function createSession(sql: NeonSql, userId: string) {
  const token = randomHex(32);
  const tokenHash = await sha256Hex(token);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000).toISOString();
  await sql`insert into private.auth_sessions (user_id, token_hash, expires_at)
    values (${userId}::uuid, decode(${tokenHash}, 'hex'), ${expiresAt}::timestamptz)`;
  return { token, expiresAt };
}

async function authenticate(request: Request, sql: NeonSql) {
  const authorization = request.headers.get("Authorization") ?? "";
  const match = /^Bearer ([a-f0-9]{64})$/i.exec(authorization);
  if (!match) return null;
  const tokenHash = await sha256Hex(match[1]);
  const rows = await sql`
    select u.id as user_id, u.email, u.display_name, m.business_id, m.role,
           b.name as business_name, b.slug as business_slug
    from private.auth_sessions s
    join private.app_users u on u.id = s.user_id
    join private.business_memberships m on m.user_id = u.id
    join private.businesses b on b.id = m.business_id
    where s.token_hash = decode(${tokenHash}, 'hex')
      and s.revoked_at is null and s.expires_at > now()
      and u.disabled_at is null
    order by case m.role when 'owner' then 0 when 'admin' then 1 else 2 end
    limit 1` as unknown as Record<string, unknown>[];
  return rows[0] ?? null;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("Origin");
    const headers = corsHeaders(origin);

    if (request.method === "OPTIONS") {
      if (origin && !allowedOrigins.has(origin)) return new Response(null, { status: 403, headers });
      return new Response(null, { status: 204, headers });
    }

    const url = new URL(request.url);
    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
      return json({ service: "salon-reservation-api", status: "ok", database: "not_checked" }, 200, origin);
    }

    if (!env.DATABASE_URL) return json({ status: "error", code: "DATABASE_NOT_CONFIGURED" }, 503, origin);
    const sql = neon(env.DATABASE_URL);

    if (request.method === "GET" && url.pathname === "/health/db") {
      try {
        await sql`select 1 as healthy`;
        const schema = await sql`select
          to_regclass('private.businesses') is not null as businesses,
          to_regclass('private.app_users') is not null as app_users,
          to_regclass('private.auth_sessions') is not null as auth_sessions,
          to_regclass('private.services') is not null as services,
          to_regclass('private.employees') is not null as employees,
          to_regclass('private.customers') is not null as customers,
          to_regclass('private.appointments') is not null as appointments,
          to_regclass('private.payments') is not null as payments,
          to_regclass('private.expenses') is not null as expenses,
          to_regclass('private.client_appointment_requests') is not null as client_requests,
          to_regclass('private.customer_consent_events') is not null as customer_consent,
          to_regclass('private.customer_reminders') is not null as customer_reminders,
          to_regclass('private.commission_entries') is not null as commissions,
          to_regclass('private.payroll_payments') is not null as payroll,
          exists(select 1 from information_schema.columns where table_schema='private' and table_name='businesses' and column_name='calendar_preferences') as calendar_preferences`;
        const schemaReady = Object.values(schema[0] as Record<string, boolean>).every(Boolean);
        return json({ service: "salon-reservation-api", status: "ok", database: "connected", schema_ready: schemaReady }, 200, origin);
      } catch {
        return json({ status: "error", code: "DATABASE_CONNECTION_FAILED" }, 503, origin);
      }
    }

    if (request.method === "POST" && url.pathname === "/auth/register") {
      const body = await readBody(request);
      const displayName = typeof body?.displayName === "string" ? body.displayName.trim() : "";
      const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
      const password = typeof body?.password === "string" ? body.password : "";
      const businessName = typeof body?.businessName === "string" ? body.businessName.trim() : "";
      const city = typeof body?.city === "string" ? body.city.trim() : "";
      if (!body || !displayName || displayName.length > 120 || !validEmail(email) ||
          password.length < 12 || password.length > 128 || !businessName ||
          businessName.length > 160 || !city || city.length > 120) {
        return json({ error: "Please provide your name, valid email, password (12–128 characters), salon name and city." }, 400, origin);
      }

      let registrationStage = "prepare_account";
      try {
        const userId = crypto.randomUUID();
        const businessId = crypto.randomUUID();
        const membershipId = crypto.randomUUID();
        registrationStage = "password_hash";
        const salt = randomHex(16);
        const passwordHash = `pbkdf2-sha256${PASSWORD_ITERATIONS}${salt}${await derivePassword(password, salt)}`;
        const slugBase = makeSlug(businessName);
        const slug = `${slugBase}-${randomHex(3)}`;
        registrationStage = "database_insert";
        const rows = await sql`
          with new_user as (
            insert into private.app_users (id, email, display_name, password_hash)
            values (${userId}::uuid, ${email}, ${displayName}, ${passwordHash})
            returning id
          ), new_business as (
            insert into private.businesses (id, name, slug, city, timezone, working_hours)
            values (${businessId}::uuid, ${businessName}, ${slug}, ${city}, 'Asia/Beirut',
              '{"sun":{"enabled":false,"start":"09:00","end":"18:00"},"mon":{"enabled":true,"start":"09:00","end":"18:00"},"tue":{"enabled":true,"start":"09:00","end":"18:00"},"wed":{"enabled":true,"start":"09:00","end":"18:00"},"thu":{"enabled":true,"start":"09:00","end":"18:00"},"fri":{"enabled":true,"start":"09:00","end":"18:00"},"sat":{"enabled":true,"start":"09:00","end":"18:00"}}'::jsonb)
            returning id, name, slug
          ), new_membership as (
            insert into private.business_memberships (id, business_id, user_id, role)
            select ${membershipId}::uuid, b.id, u.id, 'owner'
            from new_user u cross join new_business b
            returning user_id, business_id, role
          )
          select u.id as user_id, b.id as business_id, b.name as business_name, b.slug as business_slug, m.role
          from new_user u cross join new_business b cross join new_membership m`;
        registrationStage = "create_session";
        const session = await createSession(sql, userId);
        return json({ user: { id: rows[0].user_id, displayName, email },
          business: { id: rows[0].business_id, name: rows[0].business_name, slug: rows[0].business_slug },
          role: rows[0].role, ...session }, 201, origin);
      } catch (error) {
        const dbCode = error && typeof error === "object" && "code" in error
          ? String((error as { code?: unknown }).code ?? "") : "";
        const errorName = error instanceof Error ? error.name : "UnknownError";
        console.error("auth_register_failed", { stage: registrationStage, errorName, dbCode });
        if (dbCode === "23505") {
          return json({ error: "An account with this email already exists. Please sign in instead." }, 409, origin);
        }
        return json({ error: "Account creation failed. Please try again later.", stage: registrationStage }, 500, origin);
      }
    }

    if (request.method === "POST" && url.pathname === "/auth/login") {
      const body = await readBody(request);
      const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
      const password = typeof body?.password === "string" ? body.password : "";
      if (!validEmail(email) || !password || password.length > 128) {
        return json({ error: "Invalid email or password." }, 400, origin);
      }
      try {
        const users = await sql`select id, email, display_name, password_hash
          from private.app_users where lower(email) = ${email} and disabled_at is null limit 1`;
        const user = users[0];
        if (!user || typeof user.password_hash !== "string") return json({ error: "Invalid email or password." }, 401, origin);
        const parts = user.password_hash.split("$");
        if (parts.length !== 4 || parts[0] !== "pbkdf2-sha256" || Number(parts[1]) !== PASSWORD_ITERATIONS) {
          return json({ error: "Invalid email or password." }, 401, origin);
        }
        const actual = await derivePassword(password, parts[2]);
        if (!safeEqual(actual, parts[3])) return json({ error: "Invalid email or password." }, 401, origin);
        const memberships = await sql`select m.business_id, m.role, b.name as business_name, b.slug as business_slug
          from private.business_memberships m join private.businesses b on b.id = m.business_id
          where m.user_id = ${user.id}::uuid
          order by case m.role when 'owner' then 0 when 'admin' then 1 else 2 end limit 1`;
        if (!memberships.length) return json({ error: "No active salon membership is assigned to this account." }, 403, origin);
        const session = await createSession(sql, user.id);
        return json({ user: { id: user.id, displayName: user.display_name, email: user.email },
          business: { id: memberships[0].business_id, name: memberships[0].business_name, slug: memberships[0].business_slug },
          role: memberships[0].role, ...session }, 200, origin);
      } catch {
        return json({ error: "Sign-in is temporarily unavailable. Please try again." }, 503, origin);
      }
    }

    if (request.method === "GET" && url.pathname === "/auth/me") {
      try {
        const user = await authenticate(request, sql);
        if (!user) return json({ error: "Authentication required." }, 401, origin);
        return json({ user: { id: user.user_id, displayName: user.display_name, email: user.email },
          business: { id: user.business_id, name: user.business_name, slug: user.business_slug },
          role: user.role }, 200, origin);
      } catch {
        return json({ error: "Could not validate the session." }, 503, origin);
      }
    }

    if (request.method === "POST" && url.pathname === "/auth/logout") {
      const authorization = request.headers.get("Authorization") ?? "";
      const match = /^Bearer ([a-f0-9]{64})$/i.exec(authorization);
      if (!match) return json({ status: "ok" }, 200, origin);
      const tokenHash = await sha256Hex(match[1]);
      try {
        await sql`update private.auth_sessions set revoked_at = now()
          where token_hash = decode(${tokenHash}, 'hex') and revoked_at is null`;
        return json({ status: "ok" }, 200, origin);
      } catch {
        return json({ error: "Could not end the session." }, 503, origin);
      }
    }


    if (request.method === "GET" && url.pathname === "/provider/bootstrap") {
      try {
        const user = await authenticate(request, sql);
        if (!user) return json({ error: "Authentication required." }, 401, origin);
        const businessId = String(user.business_id);
        const businessRows = await sql`select id::text, name, slug, category, city, address, phone, email, website, description, currency, timezone,
          marketplace_visible as "marketplaceVisible", working_hours as "workingHours", booking_rules as "bookingRules", calendar_preferences as "calendarSyncPreferences"
          from private.businesses where id = ${businessId}::uuid limit 1` as unknown as Record<string, unknown>[];
        if (!businessRows.length) return json({ error: "Salon was not found." }, 404, origin);
        const services = await sql`select id::text, business_id::text as "businessId", name, category,
          duration_minutes as "durationMinutes", price::float8 as price, active
          from private.services where business_id = ${businessId}::uuid order by name` as unknown as Record<string, unknown>[];
        const employees = await sql`select id::text, business_id::text as "businessId", name, role, initials, active,
          service_ids as "serviceIds", working_hours as "workingHours", time_off as "timeOff",
          commission_type as "commissionType", commission_value::float8 as "commissionValue"
          from private.employees where business_id = ${businessId}::uuid order by name` as unknown as Record<string, unknown>[];
        const customers = await sql`select c.id::text, c.business_id::text as "businessId", c.name, c.phone, c.email,
          c.birthday::text as birthday, c.marketing_opt_in as "marketingOptIn",
          c.marketing_opt_in_updated_at as "marketingOptInUpdatedAt",
          count(a.id)::int as visits, max(a.starts_at) as "lastVisit"
          from private.customers c left join private.appointments a on a.customer_id=c.id and a.status='completed'
          where c.business_id=${businessId}::uuid group by c.id order by c.name` as unknown as Record<string, unknown>[];
        const appointments = await sql`select a.id::text, a.business_id::text as "businessId", a.customer_id::text as "customerId",
          a.service_id::text as "serviceId", a.employee_id::text as "employeeId", a.starts_at as "startsAt",
          a.status, a.source, coalesce(sum(p.amount),0)::float8 as "paidAmount",
          (a.starts_at + make_interval(mins => s.duration_minutes)) as "endsAt"
          from private.appointments a join private.services s on s.id=a.service_id
          left join private.payments p on p.appointment_id=a.id
          where a.business_id=${businessId}::uuid
          group by a.id,s.duration_minutes order by a.starts_at` as unknown as Record<string, unknown>[];
        const payments = await sql`select id::text, business_id::text as "businessId", appointment_id::text as "appointmentId",
          amount::float8 as amount, method, paid_at as "paidAt", note
          from private.payments where business_id=${businessId}::uuid order by paid_at desc` as unknown as Record<string, unknown>[];
        const expenses = await sql`select id::text, business_id::text as "businessId", amount::float8 as amount,
          category, description, incurred_at as "incurredAt", payment_method as "paymentMethod"
          from private.expenses where business_id=${businessId}::uuid order by incurred_at desc` as unknown as Record<string, unknown>[];
        const clientRequests = await sql`select id::text, business_id::text as "businessId", appointment_id::text as "appointmentId",
          customer_id::text as "customerId", kind, status, requested_starts_at as "requestedStartsAt", created_at as "createdAt"
          from private.client_appointment_requests where business_id=${businessId}::uuid order by created_at desc` as unknown as Record<string, unknown>[];
        const customerConsentEvents = await sql`select id::text,business_id::text as "businessId",customer_id::text as "customerId",
          action,channel,source,note,captured_at as "capturedAt",customer_confirmed as "customerConfirmed"
          from private.customer_consent_events where business_id=${businessId}::uuid order by captured_at desc`.catch(() => []) as unknown as Record<string, unknown>[];
        const customerReminders = await sql`select id::text,business_id::text as "businessId",customer_id::text as "customerId",
          due_at as "dueAt",note,status,created_at as "createdAt"
          from private.customer_reminders where business_id=${businessId}::uuid order by due_at`.catch(() => []) as unknown as Record<string, unknown>[];
        const commissionEntries = await sql`select id::text,business_id::text as "businessId",appointment_id::text as "appointmentId",
          employee_id::text as "employeeId",service_name as "serviceName",base_amount::float8 as "baseAmount",
          commission_type as "commissionType",commission_value::float8 as "commissionValue",amount::float8 as amount,earned_at as "earnedAt"
          from private.commission_entries where business_id=${businessId}::uuid order by earned_at desc`.catch(() => []) as unknown as Record<string, unknown>[];
        const payrollPayments = await sql`select id::text,business_id::text as "businessId",employee_id::text as "employeeId",
          amount::float8 as amount,method,paid_at as "paidAt",note
          from private.payroll_payments where business_id=${businessId}::uuid order by paid_at desc`.catch(() => []) as unknown as Record<string, unknown>[];
        return json({ business: businessRows[0], services, employees, customers, appointments, payments, expenses,
          clientRequests, customerConsentEvents, customerReminders, commissionEntries, payrollPayments,
          access: { role: user.role, canSchedule: user.role === "owner", readOnly: user.role !== "owner" } }, 200, origin);
      } catch {
        return json({ error: "Could not load salon workspace data." }, 503, origin);
      }
    }


    if (url.pathname.startsWith("/provider/") && request.method !== "GET") {
      const user = await authenticate(request, sql);
      if (!user) return json({ error: "Authentication required." }, 401, origin);
      if (user.role !== "owner") return json({ error: "Only the salon owner can change workspace data." }, 403, origin);
      const body = request.method === "DELETE" ? {} : await readBody(request);
      if (!body) return json({ error: "A valid JSON request body is required." }, 400, origin);
      const businessId = String(user.business_id);
      const path = url.pathname.split("/").filter(Boolean);
      const resource = path[1] ?? "";
      const id = path[2] ?? "";
      const value = (key: string, fallback = "") => typeof body[key] === "string" ? String(body[key]).trim() : fallback;
      const numeric = (key: string, fallback = NaN) => typeof body[key] === "number" ? Number(body[key]) : Number(value(key, String(fallback)));
      try {
        if (resource === "services" && request.method === "POST") {
          const name = value("name"), category = value("category", "Other");
          const duration = numeric("durationMinutes"), price = numeric("price");
          if (!name || name.length > 160 || !Number.isInteger(duration) || duration < 5 || duration > 1440 || !Number.isFinite(price) || price < 0)
            return json({ error: "Enter a valid service name, duration and price." }, 400, origin);
          const rows = await sql`insert into private.services (business_id,name,category,duration_minutes,price,active)
            values (${businessId}::uuid,${name},${category},${duration},${price},${body.active !== false})
            returning id::text,business_id::text as "businessId",name,category,duration_minutes as "durationMinutes",price::float8 as price,active`;
          return json({ service: rows[0] as unknown as Record<string, unknown> }, 201, origin);
        }
        if (resource === "services" && id && request.method === "PATCH") {
          const rows = await sql`with updated_service as (
              update private.services set name=${value("name")},category=${value("category","Other")},
                duration_minutes=${numeric("durationMinutes")},price=${numeric("price")},active=${body.active !== false},updated_at=now()
              where id=${id}::uuid and business_id=${businessId}::uuid
              returning id,business_id,name,category,duration_minutes,price,active
            ), adjusted_appointments as (
              update private.appointments a set ends_at=a.starts_at+make_interval(mins=>s.duration_minutes),updated_at=now()
              from updated_service s where a.service_id=s.id and a.business_id=s.business_id and a.status in ('pending','confirmed')
              returning a.id
            )
            select id::text,business_id::text as "businessId",name,category,duration_minutes as "durationMinutes",price::float8 as price,active
            from updated_service`;
          if (!rows.length) return json({ error: "Service was not found." }, 404, origin);
          return json({ service: rows[0] as unknown as Record<string, unknown> }, 200, origin);
        }
        if (resource === "services" && id && request.method === "DELETE") {
          const rows = await sql`update private.services set active=false,updated_at=now()
            where id=${id}::uuid and business_id=${businessId}::uuid returning id::text`;
          if (!rows.length) return json({ error: "Service was not found." }, 404, origin);
          return json({ status: "ok" }, 200, origin);
        }
        if (resource === "employees" && request.method === "POST") {
          const name=value("name"),role=value("role","Team member");
          if(!name||name.length>160)return json({error:"Enter a valid team member name."},400,origin);
          const serviceIds=Array.isArray(body.serviceIds)?body.serviceIds.filter((x):x is string=>typeof x==="string"):[];
          const workingHours=JSON.stringify(body.workingHours??{});
          const timeOff=Array.isArray(body.timeOff)?body.timeOff.filter((x):x is string=>typeof x==="string"):[];
          const commissionType=value("commissionType","percentage"),commissionValue=numeric("commissionValue",0);
          if(!["percentage","fixed"].includes(commissionType)||!Number.isFinite(commissionValue)||commissionValue<0||(commissionType==="percentage"&&commissionValue>100))
            return json({error:"Enter a valid commission value."},400,origin);
          const rows=await sql`insert into private.employees (business_id,name,role,initials,active,service_ids,working_hours,time_off,commission_type,commission_value)
            values(${businessId}::uuid,${name},${role},${value("initials",name.slice(0,2).toUpperCase())},${body.active!==false},${serviceIds}::uuid[],${workingHours}::jsonb,${timeOff}::date[],${commissionType},${commissionValue})
            returning id::text,business_id::text as "businessId",name,role,initials,active,service_ids as "serviceIds",working_hours as "workingHours",time_off as "timeOff",commission_type as "commissionType",commission_value::float8 as "commissionValue"`;
          return json({employee:rows[0] as unknown as Record<string,unknown>},201,origin);
        }
        if(resource==="employees"&&id&&request.method==="PATCH"){
          const name=value("name"),role=value("role","Team member");
          const serviceIds=Array.isArray(body.serviceIds)?body.serviceIds.filter((x):x is string=>typeof x==="string"):[];
          const workingHours=JSON.stringify(body.workingHours??{});
          const timeOff=Array.isArray(body.timeOff)?body.timeOff.filter((x):x is string=>typeof x==="string"):[];
          const commissionType=value("commissionType","percentage"),commissionValue=numeric("commissionValue",0);
          if(!name||!["percentage","fixed"].includes(commissionType)||!Number.isFinite(commissionValue)||commissionValue<0||(commissionType==="percentage"&&commissionValue>100))
            return json({error:"Enter valid team member details."},400,origin);
          const rows=await sql`update private.employees set name=${name},role=${role},initials=${value("initials",name.slice(0,2).toUpperCase())},
            active=${body.active!==false},service_ids=${serviceIds}::uuid[],working_hours=${workingHours}::jsonb,time_off=${timeOff}::date[],
            commission_type=${commissionType},commission_value=${commissionValue},updated_at=now()
            where id=${id}::uuid and business_id=${businessId}::uuid
            returning id::text,business_id::text as "businessId",name,role,initials,active,service_ids as "serviceIds",working_hours as "workingHours",time_off as "timeOff",commission_type as "commissionType",commission_value::float8 as "commissionValue"`;
          if(!rows.length)return json({error:"Team member was not found."},404,origin);
          return json({employee:rows[0] as unknown as Record<string,unknown>},200,origin);
        }
        if(resource==="employees"&&id&&request.method==="DELETE"){
          const rows=await sql`update private.employees set active=false,updated_at=now() where id=${id}::uuid and business_id=${businessId}::uuid returning id::text`;
          if(!rows.length)return json({error:"Team member was not found."},404,origin);
          return json({status:"ok"},200,origin);
        }
        if(resource==="customers"&&request.method==="POST"){
          const name=value("name"),phone=value("phone"),email=value("email");
          if(!name||!/^[-+0-9() .]{6,25}$/.test(phone))return json({error:"Enter a customer name and valid phone number."},400,origin);
          const rows=await sql`insert into private.customers(business_id,name,phone,email,birthday)
            values(${businessId}::uuid,${name},${phone},${email},nullif(${value("birthday")},'')::date)
            returning id::text,business_id::text as "businessId",name,phone,email,birthday::text as birthday,marketing_opt_in as "marketingOptIn",marketing_opt_in_updated_at as "marketingOptInUpdatedAt"`;
          return json({customer:rows[0] as unknown as Record<string,unknown>},201,origin);
        }
        if(resource==="customers"&&id&&request.method==="PATCH"){
          const name=value("name"),phone=value("phone"),email=value("email");
          if(!name||!/^[-+0-9() .]{6,25}$/.test(phone))return json({error:"Enter a customer name and valid phone number."},400,origin);
          const rows=await sql`update private.customers set name=${name},phone=${phone},email=${email},
            birthday=nullif(${value("birthday")},'')::date,updated_at=now()
            where id=${id}::uuid and business_id=${businessId}::uuid
            returning id::text,business_id::text as "businessId",name,phone,email,birthday::text as birthday,marketing_opt_in as "marketingOptIn",marketing_opt_in_updated_at as "marketingOptInUpdatedAt"`;
          if(!rows.length)return json({error:"Customer was not found."},404,origin);
          return json({customer:rows[0] as unknown as Record<string,unknown>},200,origin);
        }
        if(resource==="appointments"&&request.method==="POST"){
          const customerId=value("customerId"),serviceId=value("serviceId"),employeeId=value("employeeId");
          const startsAt=value("startsAt"),status=value("status","pending");
          if(!["pending","confirmed"].includes(status)||!customerId||!serviceId||!employeeId||!Number.isFinite(Date.parse(startsAt)))
            return json({error:"Choose a customer, service, team member and valid appointment time."},400,origin);
          const rows=await sql`insert into private.appointments(business_id,customer_id,service_id,employee_id,starts_at,ends_at,status,source,created_by)
            select ${businessId}::uuid,c.id,s.id,e.id,${startsAt}::timestamptz,
              ${startsAt}::timestamptz+make_interval(mins=>s.duration_minutes),${status},${value("source","provider")},${String(user.user_id)}::uuid
            from private.customers c,private.services s,private.employees e
            where c.id=${customerId}::uuid and c.business_id=${businessId}::uuid
              and s.id=${serviceId}::uuid and s.business_id=${businessId}::uuid and s.active
              and e.id=${employeeId}::uuid and e.business_id=${businessId}::uuid and e.active
            returning id::text,business_id::text as "businessId",customer_id::text as "customerId",service_id::text as "serviceId",
              employee_id::text as "employeeId",starts_at as "startsAt",status,source,0::float8 as "paidAmount"`;
          if(!rows.length)return json({error:"The selected customer, service or team member is unavailable."},400,origin);
          return json({appointment:rows[0] as unknown as Record<string,unknown>},201,origin);
        }
        if(resource==="appointments"&&id&&request.method==="PATCH"){
          const startsAt=value("startsAt"),status=value("status");
          if(!Number.isFinite(Date.parse(startsAt))||!["pending","confirmed"].includes(status))
            return json({error:"Only active appointments can be rescheduled."},400,origin);
          const rows=await sql`update private.appointments a set starts_at=${startsAt}::timestamptz,
            ends_at=${startsAt}::timestamptz+(select make_interval(mins=>s.duration_minutes) from private.services s where s.id=${value("serviceId")}::uuid),
            customer_id=${value("customerId")}::uuid,service_id=${value("serviceId")}::uuid,employee_id=${value("employeeId")}::uuid,updated_at=now()
            where a.id=${id}::uuid and a.business_id=${businessId}::uuid and a.status=${status}
              and exists(select 1 from private.customers c where c.id=${value("customerId")}::uuid and c.business_id=${businessId}::uuid)
              and exists(select 1 from private.services s where s.id=${value("serviceId")}::uuid and s.business_id=${businessId}::uuid and s.active)
              and exists(select 1 from private.employees e where e.id=${value("employeeId")}::uuid and e.business_id=${businessId}::uuid and e.active)
            returning a.id::text,a.business_id::text as "businessId",a.customer_id::text as "customerId",a.service_id::text as "serviceId",a.employee_id::text as "employeeId",a.starts_at as "startsAt",a.status,a.source`;
          if(!rows.length)return json({error:"Appointment could not be updated. Check its details and availability."},409,origin);
          return json({appointment:rows[0] as unknown as Record<string,unknown>},200,origin);
        }
        if(resource==="appointments"&&id&&request.method==="DELETE"){
          const rows=await sql`update private.appointments set status='cancelled',updated_at=now()
            where id=${id}::uuid and business_id=${businessId}::uuid and status in ('pending','confirmed') returning id::text`;
          if(!rows.length)return json({error:"Appointment was not found or is no longer active."},404,origin);
          return json({status:"ok"},200,origin);
        }
        if(resource==="payments"&&request.method==="POST"){
          const amount=numeric("amount"),method=value("method"),appointmentId=value("appointmentId");
          if(!Number.isFinite(amount)||amount<=0||!["cash","card","bank_transfer","other"].includes(method))return json({error:"Enter a valid payment amount and method."},400,origin);
          const rows=await sql`insert into private.payments(business_id,appointment_id,amount,method,paid_at,note)
            select ${businessId}::uuid,a.id,${amount},${method},coalesce(nullif(${value("paidAt")},'')::timestamptz,now()),nullif(${value("note")},'')
            from private.appointments a where a.id=${appointmentId}::uuid and a.business_id=${businessId}::uuid
            returning id::text,business_id::text as "businessId",appointment_id::text as "appointmentId",amount::float8 as amount,method,paid_at as "paidAt",note`;
          if(!rows.length)return json({error:"Appointment was not found for this salon."},404,origin);
          return json({payment:rows[0] as unknown as Record<string,unknown>},201,origin);
        }
        if(resource==="expenses"&&request.method==="POST"){
          const amount=numeric("amount"),category=value("category"),description=value("description"),method=value("paymentMethod"),incurredAt=value("incurredAt");
          if(!Number.isFinite(amount)||amount<=0||!["rent","salary","supplies","utilities","maintenance","marketing","other"].includes(category)||!description||!["cash","card","bank_transfer","other"].includes(method)||!Number.isFinite(Date.parse(incurredAt)))
            return json({error:"Enter valid expense details."},400,origin);
          const rows=await sql`insert into private.expenses(business_id,amount,category,description,incurred_at,payment_method)
            values(${businessId}::uuid,${amount},${category},${description},${incurredAt}::timestamptz,${method})
            returning id::text,business_id::text as "businessId",amount::float8 as amount,category,description,incurred_at as "incurredAt",payment_method as "paymentMethod"`;
          return json({expense:rows[0] as unknown as Record<string,unknown>},201,origin);
        }

        if(resource==="business"&&request.method==="PATCH"){
          const name=value("name"),city=value("city"),address=value("address"),slug=value("slug");
          const currency=value("currency","USD");
          if(!name||!city||!address||!slug||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||!["USD","LBP"].includes(currency))
            return json({error:"Complete the salon name, valid public URL, city, address and currency."},400,origin);
          const workingHours=JSON.stringify(body.workingHours??{});
          const bookingRules=JSON.stringify(body.bookingRules??{});
          const rows=await sql`update private.businesses set name=${name},slug=${slug},category=${value("category","Beauty")},city=${city},
            address=${address},phone=nullif(${value("phone")},''),email=nullif(${value("email")},''),
            website=nullif(${value("website")},''),description=nullif(${value("description")},''),
            currency=${currency},timezone=${value("timezone","Asia/Beirut")},
            marketplace_visible=${body.marketplaceVisible===true},working_hours=${workingHours}::jsonb,
            booking_rules=${bookingRules}::jsonb,calendar_preferences=${JSON.stringify(body.calendarSyncPreferences??{blockExternalBusyTime:true,syncConfirmedAppointments:true,syncPendingAppointments:false,removeCancelledAppointments:true})}::jsonb,updated_at=now()
            where id=${businessId}::uuid
            returning id::text,name,slug,category,city,address,phone,email,website,description,currency,timezone,
              marketplace_visible as "marketplaceVisible",working_hours as "workingHours",booking_rules as "bookingRules",calendar_preferences as "calendarSyncPreferences"`;
          return json({business:rows[0] as unknown as Record<string,unknown>},200,origin);
        }
        if(resource==="appointments"&&id==="status"&&request.method==="PATCH"){
          return json({error:"Use /provider/appointments/{appointmentId}/status."},400,origin);
        }
        if(resource==="appointments"&&id&&path[3]==="status"&&request.method==="PATCH"){
          const next=value("status");
          if(!["pending","confirmed","completed","cancelled"].includes(next))return json({error:"Choose a valid appointment status."},400,origin);
          const rows=await sql`update private.appointments set status=${next},updated_at=now()
            where id=${id}::uuid and business_id=${businessId}::uuid
              and (status='pending' and ${next} in ('confirmed','cancelled')
                or status='confirmed' and ${next} in ('completed','cancelled'))
            returning id::text,status`;
          if(!rows.length)return json({error:"This appointment status cannot be changed."},409,origin);
          if(next==="completed"){
            await sql`insert into private.commission_entries(business_id,appointment_id,employee_id,service_name,base_amount,commission_type,commission_value,amount,earned_at)
              select a.business_id,a.id,e.id,s.name,s.price,coalesce(e.commission_type,'percentage'),e.commission_value,
                case when e.commission_type='fixed' then e.commission_value else s.price*e.commission_value/100 end,now()
              from private.appointments a join private.employees e on e.id=a.employee_id
              join private.services s on s.id=a.service_id
              where a.id=${id}::uuid and a.business_id=${businessId}::uuid and e.commission_value>0
              on conflict(business_id,appointment_id) do nothing`;
          }
          return json({appointment:rows[0] as unknown as Record<string,unknown>},200,origin);
        }
        if(resource==="client-requests"&&request.method==="POST"){
          const appointmentId=value("appointmentId"),customerId=value("customerId"),kind=value("kind");
          const requested=value("requestedStartsAt");
          if(!["cancellation","reschedule"].includes(kind))return json({error:"Choose a valid request type."},400,origin);
          if(kind==="reschedule"&&!Number.isFinite(Date.parse(requested)))return json({error:"Choose a valid requested date and time."},400,origin);
          const rows=await sql`insert into private.client_appointment_requests(business_id,appointment_id,customer_id,kind,requested_starts_at)
            select ${businessId}::uuid,a.id,c.id,${kind},nullif(${requested},'')::timestamptz
            from private.appointments a join private.customers c on c.id=a.customer_id and c.business_id=a.business_id
            where a.id=${appointmentId}::uuid and a.business_id=${businessId}::uuid
              and c.id=${customerId}::uuid and a.status in ('pending','confirmed')
            returning id::text,business_id::text as "businessId",appointment_id::text as "appointmentId",
              customer_id::text as "customerId",kind,status,requested_starts_at as "requestedStartsAt",created_at as "createdAt"`;
          if(!rows.length)return json({error:"The appointment could not be found for this customer."},404,origin);
          return json({request:rows[0] as unknown as Record<string,unknown>},201,origin);
        }
        if(resource==="client-requests"&&id&&request.method==="PATCH"){
          const next=value("status");
          if(!["approved","declined"].includes(next))return json({error:"Choose approve or decline."},400,origin);
          const rows=await sql`update private.client_appointment_requests set status=${next},reviewed_at=now()
            where id=${id}::uuid and business_id=${businessId}::uuid and status='pending'
            returning id::text,status,kind,appointment_id::text as "appointmentId",requested_starts_at as "requestedStartsAt"`;
          if(!rows.length)return json({error:"This client request was already reviewed or could not be found."},409,origin);
          if(next==="approved"&&rows[0].kind==="cancellation"){
            await sql`update private.appointments set status='cancelled',updated_at=now()
              where id=${String(rows[0].appointmentId)}::uuid and business_id=${businessId}::uuid and status in ('pending','confirmed')`;
          }
          if(next==="approved"&&rows[0].kind==="reschedule"&&rows[0].requestedStartsAt){
            const changed=await sql`update private.appointments a set starts_at=${rows[0].requestedStartsAt}::timestamptz,
              ends_at=${rows[0].requestedStartsAt}::timestamptz+(select make_interval(mins=>s.duration_minutes) from private.services s where s.id=a.service_id),
              updated_at=now() where a.id=${String(rows[0].appointmentId)}::uuid and a.business_id=${businessId}::uuid
                and a.status in ('pending','confirmed') returning a.id`;
            if(!changed.length)return json({error:"The requested time is no longer available."},409,origin);
          }
          return json({request:rows[0] as unknown as Record<string,unknown>},200,origin);
        }

        if(resource==="customer-consent"&&request.method==="POST"){
          const customerId=value("customerId"),action=value("action"),channel=value("channel"),source=value("source");
          const capturedAt=value("capturedAt",new Date().toISOString()),note=value("note");
          if(!["granted","revoked"].includes(action)||!["whatsapp","email","sms","all"].includes(channel)||
            !["in_person","whatsapp","email","phone","website","other"].includes(source)||
            (action==="granted"&&body.customerConfirmed!==true)||(action==="granted"&&source==="other"&&!note))
            return json({error:"Confirm customer consent and provide valid channel, source and date."},400,origin);
          const rows=await sql`insert into private.customer_consent_events(business_id,customer_id,action,channel,source,note,captured_at,customer_confirmed)
            select ${businessId}::uuid,c.id,${action},${channel},${source},nullif(${note},''),${capturedAt}::timestamptz,${body.customerConfirmed===true}
            from private.customers c where c.id=${customerId}::uuid and c.business_id=${businessId}::uuid
            returning id::text,business_id::text as "businessId",customer_id::text as "customerId",action,channel,source,note,captured_at as "capturedAt",customer_confirmed as "customerConfirmed"`;
          if(!rows.length)return json({error:"Customer was not found."},404,origin);
          await sql`update private.customers set marketing_opt_in=${action==="granted"},marketing_opt_in_updated_at=${capturedAt}::timestamptz,updated_at=now()
            where id=${customerId}::uuid and business_id=${businessId}::uuid
              and (marketing_opt_in_updated_at is null or marketing_opt_in_updated_at<=${capturedAt}::timestamptz)`;
          return json({event:rows[0] as unknown as Record<string,unknown>},201,origin);
        }
        if(resource==="customer-reminders"&&request.method==="POST"){
          const customerId=value("customerId"),dueAt=value("dueAt"),note=value("note");
          if(!Number.isFinite(Date.parse(dueAt))||!note)return json({error:"Choose a reminder date and add a note."},400,origin);
          const rows=await sql`insert into private.customer_reminders(business_id,customer_id,due_at,note)
            select ${businessId}::uuid,c.id,${dueAt}::timestamptz,${note} from private.customers c
            where c.id=${customerId}::uuid and c.business_id=${businessId}::uuid
            returning id::text,business_id::text as "businessId",customer_id::text as "customerId",due_at as "dueAt",note,status,created_at as "createdAt"`;
          if(!rows.length)return json({error:"Customer was not found."},404,origin);
          return json({reminder:rows[0] as unknown as Record<string,unknown>},201,origin);
        }
        if(resource==="customer-reminders"&&id&&request.method==="PATCH"){
          const status=value("status");
          if(!["pending","completed","cancelled"].includes(status))return json({error:"Choose a valid reminder status."},400,origin);
          const rows=await sql`update private.customer_reminders set status=${status}
            where id=${id}::uuid and business_id=${businessId}::uuid returning id::text,status`;
          if(!rows.length)return json({error:"Reminder was not found."},404,origin);
          return json({reminder:rows[0] as unknown as Record<string,unknown>},200,origin);
        }
        if(resource==="payroll"&&request.method==="POST"){
          const employeeId=value("employeeId"),amount=numeric("amount"),method=value("method");
          if(!Number.isFinite(amount)||amount<=0||!["cash","card","bank_transfer","other"].includes(method))return json({error:"Enter a valid payroll payment."},400,origin);
          const rows=await sql`with balances as (
              select coalesce((select sum(amount) from private.commission_entries where business_id=${businessId}::uuid and employee_id=${employeeId}::uuid),0) as earned,
                     coalesce((select sum(amount) from private.payroll_payments where business_id=${businessId}::uuid and employee_id=${employeeId}::uuid),0) as paid
            )
            insert into private.payroll_payments(business_id,employee_id,amount,method,paid_at,note)
            select ${businessId}::uuid,e.id,${amount},${method},coalesce(nullif(${value("paidAt")},'')::timestamptz,now()),nullif(${value("note")},'')
            from private.employees e cross join balances b
            where e.id=${employeeId}::uuid and e.business_id=${businessId}::uuid and ${amount}<=b.earned-b.paid+0.0001
            returning id::text,business_id::text as "businessId",employee_id::text as "employeeId",amount::float8 as amount,method,paid_at as "paidAt",note`;
          if(!rows.length)return json({error:"Employee was not found or payment exceeds unpaid commission."},409,origin);
          return json({payrollPayment:rows[0] as unknown as Record<string,unknown>},201,origin);
        }
        return json({error:"Unsupported workspace operation."},404,origin);
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (message.includes("appointments_employee_no_overlap") || message.includes("exclusion")) return json({error:"This team member already has an appointment at that time."},409,origin);
        return json({error:"The change could not be saved. Please verify the details and try again."},400,origin);
      }
    }

    return json({ error: "Not found" }, 404, origin);
  },
} satisfies WorkerHandler<Env>;
