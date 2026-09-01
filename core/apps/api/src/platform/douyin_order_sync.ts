import { createHmac, timingSafeEqual } from 'node:crypto';
import { platformQuery, platformTransaction } from './db.js';
import { physicalBundleCredentialHash, revokePhysicalBundleInvite } from './physical_bundle.js';

const API_BASE = 'https://openapi-fxg.jinritemai.com';
const ORDER_METHOD = 'order.searchList';

interface DouyinConfig {
  appKey: string;
  appSecret: string;
  accessToken: string;
  shopId: string;
  productId: string;
  courseId: string;
  intervalMs: number;
  lookbackSeconds: number;
}

interface DouyinOrder {
  order_id?: string | number;
  shop_id?: string | number;
  pay_time?: string | number;
}

type DouyinWebhookResult = 'accepted' | 'disabled' | 'invalid_body' | 'unauthorized';

let activeConfig: DouyinConfig | null = null;
let triggerSync: (() => void) | null = null;

function sortedJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortedJsonValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, sortedJsonValue(child)]),
    );
  }
  return value;
}

export function doudianParamJson(params: Record<string, unknown>): string {
  return JSON.stringify(sortedJsonValue(params));
}

export function doudianSign(
  appKey: string,
  appSecret: string,
  paramJson: string,
  timestamp: string,
  method = ORDER_METHOD,
): string {
  const payload = `${appSecret}app_key${appKey}method${method}param_json${paramJson}timestamp${timestamp}v2${appSecret}`;
  return createHmac('sha256', appSecret).update(payload, 'utf8').digest('hex');
}

export function doudianEventSign(appId: string, appSecret: string, rawBody: string): string {
  return createHmac('sha256', appSecret)
    .update(`${appId}${rawBody}${appSecret}`, 'utf8')
    .digest('hex');
}

export function acceptDouyinOrderWebhook(
  rawBody: string,
  appId: string,
  eventSign: string,
): DouyinWebhookResult {
  if (!activeConfig || !triggerSync) return 'disabled';
  if (appId !== activeConfig.appKey || !/^[0-9a-f]{64}$/i.test(eventSign)) return 'unauthorized';
  const expected = doudianEventSign(appId, activeConfig.appSecret, rawBody);
  if (!timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(eventSign, 'hex'))) return 'unauthorized';

  let messages: unknown;
  try {
    messages = JSON.parse(rawBody);
  } catch {
    return 'invalid_body';
  }
  if (!Array.isArray(messages) || messages.length > 50) return 'invalid_body';

  const matchesShop = messages.some((message) => {
    if (!message || typeof message !== 'object') return false;
    const data = (message as { data?: unknown }).data;
    try {
      const parsed = typeof data === 'string' ? JSON.parse(data) as unknown : data;
      return Boolean(parsed && typeof parsed === 'object'
        && String((parsed as { shop_id?: unknown }).shop_id ?? '') === activeConfig?.shopId);
    } catch {
      return false;
    }
  });
  if (matchesShop) setTimeout(triggerSync, 0);
  return 'accepted';
}

function requiredEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function boundedIntegerEnv(name: string, fallback: number, min: number, max: number): number {
  const raw = requiredEnv(name);
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer from ${min} to ${max}`);
  }
  return value;
}

function loadConfig(): DouyinConfig | null {
  const names = [
    'DOUYIN_APP_KEY',
    'DOUYIN_APP_SECRET',
    'DOUYIN_ACCESS_TOKEN',
    'DOUYIN_SHOP_ID',
    'DOUYIN_COURSE_PRODUCT_ID',
    'DOUYIN_COURSE_ID',
  ] as const;
  const values = Object.fromEntries(names.map((name) => [name, requiredEnv(name)]));
  if (names.every((name) => !values[name])) return null;
  const missing = names.filter((name) => !values[name]);
  if (missing.length) throw new Error(`Missing ${missing.join(', ')}`);
  if (!/^\d+$/.test(values.DOUYIN_SHOP_ID!) || !/^\d+$/.test(values.DOUYIN_COURSE_PRODUCT_ID!)) {
    throw new Error('DOUYIN_SHOP_ID and DOUYIN_COURSE_PRODUCT_ID must contain digits only');
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(values.DOUYIN_COURSE_ID!)) {
    throw new Error('DOUYIN_COURSE_ID must be a UUID');
  }
  return {
    appKey: values.DOUYIN_APP_KEY!,
    appSecret: values.DOUYIN_APP_SECRET!,
    accessToken: values.DOUYIN_ACCESS_TOKEN!,
    shopId: values.DOUYIN_SHOP_ID!,
    productId: values.DOUYIN_COURSE_PRODUCT_ID!,
    courseId: values.DOUYIN_COURSE_ID!,
    intervalMs: boundedIntegerEnv('DOUYIN_SYNC_INTERVAL_MINUTES', 5, 5, 1_440) * 60_000,
    lookbackSeconds: boundedIntegerEnv('DOUYIN_SYNC_LOOKBACK_HOURS', 48, 1, 2_160) * 3_600,
  };
}

async function searchOrders(
  config: DouyinConfig,
  window: { start: number; end: number },
  afterSaleStatus: 'refund_success' | undefined,
  visit: (order: DouyinOrder) => Promise<void>,
): Promise<number> {
  let visited = 0;
  for (let page = 0; page < 500; page += 1) {
    const params = {
      ...(afterSaleStatus ? { after_sale_status_desc: afterSaleStatus } : {}),
      order_asc: true,
      order_by: 'update_time',
      page,
      product: config.productId,
      size: 100,
      update_time_end: window.end,
      update_time_start: window.start,
    };
    const paramJson = doudianParamJson(params);
    const timestamp = String(Math.floor(Date.now() / 1_000));
    const query = new URLSearchParams({
      access_token: config.accessToken,
      app_key: config.appKey,
      method: ORDER_METHOD,
      sign: doudianSign(config.appKey, config.appSecret, paramJson, timestamp),
      sign_method: 'hmac-sha256',
      timestamp,
      v: '2',
    });
    const response = await fetch(`${API_BASE}/order/searchList?${query}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: paramJson,
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`Douyin order API returned HTTP ${response.status}`);
    const body = await response.json() as {
      code?: number | string;
      msg?: string;
      sub_msg?: string;
      data?: { total?: number | string; shop_order_list?: DouyinOrder[] };
    };
    if (Number(body.code) !== 10_000) {
      throw new Error(`Douyin order API failed: ${body.sub_msg || body.msg || body.code || 'unknown error'}`);
    }
    const orders = Array.isArray(body.data?.shop_order_list) ? body.data.shop_order_list : [];
    for (const order of orders) await visit(order);
    visited += orders.length;
    const total = Number(body.data?.total ?? 0);
    if (orders.length < 100 || visited >= total) return visited;
  }
  throw new Error('Douyin order query exceeded the 50,000-order API limit; shorten the sync window');
}

