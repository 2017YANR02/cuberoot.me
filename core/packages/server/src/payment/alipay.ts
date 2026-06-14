/**
 * 官方支付宝 —— 电脑网站支付 (alipay.trade.page.pay) + 手机网站支付 (alipay.trade.wap.pay)。
 * 公钥模式(非证书模式):商户应用私钥签名,支付宝公钥验签。RSA2 = SHA256withRSA。
 *
 * 资质:营业执照 + 已 ICP 备案的网站即可申请(个人独资企业可开)。沙箱网关见 .env.example。
 * 待签/待验串构造在 @cuberoot/shared/payment(纯函数,有单测);本模块只做 node:crypto 加/验签 + HTTP。
 */
import { createSign, createVerify } from 'node:crypto';
import { buildAlipaySignContent, type SignParams } from '@cuberoot/shared/payment';

const GATEWAY = process.env.ALIPAY_GATEWAY || 'https://openapi.alipay.com/gateway.do';
const APP_ID = process.env.ALIPAY_APP_ID || '';
const APP_PRIVATE_KEY = normalizePem(process.env.ALIPAY_PRIVATE_KEY || '', 'PRIVATE KEY');
const ALIPAY_PUBLIC_KEY = normalizePem(process.env.ALIPAY_PUBLIC_KEY || '', 'PUBLIC KEY');

export function alipayConfigured(): boolean {
  return Boolean(APP_ID && APP_PRIVATE_KEY && ALIPAY_PUBLIC_KEY);
}

// env 里的 key 既可能是单行 base64(无头无尾),也可能是带 PEM 头尾(可能用字面 \n 转义)。统一成标准 PEM。
function normalizePem(raw: string, type: 'PRIVATE KEY' | 'PUBLIC KEY'): string {
  const s = raw.trim();
  if (!s) return '';
  if (s.includes('-----BEGIN')) return s.replace(/\\n/g, '\n');
  const body = s.replace(/\s+/g, '').match(/.{1,64}/g)?.join('\n') ?? s;
  return `-----BEGIN ${type}-----\n${body}\n-----END ${type}-----`;
}

function centsToYuan(cents: number): string {
  return (cents / 100).toFixed(2);
}

// 支付宝要求 timestamp 形如 'yyyy-MM-dd HH:mm:ss'(北京时间)。
function beijingTimestamp(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`;
}

function sign(content: string): string {
  return createSign('RSA-SHA256').update(content, 'utf8').sign(APP_PRIVATE_KEY, 'base64');
}

/** 组装并签名一笔网站支付,返回可让浏览器直接打开/跳转的收银台 GET URL。 */
export function createAlipayCheckoutUrl(opts: {
  outTradeNo: string;
  amountCents: number;
  subject: string;
  clientType: 'pc' | 'wap';
  notifyUrl: string;
  returnUrl: string;
}): string {
  const method = opts.clientType === 'wap' ? 'alipay.trade.wap.pay' : 'alipay.trade.page.pay';
  const productCode = opts.clientType === 'wap' ? 'QUICK_WAP_WAY' : 'FAST_INSTANT_TRADE_PAY';
  const bizContent = JSON.stringify({
    out_trade_no: opts.outTradeNo,
    total_amount: centsToYuan(opts.amountCents),
    subject: opts.subject,
    product_code: productCode,
    timeout_express: '15m',
  });

  const params: SignParams = {
    app_id: APP_ID,
    method,
    format: 'JSON',
    charset: 'utf-8',
    sign_type: 'RSA2',
    timestamp: beijingTimestamp(),
    version: '1.0',
    notify_url: opts.notifyUrl,
    return_url: opts.returnUrl,
    biz_content: bizContent,
  };
  // 请求签名:排除 sign(sign_type 参与签名)。
  params.sign = sign(buildAlipaySignContent(params, ['sign']));

  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) usp.set(k, String(v));
  }
  return `${GATEWAY}?${usp.toString()}`;
}

/** 异步通知验签:排除 sign / sign_type,其余按 key 升序拼接,用支付宝公钥验 RSA2。 */
export function verifyAlipayNotify(params: SignParams & { sign?: string; sign_type?: string }): boolean {
  const given = params.sign;
  if (typeof given !== 'string' || given.length === 0) return false;
  const content = buildAlipaySignContent(params, ['sign', 'sign_type']);
  try {
    return createVerify('RSA-SHA256').update(content, 'utf8').verify(ALIPAY_PUBLIC_KEY, given, 'base64');
  } catch {
    return false;
  }
}

/** 主动查单(轮询补偿)。返回 paid / 平台流水号。出错返回 null。 */
export async function queryAlipayTrade(
  outTradeNo: string,
): Promise<{ paid: boolean; txn?: string; raw: unknown } | null> {
  const params: SignParams = {
    app_id: APP_ID,
    method: 'alipay.trade.query',
    format: 'JSON',
    charset: 'utf-8',
    sign_type: 'RSA2',
    timestamp: beijingTimestamp(),
    version: '1.0',
    biz_content: JSON.stringify({ out_trade_no: outTradeNo }),
  };
  params.sign = sign(buildAlipaySignContent(params, ['sign']));

  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) usp.set(k, String(v));
  }

  let data: Record<string, unknown>;
  try {
    const res = await fetch(GATEWAY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body: usp.toString(),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
  // 出站请求经 TLS 直连支付宝,响应可信,这里不再校验响应签名(与查单补偿定位一致)。
  const resp = (data.alipay_trade_query_response ?? {}) as Record<string, unknown>;
  const status = String(resp.trade_status ?? '').toUpperCase();
  return {
    paid: status === 'TRADE_SUCCESS' || status === 'TRADE_FINISHED',
    txn: typeof resp.trade_no === 'string' ? resp.trade_no : undefined,
    raw: data,
  };
}
