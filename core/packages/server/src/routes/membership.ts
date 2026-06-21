/**
 * /v1/membership — 会员订阅 (membership / subscription)。
 *
 * 身份沿用 WCA OAuth(wca_id),不建本站账号。按周期一次性付款(月/年/永久)+ 手动续费;
 * 国内个人/聚合支付拿不到自动代扣,故无 auto-renew(见 docs/MEMBERSHIP.md)。
 * 支付多 provider:官方支付宝 / 官方微信支付(有营业执照 + 备案)优先,虎皮椒聚合支付兜底;
 * 异步 notify 验签后入账;都未配置时 admin 仍可手动开通。渠道可用性由 /plans 的 channels 暴露。
 *
 *   GET    /v1/membership/plans                 — 公开:在售套餐 + payEnabled + channels
 *   GET    /v1/membership/me                    — 登录:本人会员状态
 *   PUT    /v1/membership/me/contact            — 登录:设置续费/找回联系方式
 *   POST   /v1/membership/orders                — 登录:对某套餐下单,返回支付链接/二维码
 *   GET    /v1/membership/orders/:no            — 登录(本人):查单(供前端轮询)
 *   POST   /v1/membership/notify/alipay         — 公开 webhook:官方支付宝异步回调入账
 *   POST   /v1/membership/notify/wechat         — 公开 webhook:官方微信支付 APIv3 回调入账
 *   POST   /v1/membership/notify/xunhupay       — 公开 webhook:虎皮椒异步回调入账
 *   POST   /v1/membership/admin/grant           — admin:手动开通/续期
 *   GET    /v1/membership/admin/list            — admin:会员 + 最近订单
 *   DELETE /v1/membership/admin/member/:wcaId   — admin:撤销会员
 *   PUT    /v1/membership/admin/plans/:slug     — admin:改套餐(价格/启用/文案/perks)
 *
 * Schema 见 migrations/0046_membership.sql。签名算法见 @cuberoot/shared/payment。
 */
import { Hono } from 'hono';
import type { Context } from 'hono';
import { createHash, randomUUID } from 'node:crypto';
import QRCode from 'qrcode';
import { query } from '../db/connection.js';
import { requireAuth, requireAdmin, checkRateLimit } from '../utils/recon_helpers.js';
import { signXunhupay, verifyXunhupaySign, type SignParams } from '@cuberoot/shared/payment';
import * as alipay from '../payment/alipay.js';
import * as wechat from '../payment/wechat.js';

export const membershipRoutes = new Hono();

// ── 配置(全部 env,缺则支付关闭,系统退化为「仅 admin 手动开通」)──
const XHP_GATEWAY = process.env.XUNHUPAY_GATEWAY || 'https://api.xunhupay.com/payment/do.html';
const XHP_QUERY = process.env.XUNHUPAY_QUERY || 'https://api.xunhupay.com/payment/query.html';
// notify_url / return_url 用的对外 origin(api 域;notify 必须 xunhupay 能访问到)。
const PUBLIC_API_ORIGIN = process.env.PUBLIC_API_ORIGIN || 'https://api.cuberoot.me';
const SITE_ORIGIN = process.env.PUBLIC_SITE_ORIGIN || 'https://cuberoot.me';

const md5 = (s: string) => createHash('md5').update(s, 'utf8').digest('hex');

// 虎皮椒渠道(微信/支付宝)是「账号(APPID)级」而非下单参数 —— 一个 APPID 对应一个渠道。
// 主 APPID 必填;若用户分别申请了微信、支付宝两个 APPID,可再填 WECHAT_/ALIPAY_ 覆盖,
// 下单时按 channel 选对应 creds,缺则回落主 APPID(单渠道账号即可两个按钮都走它)。
interface XhpCreds { appid: string; secret: string; }
const XHP_PRIMARY: XhpCreds = { appid: process.env.XUNHUPAY_APPID || '', secret: process.env.XUNHUPAY_APPSECRET || '' };
const XHP_WECHAT: XhpCreds | null = process.env.XUNHUPAY_WECHAT_APPID
  ? { appid: process.env.XUNHUPAY_WECHAT_APPID, secret: process.env.XUNHUPAY_WECHAT_APPSECRET || '' } : null;
