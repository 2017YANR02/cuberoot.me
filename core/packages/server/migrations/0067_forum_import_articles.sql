-- 0067_forum_import_articles.sql — 把 /article 社区长文并入 /forum。
--
-- 背景:站点不再单独保留 /article,已发布长文整体迁进论坛(见前端 /article 路由移除)。
--       每篇已发布、未软删的 article → 论坛「教程与指南」(forum_forums.slug='tutorials')下一条主题,
--       首帖正文 = 文章正文(有副标题则以斜体 lead 段前置)。作者键 / 名 / 时间原样保留。
--       正文里的配图仍是 /v1/article/img/:id 绝对地址,article_image 表与该端点保留,故图不失效。
--       草稿(published_at 为空)不迁移:没有稳定的主题落点,留在 article 表(前端已无入口)。
--
-- 幂等:runner 用 sha256 锁死已应用文件,只跑一次。article 表为空的环境自然插 0 行。
-- forum_threads / forum_posts 的 updated_at 触发器只在 UPDATE 触发,这里显式写入的时间戳不被覆盖。
-- Runner 每个文件独立 BEGIN/COMMIT + ON_ERROR_STOP=1 —— 本文件禁写 BEGIN;/COMMIT;。

DO $$
DECLARE
  a    RECORD;
  fid  BIGINT;
  tid  BIGINT;
  body TEXT;
BEGIN
  SELECT id INTO fid FROM forum_forums WHERE slug = 'tutorials';
  IF fid IS NULL THEN
    RAISE EXCEPTION 'forum_forums slug=tutorials not found (0066 seed missing?)';
  END IF;

  FOR a IN
    SELECT * FROM article
    WHERE published_at IS NOT NULL AND deleted_at IS NULL
    ORDER BY published_at
  LOOP
    INSERT INTO forum_threads (
      forum_id, title, author_id, author_name,
      created_at, updated_at, last_post_at,
      last_post_author_id, last_post_author_name,
      reply_count, view_count
    ) VALUES (
      fid, a.title, a.owner_wca_id, a.owner_name,
      a.created_at, a.updated_at, COALESCE(a.published_at, a.created_at),
      a.owner_wca_id, a.owner_name,
      0, 0
    )
    RETURNING id INTO tid;

    body := CASE
      WHEN a.subtitle IS NOT NULL AND btrim(a.subtitle) <> ''
        THEN '*' || a.subtitle || E'*\n\n' || a.body
      ELSE a.body
    END;

    INSERT INTO forum_posts (
      thread_id, author_id, author_name, content, created_at, updated_at
    ) VALUES (
      tid, a.owner_wca_id, a.owner_name, body,
      COALESCE(a.published_at, a.created_at), a.updated_at
    );
  END LOOP;
END $$;
