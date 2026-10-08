"use client";

import { matchesFilter, useFilter } from "@/components/motion/Filter";
import type { BlogPost } from "@/content/types";
import BlogCard from "./BlogCard";

/**
 * The article grid. A topic chip hides non-matching cards (.is-hidden) and marks matching ones .in, like the original
 * script; until a chip is used the classes are left alone so the scroll reveal adds .in itself.
 * The featured article above the grid is not part of the filtered set.
 */
export default function BlogGrid({ posts, emptyText }: { posts: BlogPost[]; emptyText: string }) {
  const { filter, touched } = useFilter();
  const shown = posts.filter((p) => matchesFilter(filter, [p.category])).length;
  return (
    <>
      <div className="posts" id="posts-grid">
        {posts.map((p, i) => {
          const hit = matchesFilter(filter, [p.category]);
          return <BlogCard post={p} index={i} state={touched ? (hit ? " in" : " is-hidden") : ""} key={p.slug} />;
        })}
      </div>
      <p className="works-empty" hidden={shown > 0}>{emptyText}</p>
    </>
  );
}
