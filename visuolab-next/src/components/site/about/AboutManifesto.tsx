import ScrollWords from "@/components/motion/ScrollWords";
import { richNodes } from "@/components/site/ui/Rich";
import type { ManifestoSection } from "@/lib/cms/sections";

/** The manifesto: one paragraph whose words light up as you scroll. The words come from the page CMS. */
export default function AboutManifesto({ content }: { content: ManifestoSection }) {
  return (
    <>
      <section className="sec manifesto" id="manifesto" aria-labelledby="manifesto-title"><div className="wrap"><p className="label reveal" id="manifesto-title">{content.label}</p><ScrollWords>{richNodes(content.text)}</ScrollWords></div></section>
    </>
  );
}
