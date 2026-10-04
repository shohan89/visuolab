import { trustedBy } from "@/content/logos";

/** "Trusted by" logo marquee. The track holds the list twice so the CSS animation loops seamlessly. */
export default function LogoMarquee() {
  return (
    <div className="marquee" aria-hidden="true">
      <div className="marquee-track">
        {[0, 1].map((round) =>
          trustedBy.map((l) => (
            <span className={l.cls} key={`${round}-${l.text}`}>
              {l.dot && <i></i>}
              {l.text}
            </span>
          )),
        )}
      </div>
    </div>
  );
}
