import StateBadge from "@/components/admin/StateBadge";
import Link from "@/components/site/ui/Link";
import { KIND_LABEL, STATE_LABEL, type ConnectionState, type IntegrationKind } from "@/lib/integrations/core";
import { requireAdmin } from "@/lib/server/auth";
import { listIntegrations } from "@/lib/server/integrations";

export const dynamic = "force-dynamic";

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC";
const ORDER: ConnectionState[] = ["connected", "configuration_required", "error", "disconnected"];
const KINDS: IntegrationKind[] = ["analytics", "email", "antispam", "outbound"];

export default async function IntegrationsPage() {
  await requireAdmin();
  const all = await listIntegrations();
  const counts = Object.fromEntries(ORDER.map((s) => [s, all.filter((i) => i.state === s).length])) as Record<ConnectionState, number>;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Integrations</h1>
          <p className="admin-sub">Everything the website connects to. Settings are stored with the site; keys, tokens and webhook addresses are Cloudflare secrets and are never shown or stored here.</p>
        </div>
      </div>

      <section className="stats" aria-label="Integration states">
        {ORDER.map((s) => (
          <div className={(s === "error" || s === "configuration_required") && counts[s] > 0 ? "stat is-hot" : "stat"} key={s} data-state-count={s}>
            <b>{counts[s]}</b>
            <span>{STATE_LABEL[s]}</span>
          </div>
        ))}
      </section>

      {KINDS.map((k) => {
        const rows = all.filter((i) => i.kind === k);
        return (
          <section key={k} className="int-group" aria-labelledby={`int-${k}`}>
            <h2 id={`int-${k}`}>{KIND_LABEL[k]}</h2>
            <div className="table-wrap">
              <table className="data int-table">
                <thead><tr><th scope="col">Integration</th><th scope="col">Status</th><th scope="col">Details</th><th scope="col">Last success</th></tr></thead>
                <tbody>
                  {rows.map((i) => (
                    <tr key={i.slug} data-integration={i.slug}>
                      <td><Link href={`/admin/integrations/${i.slug}`}><b>{i.label}</b></Link><br /><small>{i.summary}</small></td>
                      <td><StateBadge state={i.state} /></td>
                      <td>{i.state === "connected" ? <small>Working.</small> : <ul className="reasons">{i.reasons.map((r) => <li key={r}>{r}</li>)}</ul>}</td>
                      <td>{i.lastSuccessAt ? <time dateTime={i.lastSuccessAt}>{when(i.lastSuccessAt)}</time> : <small>{i.server ? "Not yet" : "—"}</small>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </>
  );
}
