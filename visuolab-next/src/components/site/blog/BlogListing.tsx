import Link from "@/components/site/ui/Link";
import { FilterProvider } from "@/components/motion/Filter";
import Aurora from "@/components/site/ui/Aurora";
import FilterChips, { type Chip } from "@/components/site/ui/FilterChips";
import type { BlogPost } from "@/content/types";
import { st } from "@/lib/css";
import { formatDate } from "@/lib/dates";
import BlogGrid from "./BlogGrid";
import Img from "@/components/site/ui/Img";

/**
 * The blog index: heading, topic chips, the featured article, then the grid of the others. `posts` are the live articles, newest first;
 * the featured one is the newest article flagged featured, or the newest article when none is.
 */
export default function BlogListing({ posts, topics }: { posts: BlogPost[]; topics: string[] }) {
  const featured = posts.find((p) => p.featured) ?? posts[0];
  const rest = posts.filter((p) => p !== featured);
  const chips: Chip[] = [
    { key: "all", label: "All", count: posts.length },
    ...topics.map((t) => ({ key: t, label: t, count: posts.filter((p) => p.category === t).length })),
  ];
  return (
    <FilterProvider>
      <div className="hero-run has-aurora">
        <Aurora />
        <section className="page-hero blog-hero" id="top" aria-labelledby="blog-title">
          <div className="wrap">
            <p className="label reveal">Blog</p>
            <h1 className="h1 reveal" id="blog-title" style={st({ "--i": 0 })}>Notes on <em>design</em> and the work around it</h1>
            <p className="lead reveal" style={st({ "--i": 1 })}>What we ship, what we learn and what we would do differently. No thought leadership, no listicles.</p>
            <FilterChips chips={chips} ariaLabel="Filter by topic" />
          </div>
        </section>

        {featured && (
          <section className="featured-sec" aria-label="Latest article">
            <div className="wrap">
              <Link className="featured reveal" href={`/blog/${featured.slug}`}>
                <div className="img"><Img sizes="(max-width: 900px) 100vw, 640px" src={featured.cover.src} alt={featured.cover.alt} fetchPriority="high" /></div>
                <div className="body">
                  <p className="post-meta"><span className="cat">{featured.category}</span><span>{formatDate(featured.publishedAt)}</span><span>{`${featured.readMinutes} min read`}</span></p>
                  <h2>{featured.title}</h2>
                  <p className="excerpt">{featured.excerpt ?? featured.meta.description}</p>
                  <span className="arrow-link">Read the article <svg viewBox="0 0 24 24"><path d="M7 17L17 7M9 7h8v8" /></svg></span>
                </div>
              </Link>
            </div>
          </section>
        )}

        <section className="posts-sec" aria-label="Articles">
          <div className="wrap">
            <BlogGrid posts={rest} />
          </div>
        </section>
      </div>
    </FilterProvider>
  );
}
