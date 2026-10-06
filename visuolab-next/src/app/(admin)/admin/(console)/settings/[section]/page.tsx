import { notFound } from "next/navigation";
import { sendTestEmail } from "@/actions/settings";
import { AnalyticsForm, ContactSettingsForm, EmailForm, GeneralForm, SeoForm, SocialForm, TurnstileForm } from "@/components/admin/SettingsForms";
import SettingsSubnav, { SECTIONS, type SectionKey } from "@/components/admin/SettingsSubnav";
import Link from "@/components/site/ui/Link";
import SubmitButton from "@/components/admin/SubmitButton";
import { requireAdmin } from "@/lib/server/auth";
import { mediaOptions } from "@/lib/server/services-admin";
import { environmentInfo, getEmailSettings, getSection, getTurnstileSettings, secretStatus } from "@/lib/server/site-config";
import { getSiteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

const INTRO: Record<SectionKey, string> = {
  general: "The name, logo and favicon of the website, and a short description of it.",
  contact: "How people can reach you. Shown on the website and given to search engines.",
  social: "Your profiles on other networks.",
  seo: "Defaults for search engines and link previews, and the robots rules.",
  analytics: "Google Analytics, Google Tag Manager and Meta Pixel.",
  integrations: "Email delivery, bot protection and the Cloudflare secrets they depend on.",
};

export default async function SettingsPage({ params }: { params: Promise<{ section: string }> }) {
  await requireAdmin();
  const section = (await params).section as SectionKey;
  if (!SECTIONS.some((s) => s.key === section)) notFound();
  const needsMedia = section === "general" || section === "seo";
  const media = needsMedia ? await mediaOptions() : [];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Site settings</h1>
          <p className="admin-sub">{INTRO[section]}</p>
        </div>
      </div>
      <SettingsSubnav current={section} />
      {(section === "analytics" || section === "integrations") && <p className="hint">The full list of integrations, with their status, tests and activity, is under <Link href="/admin/integrations">Integrations</Link>.</p>}
      {section === "general" && <GeneralForm initial={await getSection("general")} media={media} />}
      {section === "contact" && <ContactSettingsForm initial={await getSection("contact")} />}
      {section === "social" && <SocialForm initial={await getSection("social")} />}
      {section === "seo" && <SeoForm initial={await getSection("seo")} media={media} />}
      {section === "analytics" && <AnalyticsForm initial={await getSection("analytics")} siteUrl={await getSiteUrl()} />}
      {section === "integrations" && <Integrations />}
    </>
  );
}

async function Integrations() {
  const [email, turnstile] = await Promise.all([getEmailSettings(), getTurnstileSettings()]);
  const secrets = secretStatus();
  const keySet = secrets.find((s) => s.name === "RESEND_API_KEY")?.set ?? false;
  const turnstileSet = secrets.find((s) => s.name === "TURNSTILE_SECRET")?.set ?? false;
  const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC";

  return (
    <>
      <EmailForm initial={{ provider: email.provider, from: email.from, to: email.to, enabled: email.enabled }} keySet={keySet} />
      <section className="form-card">
        <h2>Send a test email</h2>
        <p className="hint">Sends a short message to the notification addresses above (save your changes first). Needs the Resend API key.</p>
        <form action={sendTestEmail}><SubmitButton>Send test email</SubmitButton></form>
        {email.lastCheckedAt && <p className="hint">Last test: {when(email.lastCheckedAt)}{email.lastError ? ` — failed: ${email.lastError}` : " — delivered to the provider"}.</p>}
      </section>

      <TurnstileForm initial={turnstile} secretSet={turnstileSet} />

      <section className="form-card">
        <h2>Cloudflare secrets</h2>
        <p className="hint">Keys and tokens are <b>never</b> stored in the database or shown here. They are Cloudflare secrets. This table only says whether each one is set. To set or change one, run the command in a terminal; you will be asked for the value.</p>
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th scope="col">Secret</th><th scope="col">Used for</th><th scope="col">Status</th><th scope="col">Command</th></tr></thead>
            <tbody>
              {secrets.map((s) => (
                <tr key={s.name}>
                  <td><code>{s.name}</code></td>
                  <td>{s.purpose}</td>
                  <td><span className={s.set ? "badge published" : "badge draft"}>{s.set ? "set" : "not set"}</span></td>
                  <td><code>{s.command}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="hint">For local development put them in <code>.dev.vars</code> (never committed).</p>
      </section>

      <section className="form-card">
        <h2>Environment</h2>
        <p className="hint">Not secret; set in <code>wrangler.jsonc</code>. Shown for reference.</p>
        <dl className="facts">
          {environmentInfo().map((e) => (
            <div key={e.name}><dt><code>{e.name}</code></dt><dd><b>{e.value || "—"}</b><br /><small>{e.note}</small></dd></div>
          ))}
        </dl>
      </section>
    </>
  );
}
