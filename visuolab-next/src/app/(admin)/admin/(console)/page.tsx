import Link from "@/components/site/ui/Link";
import { countsByStatus } from "@/lib/server/submissions";

export default async function AdminOverview() {
  const c = await countsByStatus();
  return (
    <>
      <h1>Overview</h1>
      <p className="admin-sub">Contact form submissions at a glance.</p>
      <div className="cards">
        <div className="card"><b>{c.new}</b><span>New, not read yet</span></div>
        <div className="card"><b>{c.read}</b><span>Read</span></div>
        <div className="card"><b>{c.replied}</b><span>Replied</span></div>
        <div className="card"><b>{c.archived}</b><span>Archived</span></div>
        <div className="card"><b>{c.spam}</b><span>Marked as spam</span></div>
      </div>
      <p><Link href="/admin/submissions">Open submissions →</Link></p>
    </>
  );
}
