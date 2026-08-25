-- 公式训练器 per-case 学习标记(/alg select+run 页):状态(学习中/已掌握/搁置)+ 难点星标,
-- 登录用户跨设备同步。身份取 JWT(requireAuth 的 ownerKey),客户端不传 wca_id。
-- case 身份 = (puzzle, set_slug, case_key),case_key 是客户端 trainer 全链路的 `subgroup|name`
-- (lib/trainer-case-key.ts);不 FK alg_cases.id —— legacy 路径 id 可能缺失,且 caseKey 在
-- set 内唯一(ZBLS Geng 同名 case 靠 subgroup 区分)。「未学」= 无行;status 与 starred 全空时删行。
CREATE TABLE IF NOT EXISTS alg_case_marks (
  wca_id      VARCHAR(20)  NOT NULL,
  puzzle      VARCHAR(16)  NOT NULL,
  set_slug    VARCHAR(32)  NOT NULL,
  case_key    VARCHAR(128) NOT NULL,
  status      VARCHAR(16)  CHECK (status IN ('learning', 'mastered', 'paused')),
  starred     BOOLEAN      NOT NULL DEFAULT FALSE,
  updated_at  BIGINT       NOT NULL,
  PRIMARY KEY (wca_id, puzzle, set_slug, case_key)
);
-- 拉某用户某 set 的全部标记(GET /v1/alg/marks/:puzzle/:set)。
CREATE INDEX IF NOT EXISTS idx_alg_case_marks_user_set ON alg_case_marks(wca_id, puzzle, set_slug);
