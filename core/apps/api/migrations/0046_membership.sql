-- 0046_membership.sql — 会员订阅 (membership / subscription)。
--
-- 身份:沿用 WCA OAuth(wca_id 作主键),不建本站账号 —— 站内用户全是 WCA 选手,
--       WCA 登录就是最低摩擦的身份源(见 docs/MEMBERSHIP.md 调研结论)。
-- 计费:一次性按周期付款(月/年/永久)+ 手动续费 + 到期提醒。国内个人/聚合支付
--       拿不到自动代扣(微信自动续费仅企业,支付宝周期扣款需企业过审),不做 auto-renew。
-- 支付:聚合支付(虎皮椒 xunhupay)异步 notify 入账;也支持 admin 手动开通(manual),
--       因此未配置支付商户时系统仍可用(admin 给已打赏用户开会员)。
-- 生效判定:不存 status 列,读时算 —— expires_at IS NULL(永久) 或 expires_at > now() 即有效。

-- ── 套餐(admin 可改;此处先 seed 三档,价格为占位,上线前自行调整)──
CREATE TABLE membership_plans (
  slug         VARCHAR(40)  PRIMARY KEY,           -- 'monthly' | 'yearly' | 'lifetime' | ...
  name_zh      VARCHAR(80)  NOT NULL,
  name_en      VARCHAR(80)  NOT NULL,
  period       VARCHAR(12)  NOT NULL,              -- 'month' | 'year' | 'lifetime'
  period_count INT          NOT NULL DEFAULT 1,    -- period='month',count=3 → 一次买 3 个月
  price_cents  INT          NOT NULL,              -- 单位:分(避免浮点)
  currency     VARCHAR(8)   NOT NULL DEFAULT 'CNY',
  perks        JSONB        NOT NULL DEFAULT '[]'::jsonb,  -- perk slug 数组,文案在前端 i18n
  active       BOOLEAN      NOT NULL DEFAULT TRUE,
  sort         INT          NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE TRIGGER membership_plans_updated_at BEFORE UPDATE ON membership_plans
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

-- ── 订单(每次发起付款一条;out_trade_no 我方单号,全局唯一)──
CREATE TABLE membership_orders (
  out_trade_no VARCHAR(64)  PRIMARY KEY,           -- 我方单号(下单时生成)
  wca_id       VARCHAR(20)  NOT NULL,
  name         VARCHAR(200) NOT NULL DEFAULT '',   -- 下单时姓名快照
  plan_slug    VARCHAR(40)  NOT NULL REFERENCES membership_plans(slug),
  amount_cents INT          NOT NULL,
  currency     VARCHAR(8)   NOT NULL DEFAULT 'CNY',
  provider     VARCHAR(20)  NOT NULL DEFAULT 'xunhupay',  -- 'xunhupay' | 'manual'
  provider_txn VARCHAR(128),                       -- 支付平台流水号(notify 回填)
  pay_channel  VARCHAR(12),                        -- 'alipay' | 'wechat' | NULL
  status       VARCHAR(12)  NOT NULL DEFAULT 'pending',   -- pending|paid|expired|failed
  raw_notify   JSONB,                              -- notify 原文(审计/排障)
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  paid_at      TIMESTAMPTZ,
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_membership_orders_user   ON membership_orders(wca_id, created_at DESC);
CREATE INDEX idx_membership_orders_status ON membership_orders(status, created_at DESC);
CREATE TRIGGER membership_orders_updated_at BEFORE UPDATE ON membership_orders
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

-- ── 会员(每用户一行,当前生效套餐 + 到期)──
CREATE TABLE memberships (
  wca_id        VARCHAR(20)  PRIMARY KEY,
  name          VARCHAR(200) NOT NULL DEFAULT '',
  avatar_url    TEXT,
  plan_slug     VARCHAR(40)  NOT NULL,             -- 最近一次开通的套餐
  started_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ,                       -- NULL = 永久
  source        VARCHAR(20)  NOT NULL DEFAULT 'xunhupay',  -- xunhupay|manual
  last_order_no VARCHAR(64),
  contact       VARCHAR(200),                      -- 用户自填:续费/找回联系方式
  contact_kind  VARCHAR(12),                       -- 'email'|'wechat'|'qq'|...
  note          TEXT,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_memberships_expires ON memberships(expires_at);
CREATE TRIGGER memberships_updated_at BEFORE UPDATE ON memberships
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

-- seed:月/年/永久(价格占位 —— ¥10 / ¥99 / ¥299,上线前自行调整或 admin 改)。
INSERT INTO membership_plans (slug, name_zh, name_en, period, period_count, price_cents, sort, perks) VALUES
  ('monthly',  '月度会员', 'Monthly',  'month',    1,  1000, 10, '["badge","early","thanks"]'::jsonb),
  ('yearly',   '年度会员', 'Yearly',   'year',     1,  9900, 20, '["badge","early","thanks"]'::jsonb),
  ('lifetime', '永久会员', 'Lifetime', 'lifetime', 1, 29900, 30, '["badge","early","thanks","lifetime"]'::jsonb);
