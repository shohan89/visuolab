import Link from "@/components/site/ui/Link";
import { PillBadge } from "@/components/site/ui/Pill";
import { postBySlug } from "@/content/blog";
import type { BlogPost } from "@/content/types";
import { st } from "@/lib/css";
import { formatDate } from "@/lib/dates";
import { headingId } from "@/lib/slug";
import ArticleToc, { type TocItem } from "./ArticleToc";
import ShareRail from "./ShareRail";

/** An article page. All six articles share one layout, so one component renders any BlogPost (markup follows blog/*.html). */
export default function BlogArticle({ post: p, url }: { post: BlogPost; url: string }) {
  const toc: TocItem[] = p.body
    .filter((b) => b.type === "heading")
    .map((b, i) => ({ id: headingId(b.text, i), text: b.text }));
  // position of each heading among the headings (its table-of-contents entry), or -1 for paragraphs
  const tocIndex = p.body.map((b, i) => (b.type === "heading" ? p.body.slice(0, i).filter((x) => x.type === "heading").length : -1));
  const related = p.related.map((s) => postBySlug(s)).filter((r): r is BlogPost => !!r);

  return (
    <>
      <article className="post-page light" id="top" data-light-offset="450">
        <div className="post-hero">
          <div className="wrap post-head">
            <p className="crumbs reveal"><Link href="/blog">Blog</Link><span>/</span><span>{p.category}</span></p>
            <h1 className="h1 reveal" style={st({ "--i": 0 })}>{p.title}</h1>
            <div className="byline reveal" style={st({ "--i": 1 })}>
              <img className="avatar" src={p.author.avatar} alt="" />
              <div><b>{p.author.name}</b></div>
              <span className="dot" aria-hidden="true"></span><span>{formatDate(p.publishedAt)}</span>
              <span className="dot" aria-hidden="true"></span><span>{`${p.readMinutes} min read`}</span>
            </div>
          </div>
        </div>
        <div className="wrap"><figure className="post-cover reveal"><img src={p.cover.src} alt={p.cover.alt} /></figure></div>
        <div className="wrap">
          <div className="article-grid">
            <ArticleToc items={toc} />
            <div className="prose reveal">
              <p className="post-lead">{p.lead}</p>
              {p.body.map((b, i) => {
                if (b.type === "heading") return <h2 id={toc[tocIndex[i] ?? 0]?.id} key={i}>{b.text}</h2>;
                return <p key={i}>{b.text}</p>;
              })}
              <hr />
              <p className="outro">{p.outro.before} <a href={p.outro.href}>{p.outro.linkText}</a>{p.outro.after}</p>
            </div>
            <ShareRail url={url} title={p.meta.title} />
          </div>
        </div>
      </article>

      <section className="sec more-sec light" aria-labelledby="more-title">
        <div className="wrap">
          <div className="more-head">
            <div className="sec-grid"><p className="label reveal">Keep reading</p><h2 className="h2 reveal" id="more-title" style={st({ "--i": 0 })}>More from the <em>studio</em></h2></div>
            <Link className="pill ghost reveal" style={st({ "--i": 1 })} href="/blog">All articles <PillBadge /></Link>
          </div>
          <div className="more posts-more">
            {related.map((r, i) => (
              <Link className="reveal" style={st({ "--i": i })} href={`/blog/${r.slug}`} key={r.slug}>
                <div className="img"><img src={r.cover.src} alt="" loading="lazy" /></div>
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
