/**
 * TCP proxy that adds a one-way delay in each direction (round trip = 2 × DELAY ms)
 * in front of a local Postgres, to reproduce a remote database (Supabase in
 * another region) when profiling locally:
 *
 *   DELAY=75 node tests/perf/latency-proxy.mjs        # :6432 → 127.0.0.1:5432, 150 ms RTT
 *   DATABASE_URL="postgresql://…@127.0.0.1:6432/…?sslmode=require" npm run dev
 *
 * GET http://127.0.0.1:6433 returns connection / write counters (/reset clears them).
 */
import net from "node:net";
import http from "node:http";
const DELAY = Number(process.env.DELAY ?? 40), PORT = Number(process.env.PORT ?? 6432);
const stats = { connections: 0, clientWrites: 0 };
net.createServer((c) => {
  stats.connections++;
  const s = net.connect(Number(process.env.PG_PORT ?? 5432), "127.0.0.1");
  const pipe = (from, to, count) => from.on("data", (d) => { if (count) stats.clientWrites++; setTimeout(() => to.write(d), DELAY); });
  pipe(c, s, true); pipe(s, c, false);
  const end = () => { c.destroy(); s.destroy(); };
  c.on("error", end); s.on("error", end); c.on("close", end); s.on("close", end);
}).listen(PORT, "127.0.0.1", () => console.log(`latency proxy :${PORT} → :5432, one-way ${DELAY}ms`));
http.createServer((req, res) => {
  if (req.url === "/reset") { stats.connections = 0; stats.clientWrites = 0; }
  res.end(JSON.stringify(stats));
}).listen(PORT + 1, "127.0.0.1");
