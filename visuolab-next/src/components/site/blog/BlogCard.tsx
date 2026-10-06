import Link from "@/components/site/ui/Link";
import type { BlogPost } from "@/content/types";
import { st } from "@/lib/css";
import { formatDate } from "@/lib/dates";
import Img from "@/components/site/ui/Img";

/** One article card in the blog grid (.post). `state` carries the filter classes (.in / .is-hidden) when a topic chip is in use. */
export default function BlogCard({ post, index, state = "" }: { post: BlogPost; index: number; state?: string }) {
  return (
    <Link className={`post reveal${state}`} style={st({ "--i": index % 2 })} href={`/blog/${post.slug}`} data-cat={post.category}>
      <div className="post-media"><Img sizes="(max-width: 900px) 100vw, 420px" src={post.cover.src} alt={post.cover.alt} loading="lazy" /></div>
      <div className="post-body">
        <p className="post-meta"><span className="cat">{post.category}</span><span>{formatDate(post.publishedAt)}</span></p>
        <h2>{post.title}</h2>
      </div>
    </Link>
  );
}
