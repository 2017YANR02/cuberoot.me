-- Keep one page-top notice per path, but allow one homepage feature per destination.
ALTER TABLE page_notices DROP CONSTRAINT page_notices_path_placement_key;
CREATE UNIQUE INDEX page_notices_page_top_key ON page_notices (path, placement)
  WHERE placement = 'page_top';
CREATE UNIQUE INDEX page_notices_home_feature_key ON page_notices (path, placement, href)
  WHERE placement = 'home_featured';