const XHP_ALIPAY: XhpCreds | null = process.env.XUNHUPAY_ALIPAY_APPID
  ? { appid: process.env.XUNHUPAY_ALIPAY_APPID, secret: process.env.XUNHUPAY_ALIPAY_APPSECRET || '' } : null;

const xunhupayConfigured = () => Boolean(XHP_PRIMARY.appid && XHP_PRIMARY.secret);

// 一个渠道下单走哪个 provider:官方优先(支付宝 → alipay,微信 → wechat),否则虎皮椒兜底,都没配则 null。
type Provider = 'alipay' | 'wechat' | 'xunhupay';
function providerForChannel(channel: 'alipay' | 'wechat'): Provider | null {
  if (channel === 'alipay' && alipay.alipayConfigured()) return 'alipay';
  if (channel === 'wechat' && wechat.wechatConfigured()) return 'wechat';
  if (xunhupayConfigured()) return 'xunhupay';
  return null;
}
// 前端据此只显示可用渠道按钮。
function channelAvailability() {
  return { alipay: providerForChannel('alipay') != null, wechat: providerForChannel('wechat') != null };
}
const paymentConfigured = () =>
  alipay.alipayConfigured() || wechat.wechatConfigured() || xunhupayConfigured();

function credsFor(channel: string): XhpCreds {
  if (channel === 'wechat' && XHP_WECHAT?.appid) return XHP_WECHAT;
  if (channel === 'alipay' && XHP_ALIPAY?.appid) return XHP_ALIPAY;
  return XHP_PRIMARY;
}
// notify/响应验签:按回调里的 appid 选对应 secret(分渠道账号),回落主 secret。
function secretForAppid(appid: string | undefined): string {
  for (const cr of [XHP_PRIMARY, XHP_WECHAT, XHP_ALIPAY]) {
    if (cr?.appid && cr.appid === appid) return cr.secret;
  }
  return XHP_PRIMARY.secret;
}

const PLAN_SLUG_RE = /^[a-z0-9_]{1,40}$/;
const CONTACT_KINDS = new Set(['email', 'wechat', 'qq', 'phone', 'other']);

function getIp(c: Context): string {
  return c.req.header('X-Real-IP') ?? c.req.header('X-Forwarded-For') ?? '0.0.0.0';
}

// 我方单号:M + base36 时间 + 8 位随机,定长 ≤ 30,纯 ascii。
function genOutTradeNo(): string {
  return `M${Date.now().toString(36)}${randomUUID().replace(/-/g, '').slice(0, 8)}`;
}

// ── 类型(只列用到的列)──
interface PlanRow {
  slug: string;
  name_zh: string;
  name_en: string;
  period: string;
  period_count: number;
  price_cents: number;
  currency: string;
  perks: unknown;
  active?: boolean;
  sort?: number;
}
interface OrderRow {
  out_trade_no: string;
  wca_id: string;
  name: string;
  plan_slug: string;
  amount_cents: number;
  currency: string;
  provider: string;
  provider_txn: string | null;
  pay_channel: string | null;
  status: string;
  created_at: Date;
  paid_at: Date | null;
}
interface MembershipRow {
  wca_id: string;
  name: string;
  avatar_url: string | null;
  plan_slug: string;
  started_at: Date;
  expires_at: Date | null;
  source: string;
  last_order_no: string | null;
  contact: string | null;
  contact_kind: string | null;
  note: string | null;
}

function planToJson(p: PlanRow) {
  return {
    slug: p.slug,
    nameZh: p.name_zh,
    nameEn: p.name_en,
    period: p.period,
    periodCount: Number(p.period_count),
    priceCents: Number(p.price_cents),
    currency: p.currency,
    perks: Array.isArray(p.perks) ? p.perks : [],
  };
}

function isActive(expiresAt: Date | null): boolean {
  return expiresAt == null || new Date(expiresAt).getTime() > Date.now();
}

function membershipToJson(m: MembershipRow) {
  return {
    wcaId: m.wca_id,
    name: m.name,
    avatarUrl: m.avatar_url ?? undefined,
    planSlug: m.plan_slug,
    startedAt: m.started_at,
    expiresAt: m.expires_at, // null = 永久
    lifetime: m.expires_at == null,
    active: isActive(m.expires_at),
    source: m.source,
    contact: m.contact ?? undefined,
    contactKind: m.contact_kind ?? undefined,
  };
}

