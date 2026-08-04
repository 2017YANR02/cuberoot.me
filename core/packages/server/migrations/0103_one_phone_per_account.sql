-- 一个账号只能绑一个手机号。0078 已经给邮箱建过同形状的索引,当时特意写了「手机保持可多绑」;
-- 现在改口径:手机与邮箱一样是单条凭据,面板里因此会同时出现「手机 +86… 解绑」和「手机 绑定」
-- 两行,看着像重复渲染 —— 与 0078 治的是同一个病。
--
-- 偏唯一索引是这条规矩的最终兜底(应用层的先行检查挡不住并发双绑)。
-- 必须带 WHERE:不带就把「每人至多一条身份」全锁死,邮箱 / WCA / 三方全绑不上。
--
-- 数据前置核实(2026-08-04,生产 cuberoot_db):
--   auth_identities 按 (user_id, provider) 分组无任何 cnt > 1 的行;
--   phone 共 10 行 / 10 个不同 user_id,本就 1:1 → 建索引不需要先清洗数据。
CREATE UNIQUE INDEX IF NOT EXISTS uq_auth_identity_one_phone
  ON auth_identities (user_id)
  WHERE provider = 'phone';
