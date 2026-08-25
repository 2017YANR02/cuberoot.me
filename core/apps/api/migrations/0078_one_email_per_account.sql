-- 一个账号只能绑一个邮箱。auth_identities 原本只有 UNIQUE(provider, provider_uid)
-- (防两个账号绑同一身份),没有「每人每 provider 至多一条」的约束,所以邮箱可以绑多个 ——
-- 账号面板里因此会同时出现「邮箱 xxx@x 解绑」和「邮箱 绑定」两行,看着像重复渲染。
--
-- 偏唯一索引是这条规矩的最终兜底(应用层的先行检查挡不住并发双绑)。
-- 手机、三方暂不受此约束:手机保持可多绑,WCA 由 app_users.wca_id 镜像列单独保证单例。
--
-- 数据前置核实(2026-07-20,生产 cuberoot_db):
--   auth_identities 按 (user_id, provider) 分组无任何 cnt > 1 的行;
--   email 共 26 行 / 26 个不同 user_id,本就 1:1 → 建索引不需要先清洗数据。
CREATE UNIQUE INDEX IF NOT EXISTS uq_auth_identity_one_email
  ON auth_identities (user_id)
  WHERE provider = 'email';
