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
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: fromHex(saltHex), iterations: PASSWORD_ITERATIONS, hash: "SHA-256" },
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

async function createSession(sql: ReturnType<typeof neon>, userId: string) {
  const token = randomHex(32);
  const tokenHash = await sha256Hex(token);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000).toISOString();
  await sql`insert into private.auth_sessions (user_id, token_hash, expires_at)
    values (${userId}::uuid, decode(${tokenHash}, 'hex'), ${expiresAt}::timestamptz)`;
  return { token, expiresAt };
}

async function authenticate(request: Request, sql: ReturnType<typeof neon>) {
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
    limit 1`;
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
        return json({ service: "salon-reservation-api", status: "ok", database: "connected" }, 200, origin);
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

      const userId = crypto.randomUUID();
      const businessId = crypto.randomUUID();
      const membershipId = crypto.randomUUID();
      const salt = randomHex(16);
      const passwordHash = `pbkdf2-sha256$${PASSWORD_ITERATIONS}$${salt}$${await derivePassword(password, salt)}`;
      const slugBase = makeSlug(businessName);
      const slug = `${slugBase}-${randomHex(3)}`;
      try {
        const rows = await sql`
          with new_user as (
            insert into private.app_users (id, email, display_name, password_hash)
            values (${userId}::uuid, ${email}, ${displayName}, ${passwordHash})
            returning id
          ), new_business as (
            insert into private.businesses (id, name, slug, city, timezone)
            values (${businessId}::uuid, ${businessName}, ${slug}, ${city}, 'Asia/Beirut')
            returning id, name, slug
          ), new_membership as (
            insert into private.business_memberships (id, business_id, user_id, role)
            select ${membershipId}::uuid, b.id, u.id, 'owner'
            from new_user u cross join new_business b
            returning user_id, business_id, role
          )
          select u.id as user_id, b.id as business_id, b.name as business_name, b.slug as business_slug, m.role
          from new_user u cross join new_business b cross join new_membership m`;
        const session = await createSession(sql, userId);
        return json({ user: { id: rows[0].user_id, displayName, email },
          business: { id: rows[0].business_id, name: rows[0].business_name, slug: rows[0].business_slug },
          role: rows[0].role, ...session }, 201, origin);
      } catch {
        return json({ error: "An account with this email may already exist, or the account could not be created." }, 409, origin);
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

    return json({ error: "Not found" }, 404, origin);
  },
} satisfies WorkerHandler<Env>;
