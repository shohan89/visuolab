-- Blog: canonical URL and Open Graph image for each article. Both are optional: without them the page's own address and its cover image are used.
-- Scheduled publishing needs no column: an article with status 'published' and a published_at in the future is "scheduled" and becomes visible by itself.

ALTER TABLE blog_posts ADD COLUMN canonical_url TEXT CHECK (canonical_url IS NULL OR canonical_url LIKE 'https://%');
ALTER TABLE blog_posts ADD COLUMN og_image_id TEXT REFERENCES media (id) ON DELETE SET NULL;
CREATE INDEX idx_blog_posts_featured ON blog_posts (featured, published_at DESC);
CREATE INDEX idx_blog_posts_og_image ON blog_posts (og_image_id);
