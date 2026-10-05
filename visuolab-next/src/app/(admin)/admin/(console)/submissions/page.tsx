import Link from "@/components/site/ui/Link";
import { changeStatus, removeSubmission } from "@/actions/admin";
import SubmitButton from "@/components/admin/SubmitButton";
import { requireAdmin } from "@/lib/server/auth";
import { STATUSES, countsByStatus, listSubmissions, type SubmissionStatus } from "@/lib/server/submissions";

const PAGE_SIZE = 25;
const TABS: { key: SubmissionStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "new", label: "New" },
  { key: "read", label: "Read" },
  { key: "replied", label: "Replied" },
  { key: "archived", label: "Archived" },
  { key: "spam", label: "Spam" },
];
const NEXT_STEPS: Record<SubmissionStatus, { to: SubmissionStatus; label: string }[]> = {
  new: [{ to: "read", label: "Mark read" }, { to: "replied", label: "Mark replied" }, { to: "spam", label: "Spam" }],
  read: [{ to: "replied", label: "Mark replied" }, { to: "archived", label: "Archive" }, { to: "spam", label: "Spam" }],
  replied: [{ to: "archived", label: "Archive" }, { to: "new", label: "Mark unread" }],
  archived: [{ to: "new", label: "Restore as new" }],
  spam: [{ to: "new", label: "Not spam" }],
};

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC";

export default async function SubmissionsPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const status = (STATUSES as readonly string[]).includes(sp.status ?? "") ? (sp.status as SubmissionStatus) : "all";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const [{ items, total }, counts] = await Promise.all([listSubmissions({ status, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }), countsByStatus()]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const here = `/admin/submissions?${new URLSearchParams({ ...(status !== "all" ? { status } : {}), ...(page > 1 ? { page: String(page) } : {}) })}`;
  const href = (s: string, p = 1) => `/admin/submissions?${new URLSearchParams({ ...(s !== "all" ? { status: s } : {}), ...(p > 1 ? { page: String(p) } : {}) })}`;

  return (
    <>
      <div className="page-head"><div><h1>Submissions</h1>
      <p className="admin-sub">Messages sent through the contact form, newest first.</p></div></div>
      <nav className="tabs" aria-label="Filter by status">
        {TABS.map((t) => (
          <Link href={href(t.key)} aria-current={status === t.key ? "page" : undefined} key={t.key}>{t.label} <i>{counts[t.key]}</i></Link>
        ))}
      </nav>

      {items.length === 0 ? (
        <div className="empty-state"><b>No submissions here</b><p>{status === "all" ? "Messages from the contact form will appear here." : `Nothing is marked “${status}” right now.`}</p></div>
      ) : (
        <div className="list">
          {items.map((s) => (
            <article className={s.status === "new" ? "item is-new" : "item"} key={s.id}>
              <div className="item-head">
                <b>{s.name}</b>
                <a href={`mailto:${s.email}`}>{s.email}</a>
                <span className={`badge ${s.status}`}>{s.status}</span>
                <time dateTime={s.createdAt}>{when(s.createdAt)}</time>
              </div>
              <p className="meta">
                {s.company && <span><b>Company</b> {s.company}</span>}
                {s.service && <span><b>Needs</b> {s.service}</span>}
                {s.budget && <span><b>Budget</b> {s.budget}</span>}
                <span><b>Mail</b> {s.notifiedAt ? "sent" : s.notifyError ?? "—"}</span>
              </p>
              <p className="message">{s.message}</p>
              <div className="actions">
                {NEXT_STEPS[s.status].map((n) => (
                  <form action={changeStatus} key={n.to}>
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="status" value={n.to} />
                    <input type="hidden" name="back" value={here} />
                    <SubmitButton>{n.label}</SubmitButton>
                  </form>
                ))}
                <form action={removeSubmission}>
                  <input type="hidden" name="id" value={s.id} />
                  <input type="hidden" name="back" value={here} />
                  <SubmitButton className="danger" confirm="Delete this submission for good?">Delete</SubmitButton>
                </form>
              </div>
            </article>
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="pager">
          {page > 1 && <Link href={href(status, page - 1)}>← Newer</Link>}
          <span>Page {page} of {pages}</span>
          {page < pages && <Link href={href(status, page + 1)}>Older →</Link>}
        </div>
      )}
    </>
  );
}
