-- /quiz 社区题:登录用户自己出题 + 给答案。
--
-- 上线策略是「直接上线 + 举报」(不设前置审核队列):登录即发布,任何登录用户可举报,
-- 管理员在 /quiz/manage 里补译 / 下架 / 删除。故 status 只有两态:
--   'published' 公开可见(默认)
--   'hidden'    管理员下架:仅作者与管理员可见,作者能看到 hidden_note 说明为什么
--
-- 语言:允许只写一种(q_en 或 q_zh 为空串)。缺的一侧渲染时回落到已有那侧并标注
-- 「仅中文 / English only」,管理员补译后清掉标注。校验逻辑在 @cuberoot/shared/quiz,
-- 服务端与表单共用,不在 DB 层加 CHECK(错误码要能给用户看)。
CREATE TABLE quiz_questions (
  id           SERIAL PRIMARY KEY,
  -- 与内置题库同名的三个维度;取值集合在 shared/quiz.ts 的 QUIZ_CATS / QUIZ_LEVELS / QUIZ_TYPES
  cat          VARCHAR(16) NOT NULL,
  level        VARCHAR(8)  NOT NULL,
  type         VARCHAR(8)  NOT NULL,
  q_zh         TEXT NOT NULL DEFAULT '',
  q_en         TEXT NOT NULL DEFAULT '',
  why_zh       TEXT NOT NULL DEFAULT '',
  why_en       TEXT NOT NULL DEFAULT '',
  -- choice 题:[{ "zh": "...", "en": "..." }, ...];open 题为 '[]'
  options      JSONB NOT NULL DEFAULT '[]'::jsonb,
  answer_idx   INT NOT NULL DEFAULT 0,
  -- open 题:参考答案 + 判对关键词(小写,命中任意一个即算对)
  answer_zh    TEXT NOT NULL DEFAULT '',
  answer_en    TEXT NOT NULL DEFAULT '',
  accept       TEXT[] NOT NULL DEFAULT '{}',
  -- 归属键 = 全站 ownerKey(真 wca_id 或 u<uid>),与 forum_posts.author_id 同语义
  author_key   VARCHAR(40) NOT NULL,
  author_name  VARCHAR(120) NOT NULL DEFAULT '',
  status       VARCHAR(12) NOT NULL DEFAULT 'published',
  hidden_note  VARCHAR(500),
  report_count INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 答题页每局都按 level 拉一次公开题(部分索引只覆盖 published,体积小)
CREATE INDEX idx_quiz_questions_live ON quiz_questions (level, cat) WHERE status = 'published';
-- 「我出的题」按人取,含已下架的
CREATE INDEX idx_quiz_questions_author ON quiz_questions (author_key, created_at DESC);

-- 举报。一人一题一条(重复举报更新理由并重新置为待处理,同 forum_reports)。
CREATE TABLE quiz_question_reports (
  id           SERIAL PRIMARY KEY,
  question_id  INT NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
  reporter_key VARCHAR(40) NOT NULL,
  reporter_name VARCHAR(120) NOT NULL DEFAULT '',
  reason       VARCHAR(500) NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at  TIMESTAMPTZ,
  UNIQUE (question_id, reporter_key)
);

-- 管理员队列按先来先处理取,只覆盖未处理的
CREATE INDEX idx_quiz_reports_open ON quiz_question_reports (created_at) WHERE resolved_at IS NULL;
