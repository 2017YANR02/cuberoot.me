-- 0065_recon_official_enum.sql — recons.official 从 0/1 布尔改为三值枚举字符串。
--
-- 语义:wca=WCA 官方比赛 / non_wca=非 WCA 比赛 / practice=练习(个人 / 家用还原)。
-- 旧数据只有 0/1 两态,一律映射:official<>0 → 'wca',official=0 → 'practice'
-- (历史上 official=0 覆盖了所有非官方/练习条目,现全部归为 practice;non_wca 是新增值)。
--
-- Runner (ops/bin/apply_migrations.sh) 每个文件独立 BEGIN/COMMIT + ON_ERROR_STOP=1 —— 本文件禁写
-- BEGIN;/COMMIT;。已应用后被 _schema_migrations 的 sha256 锁死,部署后禁改本文件。

-- 旧默认 (1) 与新类型不兼容,先摘除再改类型。NOT NULL 约束随 TYPE 变更自动保留。
ALTER TABLE recons ALTER COLUMN official DROP DEFAULT;
ALTER TABLE recons ALTER COLUMN official TYPE VARCHAR(10)
  USING (CASE WHEN official <> 0 THEN 'wca' ELSE 'practice' END);
ALTER TABLE recons ALTER COLUMN official SET DEFAULT 'wca';
ALTER TABLE recons ADD CONSTRAINT recons_official_chk
  CHECK (official IN ('wca', 'non_wca', 'practice'));
