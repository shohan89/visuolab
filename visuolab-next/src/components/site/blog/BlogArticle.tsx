import Link from "@/components/site/ui/Link";
import { PillBadge } from "@/components/site/ui/Pill";
import Rich from "@/components/site/ui/Rich";
import type { BlogBlock, BlogPost } from "@/content/types";
import type { ArticleChromeSection } from "@/lib/cms/sections";
import { st } from "@/lib/css";
import { formatDate } from "@/lib/dates";
import { headingId } from "@/lib/slug";
import ArticleToc, { type TocItem } from "./ArticleToc";
import InlineText from "./InlineText";
import ShareRail from "./ShareRail";
import Img from "@/components/site/ui/Img";

/**
 * An article page. Every article shares one layout, so one component renders any BlogPost (markup follows blog/*.html).
 * Text goes through InlineText and the block switch below: React elements only, never injected HTML. `related` are live articles.
 */
export default function BlogArticle({ post: p, related, url, chrome }: { post: BlogPost; related: BlogPost[]; url: string; chrome: ArticleChromeSection }) {
  const headings = p.body.filter((b): b is Extract<BlogBlock, { type: "heading" }> => b.type === "heading");
  const toc: TocItem[] = headings.map((b, i) => ({ id: headingId(b.text, i), text: b.text }));
  // position of each heading among the headings (its table-of-contents entry), or -1 for paragraphs
  const tocIndex = p.body.map((b, i) => (b.type === "heading" ? p.body.slice(0, i).filter((x) => x.type === "heading").length : -1));

  return (
    <>
      <article className="post-page light" id="top" data-light-offset="450">
        <div className="post-hero">
          <div className="wrap post-head">
            <p className="crumbs reveal"><Link href="/blog">{chrome.breadcrumbRoot}</Link><span>/</span><span>{p.category}</span></p>
            <h1 className="h1 reveal" style={st({ "--i": 0 })}>{p.title}</h1>
            <div className="byline reveal" style={st({ "--i": 1 })}>
              {p.author.avatar && <Img className="avatar" src={p.author.avatar} alt="" />}
              <div><b>{p.author.name}</b></div>
              <span className="dot" aria-hidden="true"></span><span>{formatDate(p.publishedAt)}</span>
              <span className="dot" aria-hidden="true"></span><span>{`${p.readMinutes} min read`}</span>
            </div>
          </div>
        </div>
        <div className="wrap"><figure className="post-cover reveal"><Img sizes="(max-width: 900px) 100vw, 1300px" src={p.cover.src} alt={p.cover.alt} fetchPriority="high" /></figure></div>
        <div className="wrap">
          <div className="article-grid">
            <ArticleToc items={toc} label={chrome.tocLabel} />
            <div className="prose reveal">
              <p className="post-lead"><InlineText>{p.lead}</InlineText></p>
              {p.body.map((b, i) => {
                switch (b.type) {
                  case "heading": return <h2 id={toc[tocIndex[i] ?? 0]?.id} key={i}>{b.text}</h2>;
                  case "subheading": return <h3 key={i}>{b.text}</h3>;
                  case "paragraph": return <p key={i}><InlineText>{b.text}</InlineText></p>;
                  case "list": {
                    const items = b.items.map((it, n) => <li key={n}><InlineText>{it}</InlineText></li>);
                    return b.ordered ? <ol key={i}>{items}</ol> : <ul key={i}>{items}</ul>;
                  }
                  case "quote": return <blockquote key={i}><p><InlineText>{b.text}</InlineText></p>{b.cite && <cite>{b.cite}</cite>}</blockquote>;
                  case "image": return <figure className="post-figure" key={i}><Img src={b.src} alt={b.alt} loading="lazy" />{b.caption && <figcaption>{b.caption}</figcaption>}</figure>;
                  case "divider": return <hr className="post-divider" key={i} />;
                }
              })}
              <hr />
              <p className="outro">{p.outro.before} <a href={p.outro.href}>{p.outro.linkText}</a>{p.outro.after}</p>
            </div>
            <ShareRail url={url} title={p.meta.title} label={chrome.shareLabel} />
          </div>
        </div>
      </article>

      <section className="sec more-sec light" aria-labelledby="more-title">
        <div className="wrap">
          <div className="more-head">
            <div className="sec-grid"><p className="label reveal">{chrome.relatedLabel}</p><h2 className="h2 reveal" id="more-title" style={st({ "--i": 0 })}><Rich>{chrome.relatedTitle}</Rich></h2></div>
            <Link className="pill ghost reveal" style={st({ "--i": 1 })} href="/blog">{`${chrome.relatedAllLabel} `}<PillBadge /></Link>
          </div>
          <div className="more posts-more">
            {related.map((r, i) => (
              <Link className="reveal" style={st({ "--i": i })} href={`/blog/${r.slug}`} key={r.slug}>
                <div className="img"><Img sizes="(max-width: 900px) 100vw, 420px" src={r.cover.src} alt="" loading="lazy" /></div>
                <p className="post-meta"><span className="cat">{r.category}</span><span>{`${r.readMinutes} min read`}</span></p>
                <b>{r.title}</b>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
