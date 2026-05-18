-- 0010_ops_commands.sql — /code/ops runbook 命令 + 提示词模板
-- 从硬编码 OpsPage.tsx COMMANDS 数组迁过来,DB 是 source of truth.
-- admin 走 X-Admin-Key 端点编辑 (server/routes/ops.ts),public GET 5min cache.

-- 防御性:trg_set_updated_at 只在 schema.pg.sql 里定义,无前序 migration.
-- 在已有此函数的 prod 是 no-op (CREATE OR REPLACE),也让 fresh local PG 能自洽 apply.
CREATE OR REPLACE FUNCTION trg_set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE ops_commands (
  id          TEXT         PRIMARY KEY,
  category    TEXT         NOT NULL CHECK (category IN ('db','build','deploy','backup','prompt')),
  cwd         TEXT,
  position    INTEGER      NOT NULL DEFAULT 0,
  chips       JSONB        NOT NULL DEFAULT '[]'::jsonb,
  title_zh    TEXT         NOT NULL,
  title_en    TEXT         NOT NULL,
  desc_zh     TEXT         NOT NULL,
  desc_en     TEXT         NOT NULL,
  cmd         TEXT         NOT NULL,
  variants    JSONB        NOT NULL DEFAULT '[]'::jsonb,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ops_commands_cat_pos ON ops_commands(category, position);
CREATE TRIGGER ops_commands_updated_at BEFORE UPDATE ON ops_commands
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