// period → make_interval 单位 token(白名单,杜绝注入)。
const PERIOD_UNIT: Record<string, string> = { month: 'months', year: 'years', week: 'weeks', day: 'days' };

/**
 * 开通/续期:计算新到期并 upsert。
 * - lifetime → expires_at = NULL(永久);
 * - 否则 base = GREATEST(now, 现有未过期到期) + period_count × period,过期则从 now 起算(不补退)。
 * 幂等性由调用方保证(只在订单从 pending→paid 翻转的那一次调用)。
 */
async function grantMembership(opts: {
  wcaId: string;
  name: string;
  avatarUrl?: string | null;
  plan: PlanRow;
  source: string;
  orderNo: string | null;
}): Promise<MembershipRow> {
  const { wcaId, name, plan, source, orderNo } = opts;
  let expiresAt: Date | null = null;

  if (plan.period !== 'lifetime') {
    const unit = PERIOD_UNIT[plan.period];
    if (!unit) throw new Error(`Validation: unknown plan period ${plan.period}`);
    const existing = await query<{ expires_at: Date | null }>(
      'SELECT expires_at FROM memberships WHERE wca_id = ?',
      [wcaId],
    );
    const cur = existing[0]?.expires_at ?? null;
    // 现有为永久则保持永久(永久买月卡不降级)。
    if (existing.length && cur == null) {
      expiresAt = null;
    } else {
      const r = await query<{ exp: Date }>(
        `SELECT (GREATEST(NOW(), COALESCE(?::timestamptz, NOW())) + make_interval(${unit} => ?))::timestamptz AS exp`,
        [cur, plan.period_count],
      );
      expiresAt = r[0].exp;
    }
  }

  const avatar = opts.avatarUrl ?? null;
  const rows = await query<MembershipRow>(
    `INSERT INTO memberships (wca_id, name, avatar_url, plan_slug, started_at, expires_at, source, last_order_no)
     VALUES (?, ?, ?, ?, NOW(), ?, ?, ?)
     ON CONFLICT (wca_id) DO UPDATE SET
       name          = EXCLUDED.name,
       avatar_url    = COALESCE(EXCLUDED.avatar_url, memberships.avatar_url),
       plan_slug     = EXCLUDED.plan_slug,
       expires_at    = EXCLUDED.expires_at,
       source        = EXCLUDED.source,
       last_order_no = EXCLUDED.last_order_no
     RETURNING *`,
    [wcaId, name, avatar, plan.slug, expiresAt, source, orderNo],
  );
  return rows[0];
}

// ─────────────────────────── 公开:套餐 ───────────────────────────
membershipRoutes.get('/membership/plans', async (c) => {
  c.header('Cache-Control', 'public, max-age=3600');
  const rows = await query<PlanRow>(
    `SELECT slug, name_zh, name_en, period, period_count, price_cents, currency, perks, sort
       FROM membership_plans WHERE active = TRUE ORDER BY sort, price_cents`,
  );
  return c.json({ plans: rows.map(planToJson), payEnabled: paymentConfigured(), channels: channelAvailability() });
});

// ─────────────────────────── 登录:本人状态 ───────────────────────────
membershipRoutes.get('/membership/me', async (c) => {
  c.header('Cache-Control', 'no-store');
  const user = await requireAuth(c);
  const rows = await query<MembershipRow>('SELECT * FROM memberships WHERE wca_id = ?', [user.wcaId]);
  return c.json({ membership: rows[0] ? membershipToJson(rows[0]) : null });
});

