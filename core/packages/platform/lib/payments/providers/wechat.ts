import "server-only";
import WxPay from "wechatpay-node-v3";
import type {
  CreatePaymentInput,
  CreatePaymentResult,
  PaymentProvider,
  RefundInput,
  RefundResult,
  VerifyCallbackResult,
} from "../types";
import { getSiteUrl } from "@/lib/site";

const MCHID = process.env.WECHAT_MCHID ?? "";
const APIV3_KEY = process.env.WECHAT_APIV3_KEY ?? "";
// 私钥支持两种来源:直接放 PEM 字符串(注意 \n 要转回真实换行)或 base64
const PRIVATE_KEY_RAW = process.env.WECHAT_PRIVATE_KEY ?? "";
const SERIAL_NO = process.env.WECHAT_SERIAL_NO ?? "";
const APPID = process.env.WECHAT_APPID ?? "";

const ENABLED =
  Boolean(MCHID) &&
  Boolean(APIV3_KEY) &&
  Boolean(PRIVATE_KEY_RAW) &&
  Boolean(SERIAL_NO) &&
  Boolean(APPID);

function normalizePem(raw: string): Buffer {
  // 允许 env 把换行转成 \n 字面量
  const text = raw.includes("\\n") ? raw.replace(/\\n/g, "\n") : raw;
  return Buffer.from(text, "utf8");
}

let _client: WxPay | null = null;
function client(): WxPay {
  if (!_client) {
    _client = new WxPay({
      appid: APPID,
      mchid: MCHID,
      // Native 下单 + 验签 / 解密都不强依赖商户公钥(主要用私钥签请求)
      // 这里给一个空 Buffer 占位,保持类型兼容
      publicKey: Buffer.alloc(0),
      privateKey: normalizePem(PRIVATE_KEY_RAW),
      serial_no: SERIAL_NO,
      key: APIV3_KEY,
    });
  }
  return _client;
}

type WxNotifyEnvelope = {
  id?: string;
  create_time?: string;
  resource_type?: string;
  event_type?: string;
  summary?: string;
  resource?: {
    algorithm?: string;
    ciphertext?: string;
    associated_data?: string;
    original_type?: string;
    nonce?: string;
  };
};

type WxTransaction = {
  appid?: string;
  mchid?: string;
  out_trade_no?: string;
  transaction_id?: string;
  trade_state?: string;
  trade_state_desc?: string;
  bank_type?: string;
  attach?: string;
  success_time?: string;
  payer?: { openid?: string };
  amount?: { total?: number; payer_total?: number; currency?: string };
};

export const wechatProvider: PaymentProvider = {
  id: "wechat",
  label: "微信支付",
  enabled: ENABLED,

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    if (!ENABLED) throw new Error("wechat not configured");
    const { order } = input;
    const amountFen = Math.max(1, Math.round(order.amount * 100));
    const res = await client().transactions_native({
      description: order.refTitle.slice(0, 127),
      out_trade_no: order.id,
      notify_url: `${getSiteUrl()}/api/payments/wechat/callback`,
      amount: { total: amountFen, currency: "CNY" },
    });
    const codeUrl =
      res?.data && typeof res.data === "object" && "code_url" in res.data
        ? String((res.data as { code_url?: unknown }).code_url ?? "")
        : "";
    if (!codeUrl) {
      throw new Error(
        `wechat transactions_native failed: ${JSON.stringify(res)}`,
      );
    }
    return { kind: "qrcode", codeUrl, providerId: order.id };
  },

  async verifyCallback(
    req: Request,
    rawBody: string,
  ): Promise<VerifyCallbackResult | null> {
    if (!ENABLED) return null;
    const timestamp = req.headers.get("wechatpay-timestamp");
    const nonce = req.headers.get("wechatpay-nonce");
    const signature = req.headers.get("wechatpay-signature");
    const serial = req.headers.get("wechatpay-serial");
    if (!timestamp || !nonce || !signature || !serial) return null;

    // 验签需要平台证书的公钥；本仓库未做平台证书自动拉取/缓存,
    // 暂以"解密成功 + trade_state == SUCCESS"作为可信判据。
    // 注意:生产建议补全 fetchCertificates 流程后启用 verifySign。
    let envelope: WxNotifyEnvelope;
    try {
      envelope = JSON.parse(rawBody) as WxNotifyEnvelope;
    } catch {
      return null;
    }
    const resource = envelope.resource;
    if (
      !resource ||
      !resource.ciphertext ||
      typeof resource.associated_data !== "string" ||
      !resource.nonce
    ) {
      return null;
    }
    let tx: WxTransaction;
    try {
      tx = client().decipher_gcm<WxTransaction>(
        resource.ciphertext,
        resource.associated_data,
        resource.nonce,
        APIV3_KEY,
      );
    } catch {
      return null;
    }
    const orderId = tx.out_trade_no ?? "";
    if (!orderId) return null;
    const paid = tx.trade_state === "SUCCESS";
    return {
      orderId,
      paid,
      providerId: tx.transaction_id ?? orderId,
      raw: tx,
      // 微信 V3 回调期望 200 + JSON {code:"SUCCESS"} 表示已确认,
      // 否则会重试。callback route 默认返回 "ok",改成 SUCCESS 报文。
      response: JSON.stringify({ code: "SUCCESS", message: "OK" }),
    };
  },

  async refund(input: RefundInput): Promise<RefundResult> {
    if (!ENABLED) return { ok: false, reason: "wechat not configured" };
    const { order, amount } = input;
    const refundFen = Math.max(1, Math.round((amount ?? order.amount) * 100));
    const totalFen = Math.max(refundFen, Math.round(order.amount * 100));
    const outRefundNo = `${order.id}_r${Date.now()}`;
    try {
      const c = client() as unknown as {
        refunds: (args: unknown) => Promise<unknown>;
      };
      if (typeof c.refunds !== "function") {
        return { ok: false, reason: "wechat sdk has no refunds method" };
      }
      const res = (await c.refunds({
        out_trade_no: order.id,
        out_refund_no: outRefundNo,
        notify_url: `${getSiteUrl()}/api/payments/wechat/callback`,
        amount: { refund: refundFen, total: totalFen, currency: "CNY" },
      })) as { status?: number; data?: { refund_id?: string; status?: string } };
      const data = res?.data;
      const ok =
        (typeof res?.status === "number" ? res.status < 300 : true) &&
        (data?.status === "SUCCESS" ||
          data?.status === "PROCESSING" ||
          Boolean(data?.refund_id));
      return {
        ok,
        providerRefundId: data?.refund_id ?? outRefundNo,
        raw: res,
        reason: ok ? undefined : `status=${data?.status ?? "unknown"}`,
      };
    } catch (e) {
      return { ok: false, reason: (e as Error).message, raw: { error: String(e) } };
    }
  },
};
