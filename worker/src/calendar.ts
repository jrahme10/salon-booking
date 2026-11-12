type Sql = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<any[]>;

interface CalendarEnv {
  GOOGLE_CALENDAR_CLIENT_ID?: string;
  GOOGLE_CALENDAR_CLIENT_SECRET?: string;
  CALENDAR_ENCRYPTION_KEY?: string;
}

const APP_URL = "https://jrahme10.github.io/salon-booking/";
const encoder = new TextEncoder();

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function unhex(value: string): Uint8Array {
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index++) bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  return bytes;
}

async function digest(value: string): Promise<string> {
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))));
}

function randomState(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function encryptSecret(env: CalendarEnv, value: unknown): Promise<string> {
  if (!env.CALENDAR_ENCRYPTION_KEY) throw new Error("CALENDAR_ENCRYPTION_NOT_CONFIGURED");
  const raw = Uint8Array.from(atob(env.CALENDAR_ENCRYPTION_KEY), (char) => char.charCodeAt(0));
  if (raw.length !== 32) throw new Error("CALENDAR_ENCRYPTION_KEY_INVALID");
  const key = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(JSON.stringify(value)));
  return hex(new Uint8Array([...iv, ...new Uint8Array(encrypted)]));
}

function redirect(location: string): Response {
  return new Response(null, { status: 302, headers: { Location: location, "Cache-Control": "no-store" } });
}

function basicAuth(username: string, password: string): string {
  return "Basic " + btoa(username + ":" + password);
}

