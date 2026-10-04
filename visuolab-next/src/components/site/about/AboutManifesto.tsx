import ScrollWords from "@/components/motion/ScrollWords";

export default function AboutManifesto() {
  return (
    <>
      <section className="sec manifesto" id="manifesto" aria-labelledby="manifesto-title"><div className="wrap"><p className="label reveal" id="manifesto-title">Why Visuolab exists</p><ScrollWords>{"We started Visuolab because we were tired of watching "}<em>good ideas</em>{" get diluted between the deck, the design and the build. So we built a studio where "}<em>the same people</em>{" carry an idea from the first sketch to the last screen — and stay accountable for how it performs. Small on purpose. Senior by default. "}<em>Honest</em>{" about what will and won't move the needle."}</ScrollWords></div></section>
    </>
  );
}
