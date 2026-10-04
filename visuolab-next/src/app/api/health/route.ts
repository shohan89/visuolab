import { env } from "cloudflare:workers";

export const dynamic = "force-dynamic";

// Infrastructure check only: confirms the Worker, D1 and R2 bindings are reachable.
export async function GET() {
  const checks: Record<string, "ok" | "error"> = {};
  try {
    await env.DB.prepare("SELECT 1").first();
    checks.d1 = "ok";
  } catch {
    checks.d1 = "error";
  }
  try {
    await env.MEDIA.list({ limit: 1 });
    checks.r2 = "ok";
  } catch {
    checks.r2 = "error";
  }
  const ok = Object.values(checks).every((v) => v === "ok");
  return Response.json({ status: ok ? "ok" : "degraded", checks }, { status: ok ? 200 : 503 });
}