function xmlPropertyHref(xml: string, property: string): string | null {
  const propertyMatch = new RegExp(
    `<([\\w.-]+:)?${property}\\b[^>]*>([\\s\\S]*?)<\\/\\1${property}\\s*>`,
    "i",
  ).exec(xml);
  if (!propertyMatch) return null;
  const hrefMatch = /<(?:[\\w.-]+:)?href\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?href\\s*>/i.exec(propertyMatch[2]);
  if (!hrefMatch) return null;
  return hrefMatch[1].trim().replace(/&amp;/g, "&").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

function validateICloudUrl(value: string, base: string): URL {
  const target = new URL(value, base);
  if (target.protocol !== "https:" ||
      !(target.hostname === "icloud.com" || target.hostname.endsWith(".icloud.com"))) {
    throw new Error("APPLE_DISCOVERY_INVALID_URL");
  }
  return target;
}

async function appleCalDavRequest(
  startUrl: URL,
  appleId: string,
  appPassword: string,
  body: string,
): Promise<{ response: Response; url: URL }> {
  let current = startUrl;
  for (let attempt = 0; attempt < 6; attempt++) {
    const response = await fetch(current.toString(), {
      method: "PROPFIND",
      headers: {
        Authorization: basicAuth(appleId, appPassword),
        Depth: "0",
        "Content-Type": "application/xml; charset=utf-8",
      },
      body,
      redirect: "manual",
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("Location");
      if (!location) throw new Error("APPLE_DISCOVERY_REDIRECT_INVALID");
      current = validateICloudUrl(location, current.toString());
      continue;
    }
    return { response, url: current };
  }
  throw new Error("APPLE_DISCOVERY_TOO_MANY_REDIRECTS");
}

async function discoverAppleCalendar(
  appleId: string,
  appPassword: string,
): Promise<{ principalUrl: string; calendarHomeUrl: string }> {
  const principalRequest = await appleCalDavRequest(
    new URL("https://caldav.icloud.com/"),
    appleId,
    appPassword,
    '<?xml version="1.0" encoding="utf-8"?><d:propfind xmlns:d="DAV:"><d:prop><d:current-user-principal/></d:prop></d:propfind>',
  );
  if (principalRequest.response.status === 401 || principalRequest.response.status === 403) {
    throw new Error("APPLE_AUTH_FAILED");
  }
  if (!principalRequest.response.ok) throw new Error("APPLE_PRINCIPAL_DISCOVERY_FAILED");
  const principalXml = await principalRequest.response.text();
  const principalHref = xmlPropertyHref(principalXml, "current-user-principal");
  if (!principalHref) throw new Error("APPLE_PRINCIPAL_NOT_FOUND");
  const principalUrl = validateICloudUrl(principalHref, principalRequest.url.toString());

  const homeRequest = await appleCalDavRequest(
    principalUrl,
    appleId,
    appPassword,
    '<?xml version="1.0" encoding="utf-8"?><d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><c:calendar-home-set/></d:prop></d:propfind>',
  );
  if (homeRequest.response.status === 401 || homeRequest.response.status === 403) {
    throw new Error("APPLE_AUTH_FAILED");
  }
  if (!homeRequest.response.ok) throw new Error("APPLE_CALENDAR_DISCOVERY_FAILED");
  const homeXml = await homeRequest.response.text();
  const homeHref = xmlPropertyHref(homeXml, "calendar-home-set");
  if (!homeHref) throw new Error("APPLE_CALENDAR_HOME_NOT_FOUND");
  const calendarHomeUrl = validateICloudUrl(homeHref, homeRequest.url.toString());
  return { principalUrl: principalUrl.toString(), calendarHomeUrl: calendarHomeUrl.toString() };
}

export async function handleCalendarRequest(
  request: Request,
  url: URL,
  sql: Sql,
  env: CalendarEnv,
  origin: string | null,
  user?: Record<string, unknown> | null,
): Promise<Response | null> {
  const path = url.pathname;

  if (request.method === "GET" && path === "/calendar/google/callback") {
    const state = url.searchParams.get("state") ?? "";
    const code = url.searchParams.get("code") ?? "";
    if (!state || !code || !env.GOOGLE_CALENDAR_CLIENT_ID || !env.GOOGLE_CALENDAR_CLIENT_SECRET || !env.CALENDAR_ENCRYPTION_KEY) {
      return redirect(APP_URL + "?calendar=google_setup_required");
    }
    try {
      const stateHash = await digest(state);
      const rows = await sql`update private.calendar_oauth_states set consumed_at=now()
        where state_hash=decode(${stateHash},'hex') and consumed_at is null and expires_at>now()
        returning business_id::text as business_id,user_id::text as user_id,employee_user_id::text as employee_user_id`;
      if (!rows.length) return redirect(APP_URL + "?calendar=google_link_expired");
      const redirectUri = new URL("/calendar/google/callback", url.origin).toString();
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code, client_id: env.GOOGLE_CALENDAR_CLIENT_ID, client_secret: env.GOOGLE_CALENDAR_CLIENT_SECRET,
          redirect_uri: redirectUri, grant_type: "authorization_code",
        }),
      });
      const tokens = await tokenResponse.json() as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string };
      if (!tokenResponse.ok || !tokens.refresh_token) return redirect(APP_URL + "?calendar=google_token_failed");
      const profileResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: "Bearer " + tokens.access_token },
      });
      const profile = profileResponse.ok ? await profileResponse.json() as { email?: string } : {};
      const connectionId = crypto.randomUUID();
      const encrypted = await encryptSecret(env, { provider: "google", refreshToken: tokens.refresh_token, accessToken: tokens.access_token,
        accessTokenExpiresAt: Date.now() + (tokens.expires_in ?? 3600) * 1000 });
      await sql`insert into private.calendar_connections(id,business_id,employee_user_id,provider,account_label,status,created_by,connected_at)
        values(${connectionId}::uuid,${String(rows[0].business_id)}::uuid,${String(rows[0].user_id)}::uuid,'google',
          ${profile.email ?? null},'connected',${String(rows[0].user_id)}::uuid,now())`;
      await sql`insert into private.calendar_connection_secrets(connection_id,encrypted_secret,encryption_key_version)
        values(${connectionId}::uuid,decode(${encrypted},'hex'),'v1')`;
      await sql`insert into private.calendar_sync_jobs(connection_id,operation,idempotency_key)
        values(${connectionId}::uuid,'initial_sync',${"initial:" + connectionId})`;
      return redirect(APP_URL + "?calendar=google_connected");
    } catch {
      return redirect(APP_URL + "?calendar=google_connection_failed");
    }
  }

  if (!path.startsWith("/provider/calendar/")) return null;
  if (!user) return new Response(JSON.stringify({ error: "Authentication required." }), { status: 401, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  const businessId = String(user.business_id);
  const userId = String(user.user_id);
  const role = String(user.role);
  const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store",
      ...(origin === "https://jrahme10.github.io" || origin === "http://localhost:5173" ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {}) },
  });

  if (request.method === "GET" && path === "/provider/calendar/connections") {
    const rows = await sql`select id::text,provider,account_label as "accountLabel",status,connected_at as "connectedAt",
      last_sync_at as "lastSyncAt",last_error_code as "lastErrorCode"
      from private.calendar_connections where business_id=${businessId}::uuid
        and employee_user_id=${userId}::uuid
      order by provider,created_at desc`;
    return json({ connections: rows });
  }

  if (request.method === "POST" && path === "/provider/calendar/google/start") {
    if (!env.GOOGLE_CALENDAR_CLIENT_ID || !env.GOOGLE_CALENDAR_CLIENT_SECRET || !env.CALENDAR_ENCRYPTION_KEY) {
      return json({ error: "Google Calendar connection is not configured on the server yet." }, 503);
    }
    const state = randomState();
    const stateHash = await digest(state);
    await sql`insert into private.calendar_oauth_states(state_hash,business_id,user_id,provider,expires_at)
      values(decode(${stateHash},'hex'),${businessId}::uuid,${userId}::uuid,'google',now()+interval '10 minutes')`;
    const redirectUri = new URL("/calendar/google/callback", url.origin).toString();
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.search = new URLSearchParams({
      client_id: env.GOOGLE_CALENDAR_CLIENT_ID, redirect_uri: redirectUri, response_type: "code",
      scope: "openid email https://www.googleapis.com/auth/calendar",
      access_type: "offline", prompt: "consent", state,
    }).toString();
    return json({ authorizationUrl: authUrl.toString() });
  }

  if (request.method === "POST" && path === "/provider/calendar/apple") {
    if (!env.CALENDAR_ENCRYPTION_KEY) return json({ error: "Calendar encryption is not configured on the server yet." }, 503);
    let body: { appleId?: string; appSpecificPassword?: string } = {};
    try { body = await request.json() as typeof body; } catch { return json({ error: "Enter your Apple Account email and app-specific password." }, 400); }
    const appleId = (body.appleId ?? "").trim().toLowerCase();
    const appPassword = (body.appSpecificPassword ?? "").replace(/\s/g, "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(appleId) || !/^[a-zA-Z0-9-]{16,32}$/.test(appPassword)) {
      return json({ error: "Enter a valid Apple Account email and 16-character app-specific password." }, 400);
    }
    try {
      const discovery = await discoverAppleCalendar(appleId, appPassword);
      const connectionId = crypto.randomUUID();
      const encrypted = await encryptSecret(env, {
        provider: "apple",
        appleId,
        appSpecificPassword: appPassword,
        principalUrl: discovery.principalUrl,
        calendarHomeUrl: discovery.calendarHomeUrl,
      });
      await sql`insert into private.calendar_connections(id,business_id,employee_user_id,provider,account_label,status,created_by,connected_at)
        values(${connectionId}::uuid,${businessId}::uuid,${userId}::uuid,'apple',${appleId},'connected',${userId}::uuid,now())`;
      await sql`insert into private.calendar_connection_secrets(connection_id,encrypted_secret,encryption_key_version)
        values(${connectionId}::uuid,decode(${encrypted},'hex'),'v1')`;
      await sql`insert into private.calendar_sync_jobs(connection_id,operation,idempotency_key)
        values(${connectionId}::uuid,'initial_sync',${"initial:" + connectionId})`;
      return json({ connection: { id: connectionId, provider: "apple", accountLabel: appleId, status: "connected" } }, 201);
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      const messages: Record<string, string> = {
        APPLE_AUTH_FAILED: "Apple rejected these credentials. Confirm iCloud Calendar is enabled and use a newly generated app-specific password, not your normal Apple Account password.",
        APPLE_PRINCIPAL_NOT_FOUND: "Apple accepted the login but did not return a calendar account. Make sure iCloud Calendar is enabled for this Apple Account.",
        APPLE_CALENDAR_HOME_NOT_FOUND: "Apple accepted the login but did not return a calendar collection. Check that iCloud Calendar is enabled.",
        APPLE_DISCOVERY_INVALID_URL: "Apple returned an unsupported calendar server address. Please try again later.",
        APPLE_DISCOVERY_REDIRECT_INVALID: "Apple's calendar server returned an invalid redirect. Please try again.",
        APPLE_DISCOVERY_TOO_MANY_REDIRECTS: "Apple's calendar server redirected too many times. Please try again.",
        APPLE_PRINCIPAL_DISCOVERY_FAILED: "Could not discover your Apple Calendar account. Please try again.",
        APPLE_CALENDAR_DISCOVERY_FAILED: "Could not discover your iCloud calendars. Please try again.",
      };
      return json({ error: messages[code] ?? "Apple Calendar could not be connected. Check the account details and try again." }, 502);
    }
  }

  const deleteMatch = /^\/provider\/calendar\/connections\/([0-9a-f-]{36})$/.exec(path);
  if (request.method === "DELETE" && deleteMatch) {
    const rows = await sql`delete from private.calendar_connections
      where id=${deleteMatch[1]}::uuid and business_id=${businessId}::uuid
        and (employee_user_id=${userId}::uuid)
      returning id::text`;
    if (!rows.length) return json({ error: "Calendar connection was not found." }, 404);
    return json({ status: "disconnected" });
  }
  return json({ error: "Unsupported calendar operation." }, 404);
}
