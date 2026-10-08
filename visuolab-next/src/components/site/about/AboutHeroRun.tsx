import Link from "@/components/site/ui/Link";
import { st } from "@/lib/css";
import AboutScene from "@/components/motion/AboutScene";
import Img from "@/components/site/ui/Img";
import { RichLines } from "@/components/site/ui/Rich";
import type { AboutHeroSection } from "@/lib/cms/sections";

export type MosaicTile = { slug: string; name: string; kind: string; image: string };

/** How many times the chosen projects are repeated in the strip: enough to fill it, and an even number so the two halves of the loop are identical (the track slides by exactly half). */
const repeats = (n: number) => { const r = Math.ceil(16 / Math.max(n, 1)); return r % 2 ? r + 1 : r; };

/** Hero and the strip of projects under it. The words come from the page CMS; the 3D scene and the aurora are fixed; the strip's projects come from the case studies. */
export default function AboutHeroRun({ content, tiles }: { content: AboutHeroSection | null; tiles: readonly MosaicTile[] | null }) {
  const strip = tiles && tiles.length ? Array.from({ length: repeats(tiles.length) }, () => tiles).flat() : [];
  return (
    <>
      <div className="hero-run has-aurora"><div className="aurora" aria-hidden="true"><span className="s1"></span><span className="s2"></span></div>{content && <section className="about-hero" id="top" aria-labelledby="about-title"><div className="wrap"><div className="copy"><p className="label reveal">{content.label}</p><h1 className="h1 reveal" id="about-title" style={st({ "--i": "0", "marginTop": "18px" })}><RichLines>{content.title}</RichLines></h1><div className="about-lead"><p className="lead reveal" style={st({ "--i": "1" })}>{content.lead}</p>{content.facts.length > 0 && <ul className="facts reveal" style={st({ "--i": "2" })}>{content.facts.map((f, i) => <li key={i}>{f}</li>)}</ul>}</div></div><AboutScene style={st({ "--i": "1" })} /></div></section>}{strip.length > 0 && <section className="mosaic" aria-label="Selected projects"><div className="mosaic-track">{strip.map((c, i) => <Link href={`/works/${c.slug}`} key={i}><figure><Img src={c.image} alt={`${c.name} — ${c.kind}`} loading="lazy" /><figcaption><b>{c.name}</b><span>{c.kind}</span></figcaption></figure></Link>)}</div></section>}</div>
    </>
  );
}