function checkedOrder(order: DouyinOrder, shopId: string): { orderId: string; paid: boolean } {
  const orderId = String(order.order_id ?? '');
  const returnedShopId = String(order.shop_id ?? '');
  if (!/^\d+$/.test(orderId)) throw new Error('Douyin order response is missing a valid order_id');
  if (returnedShopId !== shopId) throw new Error('Douyin order response shop_id does not match DOUYIN_SHOP_ID');
  return { orderId, paid: Number(order.pay_time ?? 0) > 0 };
}

async function ensureOrderCredential(config: DouyinConfig, orderId: string): Promise<boolean> {
  const hash = physicalBundleCredentialHash(orderId);
  const tail = orderId.slice(-6);
  return platformTransaction(async (db) => {
    const inserted = await platformQuery<{ id: string }>(db, `
      INSERT INTO platform_invite_codes (
        code_hash, label, status, distribution_type, batch_reference,
        external_order_reference, max_redemptions, benefit_snapshot
      )
      SELECT decode($1, 'hex'), $2, 'active', 'physical_bundle', $3, $4, 1, $5::jsonb
      FROM platform_courses WHERE id = $6::uuid AND status IN ('published', 'unlisted')
      ON CONFLICT (code_hash) DO NOTHING
      RETURNING id::text
    `, [
      hash,
      `抖店订单 ${tail}`,
      `douyin:${config.shopId}:${config.productId}`,
      `douyin:${config.shopId}:***${tail}`,
      JSON.stringify({ courseId: config.courseId, source: 'douyin' }),
      config.courseId,
    ]);
    if (inserted[0]) return true;
    const existing = await platformQuery<{
      distribution_type: string; batch_reference: string | null; benefit_snapshot: Record<string, unknown>;
    }>(db, `
      SELECT distribution_type, batch_reference, benefit_snapshot
      FROM platform_invite_codes WHERE code_hash = decode($1, 'hex')
    `, [hash]);
    if (!existing[0]) throw new Error('Configured Douyin course is missing or not published');
    if (existing[0].distribution_type !== 'physical_bundle'
      || existing[0].batch_reference !== `douyin:${config.shopId}:${config.productId}`
      || existing[0].benefit_snapshot.courseId !== config.courseId) {
      throw new Error('Douyin order number conflicts with an existing invitation credential');
    }
    return false;
  });
}

async function revokeOrderCredential(config: DouyinConfig, orderId: string): Promise<boolean> {
  const hash = physicalBundleCredentialHash(orderId);
  return platformTransaction(async (db) => {
    const rows = await platformQuery<{ id: string; status: string }>(db, `
      SELECT id::text, status FROM platform_invite_codes
      WHERE code_hash = decode($1, 'hex') AND distribution_type = 'physical_bundle'
        AND batch_reference = $2
      FOR UPDATE
    `, [hash, `douyin:${config.shopId}:${config.productId}`]);
    const invite = rows[0];
    if (!invite || invite.status === 'revoked') return false;
    await revokePhysicalBundleInvite(db, invite.id, 'Douyin refund completed', {
      userId: null,
      ownerKey: 'integration:douyin-order-sync',
    });
    return true;
  });
}

async function syncOnce(config: DouyinConfig): Promise<void> {
  const end = Math.floor(Date.now() / 1_000);
  const window = { start: end - config.lookbackSeconds, end };
  let created = 0;
  let revoked = 0;
  await searchOrders(config, window, undefined, async (raw) => {
    const order = checkedOrder(raw, config.shopId);
    if (order.paid && await ensureOrderCredential(config, order.orderId)) created += 1;
  });
  await searchOrders(config, window, 'refund_success', async (raw) => {
    const order = checkedOrder(raw, config.shopId);
    if (await revokeOrderCredential(config, order.orderId)) revoked += 1;
  });
  console.log(`[douyin-order-sync] completed: created=${created}, revoked=${revoked}`);
}

export function startDouyinOrderSync(): void {
  let config: DouyinConfig | null;
  try {
    config = loadConfig();
  } catch (error) {
    console.error('[douyin-order-sync] disabled by invalid configuration:', error);
    return;
  }
  if (!config) return;
  activeConfig = config;
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      await syncOnce(config);
    } catch (error) {
      console.error('[douyin-order-sync] failed:', error);
    } finally {
      running = false;
    }
  };
  triggerSync = () => void run();
  // ponytail: one process-local lock is enough for today's single API instance; use a DB lease if replicas are added.
  setTimeout(() => {
    void run();
    setInterval(() => void run(), config.intervalMs);
  }, 30_000);
}
