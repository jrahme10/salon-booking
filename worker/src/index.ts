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

function corsHeaders(origin: string | null): Headers {
  const headers = new Headers({
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  });

  if (origin && allowedOrigins.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
  }

  return headers;
}

function json(
  body: Record<string, unknown>,
  status: number,
  origin: string | null,
): Response {
  const headers = corsHeaders(origin);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(body), { status, headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("Origin");
    const headers = corsHeaders(origin);

    if (request.method === "OPTIONS") {
      if (origin && !allowedOrigins.has(origin)) {
        return new Response(null, { status: 403, headers });
      }
      return new Response(null, { status: 204, headers });
    }

    const url = new URL(request.url);

    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
      return json(
        {
          service: "salon-reservation-api",
          status: "ok",
          database: "not_checked",
        },
        200,
        origin,
      );
    }

    if (request.method === "GET" && url.pathname === "/health/db") {
      if (!env.DATABASE_URL) {
        return json({ status: "error", code: "DATABASE_NOT_CONFIGURED" }, 503, origin);
      }

      try {
        const sql = neon(env.DATABASE_URL);
        await sql`select 1 as healthy`;
        return json(
          {
            service: "salon-reservation-api",
            status: "ok",
            database: "connected",
          },
          200,
          origin,
        );
      } catch {
        // Never return database errors: they may contain connection details.
        return json({ status: "error", code: "DATABASE_CONNECTION_FAILED" }, 503, origin);
      }
    }

    return json({ error: "Not found" }, 404, origin);
  },
} satisfies WorkerHandler<Env>;
