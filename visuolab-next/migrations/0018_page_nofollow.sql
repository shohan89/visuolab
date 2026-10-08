-- Robots "follow / nofollow" for a page, next to the existing index / noindex (pages.noindex): the two are set independently in the page's SEO editor.

ALTER TABLE pages ADD COLUMN nofollow INTEGER NOT NULL DEFAULT 0 CHECK (nofollow IN (0, 1));
