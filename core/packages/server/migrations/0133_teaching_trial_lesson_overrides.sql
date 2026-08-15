-- 试听课中文内容覆盖。默认双语稿仍在前端源码中，只保存管理员修改过的中文字段。
CREATE TABLE teaching_trial_lesson_overrides (
  lesson_id   VARCHAR(80)  PRIMARY KEY,
  title_zh    VARCHAR(200) NOT NULL,
  outcome_zh  VARCHAR(1000) NOT NULL,
  minutes     SMALLINT     NOT NULL CHECK (minutes BETWEEN 1 AND 60),
  shots_zh    JSONB        NOT NULL,
  script_zh   JSONB        NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CHECK (lesson_id ~ '^trial-[a-z0-9-]+$'),
  CHECK (length(trim(title_zh)) > 0),
  CHECK (length(trim(outcome_zh)) > 0),
  CHECK (jsonb_typeof(shots_zh) = 'array'),
  CHECK (jsonb_array_length(shots_zh) BETWEEN 1 AND 30),
  CHECK (jsonb_typeof(script_zh) = 'array'),
  CHECK (jsonb_array_length(script_zh) BETWEEN 1 AND 100)
);

CREATE TRIGGER teaching_trial_lesson_overrides_updated_at
  BEFORE UPDATE ON teaching_trial_lesson_overrides
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
