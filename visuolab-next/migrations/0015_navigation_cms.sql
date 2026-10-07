-- Navigation CMS: the menu rows become editable from /admin/navigation.
--   type             internal (a path on this site, or an anchor), external (a full address) or group (a heading with children, no link)
--   page_ref         optional reference to the page an internal link was picked from (e.g. service:svc_brand_identity); href is what the site uses
--   is_visible       0 hides the item (and, for a group, everything under it) on the website without deleting it
--   open_in_new_tab  1 opens the link in a new tab (always set for external links made in the admin)
-- Old rows are carried over: published -> visible, a row without href is a group, an address starting http(s) is external.

ALTER TABLE navigation_items ADD COLUMN type TEXT NOT NULL DEFAULT 'internal' CHECK (type IN ('internal', 'external', 'group'));
ALTER TABLE navigation_items ADD COLUMN page_ref TEXT;
ALTER TABLE navigation_items ADD COLUMN is_visible INTEGER NOT NULL DEFAULT 1 CHECK (is_visible IN (0, 1));
ALTER TABLE navigation_items ADD COLUMN open_in_new_tab INTEGER NOT NULL DEFAULT 0 CHECK (open_in_new_tab IN (0, 1));

UPDATE navigation_items SET
  type = CASE WHEN href IS NULL THEN 'group' WHEN href LIKE 'http://%' OR href LIKE 'https://%' THEN 'external' ELSE 'internal' END,
  is_visible = CASE WHEN status = 'published' THEN 1 ELSE 0 END,
  open_in_new_tab = CASE WHEN href LIKE 'http://%' OR href LIKE 'https://%' THEN 1 ELSE 0 END;

-- The editor saves a whole menu at once, moving items past each other; positions are kept in order by the application, not by an index.
DROP INDEX IF EXISTS uq_navigation_position;
