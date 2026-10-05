/**
 * Minimal stand-in for Supabase Auth's password sign-in, for local testing
 * without a Supabase project:
 *
 *   node tests/e2e/mock-supabase-auth.mjs            # listens on :54399
 *   SUPABASE_URL=http://127.0.0.1:54399 SUPABASE_ANON_KEY=mock-anon-key npm run dev
 *
 * One user: MOCK_ADMIN_EMAIL / MOCK_ADMIN_PASSWORD (defaults below).
 * Implements POST /auth/v1/token?grant_type=password and POST /auth/v1/logout,
 * plus GET /__stats (call counts) for tests.
 */
import { randomUUID } from "node:crypto";
import http from "node:http";

const PORT = Number(process.env.MOCK_AUTH_PORT ?? 54399);
const EMAIL = (process.env.MOCK_ADMIN_EMAIL ?? "admin@example.com").toLowerCase();
const PASSWORD = process.env.MOCK_ADMIN_PASSWORD ?? "Tuwaiq-Admin-2026";
const KEY = process.env.MOCK_AUTH_KEY ?? "mock-anon-key";
const USER_ID = "7a1f3c2e-4b5d-4e6f-8a9b-0c1d2e3f4a5b";
const stats = { token: 0, success: 0, failed: 0, logout: 0 };

const send = (res, status, body) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(body === undefined ? "" : JSON.stringify(body));
};

http
  .createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (req.method === "GET" && url.pathname === "/__stats") return send(res, 200, stats);
    if (req.headers.apikey !== KEY) return send(res, 401, { message: "Invalid API key" });
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      if (req.method === "POST" && url.pathname === "/auth/v1/token" && url.searchParams.get("grant_type") === "password") {
        stats.token++;
        let body = {};
        try {
          body = JSON.parse(raw || "{}");
        } catch {
          return send(res, 400, { error: "invalid_request" });
        }
        if (String(body.email ?? "").toLowerCase() === EMAIL && body.password === PASSWORD) {
          stats.success++;
          return send(res, 200, {
            access_token: `mock-${randomUUID()}`,
            token_type: "bearer",
            expires_in: 3600,
            refresh_token: randomUUID(),
            user: { id: USER_ID, email: EMAIL, aud: "authenticated", role: "authenticated" },
          });
        }
        stats.failed++;
        return send(res, 400, { error: "invalid_grant", error_description: "Invalid login credentials" });
      }
      if (req.method === "POST" && url.pathname === "/auth/v1/logout") {
        stats.logout++;
        return send(res, 204);
      }
      send(res, 404, { message: "not found" });
    });
  })
  .listen(PORT, "127.0.0.1", () => console.log(`Mock Supabase Auth on http://127.0.0.1:${PORT} (user ${EMAIL})`));
