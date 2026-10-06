import { notFound } from "next/navigation";
import { testIntegrationAction } from "@/actions/integrations";
import IntegrationForm from "@/components/admin/IntegrationForm";
import StateBadge from "@/components/admin/StateBadge";
import SubmitButton from "@/components/admin/SubmitButton";
import Link from "@/components/site/ui/Link";
import { requireAdmin } from "@/lib/server/auth";
import { getIntegration, recentEvents } from "@/lib/server/integrations";

export const dynamic = "force-dynamic";

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC";

export default async function IntegrationPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireAdmin();
  const i = await getIntegration((await params).slug);
  if (!i) notFound();
  const events = i.server ? await recentEvents(i.slug) : [];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{i.label} <StateBadge state={i.state} /></h1>
          <p className="admin-sub">{i.summary}</p>
        </div>
        <Link href="/admin/integrations">All integrations</Link>
      </div>

      <section className="form-card int-status" aria-labelledby="int-status" data-state={i.state}>
        <h2 id="int-status">Status</h2>
        {i.state === "connected" && <p>Switched on and working.</p>}
        {i.state === "disconnected" && <p>Switched off. {i.effect}</p>}
        {(i.state === "configuration_required" || i.state === "error") && (
          <>
            <p>{i.state === "error" ? "The last run failed:" : "Switched on, but it cannot run yet:"}</p>
            <ul className="reasons">{i.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
          </>
        )}
        <dl className="facts">
          <div><dt>What it does</dt><dd>{i.effect}</dd></div>
          {i.server && <div><dt>Last success</dt><dd>{i.lastSuccessAt ? <time dateTime={i.lastSuccessAt}>{when(i.lastSuccessAt)}</time> : "Not yet"}</dd></div>}
          {i.server && i.lastError && <div><dt>Last error</dt><dd>{i.lastError}{i.lastCheckedAt ? <><br /><small>{when(i.lastCheckedAt)}</small></> : null}</dd></div>}
        </dl>
      </section>

      <IntegrationForm slug={i.slug} label={i.label} fields={i.fields} enabled={i.enabled} config={i.config} />

      {i.secrets.length > 0 && (
        <section className="form-card" aria-labelledby="int-secrets">
          <h2 id="int-secrets">Cloudflare secrets</h2>
          <p className="hint">Keys, tokens and addresses that act as keys are <b>never</b> stored in the database or shown here: this table only says whether each one is set. To set or change one, run the command in a terminal (you will be asked for the value), then reload this page. For local development use <code>.dev.vars</code>.</p>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th scope="col">Secret</th><th scope="col">Used for</th><th scope="col">Status</th><th scope="col">Command</th></tr></thead>
              <tbody>
                {i.secrets.map((s) => (
                  <tr key={s.name}>
                    <td><code>{s.name}</code><br /><small>{s.required ? "required" : "optional"}</small></td>
                    <td>{s.purpose}</td>
                    <td><span className={s.set && !s.problem ? "badge published" : s.set ? "badge n-failed" : "badge draft"}>{s.set ? (s.problem ? "set, not usable" : "set") : "not set"}</span>{s.problem && <><br /><small>{s.problem}</small></>}</td>
                    <td><code>{s.command}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="form-card" aria-labelledby="int-test">
        <h2 id="int-test">Test</h2>
        <p className="hint">{i.testLabel}. The server runs it (nothing happens in your browser) and the result is added to the activity below. Save your changes first.</p>
        <form action={testIntegrationAction}>
          <input type="hidden" name="slug" value={i.slug} />
          <SubmitButton>{i.testLabel}</SubmitButton>
        </form>
      </section>

      {i.server && (
        <section className="form-card" aria-labelledby="int-activity">
          <h2 id="int-activity">Activity</h2>
          <p className="hint">The latest runs, kept for 30 days. Reasons are short and never contain keys, addresses or visitor details.</p>
          {events.length === 0 ? (
            <div className="empty-state"><b>Nothing yet</b><p>Runs appear here after the first enquiry or test.</p></div>
          ) : (
            <div className="table-wrap">
              <table className="data int-events">
                <thead><tr><th scope="col">When</th><th scope="col">Event</th><th scope="col">Result</th><th scope="col">Detail</th></tr></thead>
                <tbody>
                  {events.map((e) => (
                    <tr key={e.id}>
                      <td><time dateTime={e.createdAt}>{when(e.createdAt)}</time></td>
                      <td><code>{e.event}</code></td>
                      <td><span className={e.status === "ok" ? "badge published" : "badge n-failed"}>{e.status === "ok" ? "OK" : "Failed"}</span></td>
                      <td>{e.error ?? (e.httpStatus ? `HTTP ${e.httpStatus}` : "")}{e.durationMs != null && <small> · {e.durationMs} ms</small>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </>
  );
}
