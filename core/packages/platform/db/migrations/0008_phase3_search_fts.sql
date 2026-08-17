-- FTS5 virtual tables for full-text search across searchable resources.
-- Tokenizer: unicode61 with diacritic removal. We feed text through the
-- registered SQL function `cube_seg` which inserts spaces between adjacent
-- CJK characters so each Chinese character becomes its own FTS token.
CREATE VIRTUAL TABLE IF NOT EXISTS `courses_fts` USING fts5(
  id UNINDEXED,
  title,
  summary,
  tags,
  tokenize='unicode61 remove_diacritics 2'
);
--> statement-breakpoint
CREATE VIRTUAL TABLE IF NOT EXISTS `products_fts` USING fts5(
  id UNINDEXED,
  title,
  description,
  tags,
  tokenize='unicode61 remove_diacritics 2'
);
--> statement-breakpoint
CREATE VIRTUAL TABLE IF NOT EXISTS `events_fts` USING fts5(
  id UNINDEXED,
  title,
  summary,
  location,
  tokenize='unicode61 remove_diacritics 2'
);
--> statement-breakpoint
CREATE VIRTUAL TABLE IF NOT EXISTS `news_fts` USING fts5(
  id UNINDEXED,
  title,
  summary,
  body,
  tokenize='unicode61 remove_diacritics 2'
);
--> statement-breakpoint
CREATE VIRTUAL TABLE IF NOT EXISTS `posts_fts` USING fts5(
  id UNINDEXED,
  title,
  body,
  tokenize='unicode61 remove_diacritics 2'
);
--> statement-breakpoint
-- courses triggers
CREATE TRIGGER IF NOT EXISTS `courses_ai` AFTER INSERT ON `courses` BEGIN
  INSERT INTO `courses_fts`(id, title, summary, tags)
  VALUES (new.id, cube_seg(new.title), cube_seg(new.subtitle), cube_seg(new.tags));
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `courses_ad` AFTER DELETE ON `courses` BEGIN
  DELETE FROM `courses_fts` WHERE id = old.id;
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `courses_au` AFTER UPDATE ON `courses` BEGIN
  DELETE FROM `courses_fts` WHERE id = old.id;
  INSERT INTO `courses_fts`(id, title, summary, tags)
  VALUES (new.id, cube_seg(new.title), cube_seg(new.subtitle), cube_seg(new.tags));
END;
--> statement-breakpoint
-- products triggers
CREATE TRIGGER IF NOT EXISTS `products_ai` AFTER INSERT ON `products` BEGIN
  INSERT INTO `products_fts`(id, title, description, tags)
  VALUES (new.id, cube_seg(new.name), cube_seg(new.description), cube_seg(new.features));
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `products_ad` AFTER DELETE ON `products` BEGIN
  DELETE FROM `products_fts` WHERE id = old.id;
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `products_au` AFTER UPDATE ON `products` BEGIN
  DELETE FROM `products_fts` WHERE id = old.id;
  INSERT INTO `products_fts`(id, title, description, tags)
  VALUES (new.id, cube_seg(new.name), cube_seg(new.description), cube_seg(new.features));
END;
--> statement-breakpoint
-- events triggers
CREATE TRIGGER IF NOT EXISTS `events_ai` AFTER INSERT ON `events` BEGIN
  INSERT INTO `events_fts`(id, title, summary, location)
  VALUES (new.id, cube_seg(new.title), cube_seg(new.description), cube_seg(new.city || ' ' || new.venue));
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `events_ad` AFTER DELETE ON `events` BEGIN
  DELETE FROM `events_fts` WHERE id = old.id;
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `events_au` AFTER UPDATE ON `events` BEGIN
  DELETE FROM `events_fts` WHERE id = old.id;
  INSERT INTO `events_fts`(id, title, summary, location)
  VALUES (new.id, cube_seg(new.title), cube_seg(new.description), cube_seg(new.city || ' ' || new.venue));
END;
--> statement-breakpoint
-- news triggers
CREATE TRIGGER IF NOT EXISTS `news_ai` AFTER INSERT ON `news` BEGIN
  INSERT INTO `news_fts`(id, title, summary, body)
  VALUES (new.id, cube_seg(new.title), cube_seg(new.excerpt), cube_seg(COALESCE(new.body, '')));
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `news_ad` AFTER DELETE ON `news` BEGIN
  DELETE FROM `news_fts` WHERE id = old.id;
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `news_au` AFTER UPDATE ON `news` BEGIN
  DELETE FROM `news_fts` WHERE id = old.id;
  INSERT INTO `news_fts`(id, title, summary, body)
  VALUES (new.id, cube_seg(new.title), cube_seg(new.excerpt), cube_seg(COALESCE(new.body, '')));
END;
--> statement-breakpoint
-- posts triggers
CREATE TRIGGER IF NOT EXISTS `posts_ai` AFTER INSERT ON `posts` BEGIN
  INSERT INTO `posts_fts`(id, title, body) VALUES (new.id, cube_seg(new.title), cube_seg(new.body));
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `posts_ad` AFTER DELETE ON `posts` BEGIN
  DELETE FROM `posts_fts` WHERE id = old.id;
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `posts_au` AFTER UPDATE ON `posts` BEGIN
  DELETE FROM `posts_fts` WHERE id = old.id;
  INSERT INTO `posts_fts`(id, title, body) VALUES (new.id, cube_seg(new.title), cube_seg(new.body));
END;
--> statement-breakpoint
-- backfill existing rows (idempotent: skip ids already present in FTS index)
INSERT INTO `courses_fts`(id, title, summary, tags)
  SELECT id, cube_seg(title), cube_seg(subtitle), cube_seg(tags) FROM `courses`
  WHERE id NOT IN (SELECT id FROM `courses_fts`);
--> statement-breakpoint
INSERT INTO `products_fts`(id, title, description, tags)
  SELECT id, cube_seg(name), cube_seg(description), cube_seg(features) FROM `products`
  WHERE id NOT IN (SELECT id FROM `products_fts`);
--> statement-breakpoint
INSERT INTO `events_fts`(id, title, summary, location)
  SELECT id, cube_seg(title), cube_seg(description), cube_seg(city || ' ' || venue) FROM `events`
  WHERE id NOT IN (SELECT id FROM `events_fts`);
--> statement-breakpoint
INSERT INTO `news_fts`(id, title, summary, body)
  SELECT id, cube_seg(title), cube_seg(excerpt), cube_seg(COALESCE(body, '')) FROM `news`
  WHERE id NOT IN (SELECT id FROM `news_fts`);
--> statement-breakpoint
INSERT INTO `posts_fts`(id, title, body)
  SELECT id, cube_seg(title), cube_seg(body) FROM `posts`
  WHERE id NOT IN (SELECT id FROM `posts_fts`);