// 设置续费/找回联系方式(仅已有会员可设)。
membershipRoutes.put('/membership/me/contact', async (c) => {
  c.header('Cache-Control', 'no-store');
  checkRateLimit(getIp(c));
  const user = await requireAuth(c);
  const b = await c.req.json<{ contact?: string | null; contactKind?: string | null; note?: string | null }>();

  const contact = b.contact != null && b.contact !== '' ? String(b.contact).trim().slice(0, 200) : null;
  let kind: string | null = null;
  if (b.contactKind != null && b.contactKind !== '') {
    kind = String(b.contactKind).trim().toLowerCase();
    if (!CONTACT_KINDS.has(kind)) return c.json({ error: 'invalid contactKind' }, 400);
  }
  const note = b.note != null && b.note !== '' ? String(b.note).slice(0, 500) : null;

  const rows = await query<MembershipRow>(
    `UPDATE memberships SET contact = ?, contact_kind = ?, note = ? WHERE wca_id = ? RETURNING *`,
    [contact, kind, note, user.wcaId],
  );
  if (!rows.length) return c.json({ error: 'no membership' }, 404);
  return c.json({ membership: membershipToJson(rows[0]) });
});

// ─────────────────────────── 登录:下单 ───────────────────────────
membershipRoutes.post('/membership/orders', async (c) => {
  c.header('Cache-Control', 'no-store');
  checkRateLimit(getIp(c));
  const user = await requireAuth(c);
  const b = await c.req.json<{ plan?: string; channel?: string; clientType?: string }>();

  const planSlug = String(b.plan || '');
  if (!PLAN_SLUG_RE.test(planSlug)) return c.json({ error: 'invalid plan' }, 400);
  const plans = await query<PlanRow>('SELECT * FROM membership_plans WHERE slug = ? AND active = TRUE', [planSlug]);
  if (!plans.length) return c.json({ error: 'unknown plan' }, 400);
  const plan = plans[0];

  // 永久会员重复购买无意义。
  const cur = await query<MembershipRow>('SELECT * FROM memberships WHERE wca_id = ?', [user.wcaId]);
  if (cur.length && cur[0].expires_at == null) {
    return c.json({ error: 'already lifetime member' }, 409);
  }

  const channel: 'alipay' | 'wechat' = b.channel === 'wechat' ? 'wechat' : 'alipay';
  const clientType: 'pc' | 'wap' = b.clientType === 'wap' ? 'wap' : 'pc';
  const provider = providerForChannel(channel);
  if (!provider) {
    // 该渠道未配置(官方/虎皮椒都没开):不下单,提示走打赏 + 联系站长手动开通。
    return c.json({ error: 'payment not configured', payEnabled: false }, 503);
  }

  const outTradeNo = genOutTradeNo();
  await query(
    `INSERT INTO membership_orders (out_trade_no, wca_id, name, plan_slug, amount_cents, currency, provider, pay_channel, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [outTradeNo, user.wcaId, user.name, plan.slug, plan.price_cents, plan.currency, provider, channel],
  );

  try {
    const pay = await createPaymentOrder({ provider, channel, clientType, outTradeNo, plan, ip: getIp(c) });
    return c.json({ outTradeNo, channel, provider, ...pay });
  } catch (e) {
    await query(`UPDATE membership_orders SET status = 'failed' WHERE out_trade_no = ?`, [outTradeNo]);
    console.error(`[membership] create order (${provider}/${channel}) failed:`, e);
    return c.json({ error: 'failed to create payment order' }, 502);
  }
});

// 按 provider 派发下单。返回 { url?, qrcode? }:
//   - 支付宝官方:收银台 GET url(PC 新窗口打开 + 轮询,移动端直接跳转);
//   - 微信官方:PC 走 Native(code_url → 服务端生成二维码 PNG data-url),移动端走 H5(h5_url);
//   - 虎皮椒:收银台 url + 二维码图 url。
async function createPaymentOrder(opts: {
  provider: Provider;
  channel: 'alipay' | 'wechat';
  clientType: 'pc' | 'wap';
  outTradeNo: string;
  plan: PlanRow;
  ip: string;
}): Promise<{ url?: string; qrcode?: string }> {
  const title = `CubeRoot ${opts.plan.name_zh}`;
  const notifyBase = `${PUBLIC_API_ORIGIN}/v1/membership/notify`;
  const returnUrl = `${SITE_ORIGIN}/membership?paid=${opts.outTradeNo}`;

  if (opts.provider === 'alipay') {
    const url = alipay.createAlipayCheckoutUrl({
      outTradeNo: opts.outTradeNo,
      amountCents: opts.plan.price_cents,
      subject: title,
      clientType: opts.clientType,
      notifyUrl: `${notifyBase}/alipay`,
      returnUrl,
    });
    return { url };
  }

  if (opts.provider === 'wechat') {
    if (opts.clientType === 'wap') {
      const url = await wechat.createWechatH5({
        outTradeNo: opts.outTradeNo, amountCents: opts.plan.price_cents,
        description: title, notifyUrl: `${notifyBase}/wechat`, payerClientIp: opts.ip,
      });
      return { url };
    }
    const codeUrl = await wechat.createWechatNative({
      outTradeNo: opts.outTradeNo, amountCents: opts.plan.price_cents,
      description: title, notifyUrl: `${notifyBase}/wechat`,
    });
    const qrcode = await QRCode.toDataURL(codeUrl, { margin: 1, width: 240 });
    return { qrcode };
  }

  // xunhupay
  return createXunhupayOrder({ outTradeNo: opts.outTradeNo, amountCents: opts.plan.price_cents, title, channel: opts.channel });
}

// 查单(本人):前端轮询;仍 pending 且商户已配置时主动向 xunhupay 查一次补偿。
membershipRoutes.get('/membership/orders/:no', async (c) => {
  c.header('Cache-Control', 'no-store');
  const user = await requireAuth(c);
  const no = c.req.param('no');
  const rows = await query<OrderRow>('SELECT * FROM membership_orders WHERE out_trade_no = ?', [no]);
  if (!rows.length || rows[0].wca_id !== user.wcaId) return c.json({ error: 'not found' }, 404);
  let order = rows[0];

  if (order.status === 'pending' && paymentConfigured()) {
    try {
      const remote =
        order.provider === 'alipay' ? await alipay.queryAlipayTrade(no)
        : order.provider === 'wechat' ? await wechat.queryWechatOrder(no)
        : await queryXunhupayOrder(no, order.pay_channel || 'alipay');
      if (remote?.paid) {
        await settlePaidOrder(no, { provider_txn: remote.txn, raw: remote.raw });
        const fresh = await query<OrderRow>('SELECT * FROM membership_orders WHERE out_trade_no = ?', [no]);
        if (fresh.length) order = fresh[0];
      }
    } catch (e) {
      console.error('[membership] active query failed:', e);
    }
  }
  return c.json({ status: order.status, planSlug: order.plan_slug, payChannel: order.pay_channel });
});

// ─────────────────────────── 公开 webhook:xunhupay 异步回调 ───────────────────────────
membershipRoutes.post('/membership/notify/xunhupay', async (c) => {
  c.header('Cache-Control', 'no-store');
  const params = await readNotifyParams(c);

  // 未配置商户 → 一律拒绝入账(防止空 secret 下被伪造请求白嫖会员)。
  if (!xunhupayConfigured()) {
    console.error('[membership] xunhupay notify received but not configured — rejecting');
    return c.text('fail');
  }
  if (!verifyXunhupaySign(params, secretForAppid(params.appid ? String(params.appid) : undefined), md5)) {
    console.error('[membership] xunhupay notify bad signature');
    return c.text('fail');
  }

  const outTradeNo = String(params.trade_order_id || '');
  const paid = String(params.status || '').toUpperCase() === 'OD';
  if (!outTradeNo) return c.text('fail');

  if (paid) {
    await settlePaidOrder(outTradeNo, {
      provider_txn: String(params.transaction_id || params.open_order_id || ''),
      raw: params,
    });
  }
  // xunhupay 要求回 success 字面量,否则最多重试 6 次。
  return c.text('success');
});

// ─────────────── 公开 webhook:官方支付宝异步通知(form-encoded;RSA2 验签)───────────────
membershipRoutes.post('/membership/notify/alipay', async (c) => {
  c.header('Cache-Control', 'no-store');
  const params = await readNotifyParams(c);

  if (!alipay.alipayConfigured()) {
    console.error('[membership] alipay notify received but not configured — rejecting');
    return c.text('fail');
  }
  if (!alipay.verifyAlipayNotify(params)) {
    console.error('[membership] alipay notify bad signature');
    return c.text('fail');
  }

  const outTradeNo = String(params.out_trade_no || '');
  const status = String(params.trade_status || '').toUpperCase();
  const paid = status === 'TRADE_SUCCESS' || status === 'TRADE_FINISHED';
  if (!outTradeNo) return c.text('fail');

  if (paid) {
    await settlePaidOrder(outTradeNo, { provider_txn: String(params.trade_no || ''), raw: params });
  }
  // 支付宝要求回字面量 success,否则按策略重试。
  return c.text('success');
});

// ─────────────── 公开 webhook:官方微信支付 APIv3 回调(JSON;GCM 解密入账)───────────────
membershipRoutes.post('/membership/notify/wechat', async (c) => {
  c.header('Cache-Control', 'no-store');
  const rawBody = await c.req.text();

  if (!wechat.wechatConfigured()) {
    console.error('[membership] wechat notify received but not configured — rejecting');
    return c.json({ code: 'FAIL', message: 'not configured' }, 500);
  }
  const result = wechat.handleWechatCallback(rawBody, {
    timestamp: c.req.header('Wechatpay-Timestamp'),
    nonce: c.req.header('Wechatpay-Nonce'),
    signature: c.req.header('Wechatpay-Signature'),
  });
  if (!result.ok) {
    console.error('[membership] wechat callback verify/decrypt failed');
    return c.json({ code: 'FAIL', message: 'verify failed' }, 401);
  }
  if (result.paid && result.outTradeNo) {
    await settlePaidOrder(result.outTradeNo, { provider_txn: result.txn, raw: result.raw });
  }
  // 微信要求 2xx + {code:'SUCCESS'},否则会重试。
  return c.json({ code: 'SUCCESS' });
});

/**
 * 订单 pending → paid 的唯一翻转点(幂等)。
 * 用条件 UPDATE ... WHERE status='pending' RETURNING 锁定只翻转一次,再据此开通会员。
 */
async function settlePaidOrder(
  outTradeNo: string,
  info: { provider_txn?: string; pay_channel?: string | null; raw?: unknown },
): Promise<void> {
  const flipped = await query<OrderRow>(
    `UPDATE membership_orders
        SET status = 'paid', paid_at = NOW(),
            provider_txn = COALESCE(NULLIF(?, ''), provider_txn),
            raw_notify = ?::jsonb
      WHERE out_trade_no = ? AND status = 'pending'
      RETURNING *`,
    [info.provider_txn ?? '', info.raw != null ? JSON.stringify(info.raw) : null, outTradeNo],
  );
  if (!flipped.length) return; // 已结算过或不存在 → 幂等返回。

  const order = flipped[0];
  const plans = await query<PlanRow>('SELECT * FROM membership_plans WHERE slug = ?', [order.plan_slug]);
  if (!plans.length) {
    console.error(`[membership] paid order ${outTradeNo} references missing plan ${order.plan_slug}`);
    return;
  }
  await grantMembership({
    wcaId: order.wca_id,
    name: order.name,
    plan: plans[0],
    source: order.provider,
    orderNo: order.out_trade_no,
  });
  console.log(`[membership] granted ${order.plan_slug} to ${order.wca_id} via ${order.provider} (${outTradeNo})`);
}

// ─────────────────────────── admin ───────────────────────────
// 手动开通/续期(给已打赏用户或未配置商户时用)。
membershipRoutes.post('/membership/admin/grant', async (c) => {
  c.header('Cache-Control', 'no-store');
  await requireAdmin(c);
  const b = await c.req.json<{ wcaId?: string; plan?: string; name?: string; avatarUrl?: string | null }>();

  const wcaId = String(b.wcaId || '').trim().toUpperCase();
  if (!/^\d{4}[A-Z]{4}\d{2}$/.test(wcaId)) return c.json({ error: 'invalid WCA ID' }, 400);
  const planSlug = String(b.plan || '');
  if (!PLAN_SLUG_RE.test(planSlug)) return c.json({ error: 'invalid plan' }, 400);
  const plans = await query<PlanRow>('SELECT * FROM membership_plans WHERE slug = ?', [planSlug]);
  if (!plans.length) return c.json({ error: 'unknown plan' }, 400);

  const name = (b.name && b.name.trim()) || wcaId;
  const orderNo = genOutTradeNo();
  await query(
    `INSERT INTO membership_orders (out_trade_no, wca_id, name, plan_slug, amount_cents, currency, provider, status, paid_at)
     VALUES (?, ?, ?, ?, 0, 'CNY', 'manual', 'paid', NOW())`,
    [orderNo, wcaId, name, planSlug],
  );
  const m = await grantMembership({
    wcaId, name, avatarUrl: b.avatarUrl ?? null, plan: plans[0], source: 'manual', orderNo,
  });
  return c.json({ membership: membershipToJson(m) });
});

// 会员 + 最近订单(简单分页)。
membershipRoutes.get('/membership/admin/list', async (c) => {
  c.header('Cache-Control', 'no-store');
  await requireAdmin(c);
  const members = await query<MembershipRow>('SELECT * FROM memberships ORDER BY started_at DESC LIMIT 500');
  const orders = await query<OrderRow>(
    'SELECT out_trade_no, wca_id, name, plan_slug, amount_cents, provider, pay_channel, status, created_at, paid_at FROM membership_orders ORDER BY created_at DESC LIMIT 200',
  );
  return c.json({
    members: members.map(membershipToJson),
    orders: orders.map((o) => ({
      outTradeNo: o.out_trade_no, wcaId: o.wca_id, name: o.name, planSlug: o.plan_slug,
      amountCents: Number(o.amount_cents), provider: o.provider, payChannel: o.pay_channel,
      status: o.status, createdAt: o.created_at, paidAt: o.paid_at,
    })),
  });
});

// 撤销会员。
membershipRoutes.delete('/membership/admin/member/:wcaId', async (c) => {
  c.header('Cache-Control', 'no-store');
  await requireAdmin(c);
  const wcaId = String(c.req.param('wcaId')).trim().toUpperCase();
  const del = await query<{ wca_id: string }>('DELETE FROM memberships WHERE wca_id = ? RETURNING wca_id', [wcaId]);
  if (!del.length) return c.json({ error: 'not found' }, 404);
  return c.json({ ok: true });
});

// 改套餐(价格 / 启用 / 文案 / perks / 排序)。只更新传入字段。
membershipRoutes.put('/membership/admin/plans/:slug', async (c) => {
  c.header('Cache-Control', 'no-store');
  await requireAdmin(c);
  const slug = String(c.req.param('slug'));
  if (!PLAN_SLUG_RE.test(slug)) return c.json({ error: 'invalid slug' }, 400);
  const b = await c.req.json<{
    nameZh?: string; nameEn?: string; priceCents?: number; active?: boolean;
    sort?: number; perks?: unknown[]; period?: string; periodCount?: number;
  }>();

  const sets: string[] = [];
  const vals: unknown[] = [];
  const add = (col: string, v: unknown) => { sets.push(`${col} = ?`); vals.push(v); };
  if (b.nameZh != null) add('name_zh', String(b.nameZh).slice(0, 80));
  if (b.nameEn != null) add('name_en', String(b.nameEn).slice(0, 80));
  if (b.priceCents != null) {
    const n = Math.round(Number(b.priceCents));
    if (!Number.isFinite(n) || n < 0 || n > 100_000_00) return c.json({ error: 'invalid priceCents' }, 400);
    add('price_cents', n);
  }
  if (b.active != null) add('active', !!b.active);
  if (b.sort != null) add('sort', Math.round(Number(b.sort)) || 0);
  if (b.perks != null) add('perks', JSON.stringify(Array.isArray(b.perks) ? b.perks : []));
  if (b.period != null) {
    if (b.period !== 'lifetime' && !PERIOD_UNIT[b.period]) return c.json({ error: 'invalid period' }, 400);
    add('period', b.period);
  }
  if (b.periodCount != null) add('period_count', Math.max(1, Math.round(Number(b.periodCount)) || 1));
  if (!sets.length) return c.json({ error: 'nothing to update' }, 400);

  vals.push(slug);
  const rows = await query<PlanRow>(
    `UPDATE membership_plans SET ${sets.join(', ')} WHERE slug = ? RETURNING *`,
    vals,
  );
  if (!rows.length) return c.json({ error: 'not found' }, 404);
  return c.json(planToJson(rows[0]));
});

// ───────────────────── 虎皮椒(xunhupay)provider ─────────────────────
// NOTE: 请求/响应字段名以官方文档为准(docs/MEMBERSHIP.md 记录核对来源)。
//   total_fee 为「元」字符串(两位小数);time 为 unix 秒;notify_url 必须公网可达。
//   响应里取收银台 url 与二维码图 url_qrcode;notify 验签后回字面量 'success'。

function centsToYuan(cents: number): string {
  return (cents / 100).toFixed(2);
}

// xunhupay 用 `type=WAP` 走手机站收银台,缺省走 PC 扫码;支付宝/微信由商户在平台侧或 appid 区分。
// 这里下单时不强绑渠道(收银台让用户选),channel 仅作我方记录;若后续用分渠道 appid 再扩展。
async function postForm(url: string, params: SignParams): Promise<Record<string, unknown>> {
  const form = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) form.set(k, String(v));
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`xunhupay HTTP ${res.status}`);
  return (await res.json()) as Record<string, unknown>;
}

async function createXunhupayOrder(opts: {
  outTradeNo: string;
  amountCents: number;
  title: string;
  channel: string;
}): Promise<{ url?: string; qrcode?: string }> {
  const creds = credsFor(opts.channel);
  const params: SignParams = {
    version: '1.1',
    appid: creds.appid,
    trade_order_id: opts.outTradeNo,
    total_fee: centsToYuan(opts.amountCents), // 元(yuan)字符串,非分
    title: opts.title,                        // ≤42 汉字,禁 % / emoji
    time: Math.floor(Date.now() / 1000),      // unix 秒
    notify_url: `${PUBLIC_API_ORIGIN}/v1/membership/notify/xunhupay`,
    return_url: `${SITE_ORIGIN}/membership?paid=${opts.outTradeNo}`,
    nonce_str: randomUUID().replace(/-/g, ''),
    plugins: 'cuberoot',
  };
  params.hash = signXunhupay(params, creds.secret, md5);

  const data = await postForm(XHP_GATEWAY, params);
  const errcode = Number(data.errcode);
  if (Number.isFinite(errcode) && errcode !== 0) {
    throw new Error(`xunhupay errcode ${errcode}: ${String(data.errmsg ?? '')}`);
  }
  // 响应本身带 hash 签名;TLS 已护传输,这里不硬校验(留意签名串尾 & 的版本歧义),仅取字段。
  return {
    url: typeof data.url === 'string' ? data.url : undefined,            // 手机端跳转(自动判微信/H5)
    qrcode: typeof data.url_qrcode === 'string' ? data.url_qrcode : undefined, // PC 扫码(5 分钟有效)
  };
}

async function queryXunhupayOrder(
  outTradeNo: string,
  channel: string,
): Promise<{ paid: boolean; txn?: string; raw: unknown } | null> {
  const creds = credsFor(channel);
  const params: SignParams = {
    appid: creds.appid,
    out_trade_order: outTradeNo, // = 我方 trade_order_id
    time: Math.floor(Date.now() / 1000),
    nonce_str: randomUUID().replace(/-/g, ''),
  };
  params.hash = signXunhupay(params, creds.secret, md5);
  let data: Record<string, unknown>;
  try {
    data = await postForm(XHP_QUERY, params);
  } catch {
    return null;
  }
  // 状态在 data.data.status:OD=已支付,WP=待支付,CD=已取消/退款。
  const inner = (data.data ?? {}) as Record<string, unknown>;
  const status = String(inner.status ?? '').toUpperCase();
  return {
    paid: status === 'OD',
    txn: typeof inner.transaction_id === 'string' ? inner.transaction_id : undefined,
    raw: data,
  };
}

// notify 体:xunhupay 走表单(application/x-www-form-urlencoded);兜底再并入 query。
async function readNotifyParams(c: Context): Promise<SignParams & { hash?: string }> {
  const out: Record<string, string> = {};
  try {
    const body = await c.req.parseBody();
    for (const [k, v] of Object.entries(body)) {
      if (typeof v === 'string') out[k] = v;
    }
  } catch {
    // 非表单 → 尝试 JSON。
    try {
      const j = (await c.req.json()) as Record<string, unknown>;
      for (const [k, v] of Object.entries(j)) out[k] = String(v);
    } catch { /* ignore */ }
  }
  const url = new URL(c.req.url);
  url.searchParams.forEach((v, k) => { if (!(k in out)) out[k] = v; });
  return out;
}
