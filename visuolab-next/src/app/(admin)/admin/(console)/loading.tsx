/** Shown while an admin page loads: grey placeholder blocks in the shape of the page. */
export default function Loading() {
  return (
    <div className="skeleton" role="status" aria-label="Loading">
      <div className="sk sk-title" />
      <div className="sk sk-line" />
      <div className="stats">
        <div className="sk sk-stat" /><div className="sk sk-stat" /><div className="sk sk-stat" /><div className="sk sk-stat" />
      </div>
      <div className="grid-2">
        <div className="sk sk-panel" /><div className="sk sk-panel" />
      </div>
    </div>
  );
}
