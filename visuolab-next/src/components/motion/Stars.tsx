import { st } from "@/lib/css";

/**
 * Hero star field. Same generator as js/hero.js (golden-ratio positions, three sizes,
 * per-star glow/opacity/duration/delay), rendered on the server instead of appended by script.
 */
export default function Stars() {
  const stars = Array.from({ length: 48 }, (_, i) => {
    // three sizes: mostly faint pinpricks, some mid, a few bright
    const size = i % 7 === 0 ? 2.6 : i % 3 === 0 ? 1.6 : 1;
    return (
      <i
        key={i}
        style={st({
          left: ((i * 61.803) % 100).toFixed(3) + "%",
          top: ((i * 37.317) % 100).toFixed(3) + "%",
          width: size + "px",
          height: size + "px",
          "--g": (size * 2).toFixed(1) + "px", // glow scales with the star
          "--o": (size === 1 ? 0.22 + (i % 4) * 0.07 : 0.45 + (i % 5) * 0.1).toFixed(2),
          "--dur": (5 + ((i * 0.37) % 6)).toFixed(2) + "s", // 5-11s per star
          animationDelay: -((i * 0.83) % 11).toFixed(2) + "s",
        })}
      />
    );
  });
  return <div className="stars" aria-hidden="true">{stars}</div>;
}
