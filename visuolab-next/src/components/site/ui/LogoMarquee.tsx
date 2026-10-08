import { trustedBy, type LogoSeed } from "@/content/logos";

/** "Trusted by" logo marquee. The track holds the list twice so the CSS animation loops seamlessly. */
export default function LogoMarquee({ items = trustedBy }: { items?: readonly LogoSeed[] }) {
  return (
    <div className="marquee" aria-hidden="true">
      <div className="marquee-track">
        {[0, 1].map((round) =>
          items.map((l, i) => (
            <span className={l.cls} key={`${round}-${i}-${l.text}`}>
              {l.dot && <i></i>}
              {l.text}
            </span>
          )),
        )}
      </div>
    </div>
  );
}
