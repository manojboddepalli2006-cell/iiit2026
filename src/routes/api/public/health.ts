import { createFileRoute } from "@tanstack/react-router";

// Public health check: reports app and database reachability only; never returns data or config.
export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async () => {
        const t0 = Date.now();
        let database: "ok" | "error" = "error";
        try {
          const url = process.env["SUPABASE_URL"];
          const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
          if (url && key) {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), 5000);
            const res = await fetch(`${url}/rest/v1/portfolios?select=id&limit=1`, { headers: { apikey: key }, signal: ctrl.signal });
            clearTimeout(timer);
            database = res.ok ? "ok" : "error";
          }
        } catch { database = "error"; }
        const body = { status: database === "ok" ? "ok" : "degraded", app: "ok", database, quantumSimulator: "in-browser (client-side)", latencyMs: Date.now() - t0, time: new Date().toISOString() };
        return new Response(JSON.stringify(body), { status: database === "ok" ? 200 : 503, headers: { "content-type": "application/json", "cache-control": "no-store" } });
      },
    },
  },
});
