/**
 * Shown only in a preview (a signed-in admin looking at draft content): one thin fixed bar so nobody mistakes the preview for the live page. It is
 * the only thing added to the page; the page itself is drawn by the same components and styles as the public one.
 */
export default function PreviewBar({ what, back }: { what: string; back: string }) {
  return (
    <div role="status" style={{ position: "fixed", left: 12, bottom: 12, zIndex: 2147483000, maxWidth: "calc(100vw - 24px)", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", padding: "8px 14px", borderRadius: 999, background: "#17171c", color: "#fff", font: "600 13px/1.3 system-ui, sans-serif", boxShadow: "0 6px 24px rgba(0,0,0,.35)" }}>
      <span>Preview: {what}. Visitors do not see this.</span>
      <a href={back} style={{ color: "#ffb86b", textDecoration: "underline" }}>Back to the admin</a>
    </div>
  );
}
