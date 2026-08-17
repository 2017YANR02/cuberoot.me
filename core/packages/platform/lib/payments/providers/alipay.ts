import "server-only";
import { AlipaySdk } from "alipay-sdk";
import type {
  CreatePaymentInput,
  CreatePaymentResult,
  PaymentProvider,
  RefundInput,
  RefundResult,
  VerifyCallbackResult,
} from "../types";
import { getSiteUrl } from "@/lib/site";

const APP_ID = process.env.ALIPAY_APP_ID ?? "";
const PRIVATE_KEY_RAW = process.env.ALIPAY_PRIVATE_KEY ?? "";
const PUBLIC_KEY_RAW = process.env.ALIPAY_PUBLIC_KEY ?? "";

const ENABLED =
  Boolean(APP_ID) && Boolean(PRIVATE_KEY_RAW) && Boolean(PUBLIC_KEY_RAW);

function normalizeKey(raw: string): string {
  return raw.includes("\\n") ? raw.replace(/\\n/g, "\n") : raw;
}

let _sdk: AlipaySdk | null = null;
function sdk(): AlipaySdk {
  if (!_sdk) {
    _sdk = new AlipaySdk({
      appId: APP_ID,
      privateKey: normalizeKey(PRIVATE_KEY_RAW),
      alipayPublicKey: normalizeKey(PUBLIC_KEY_RAW),
      signType: "RSA2",
      gateway: "https://openapi.alipay.com/gateway.do",
      keyType: "PKCS8",
    });
  }
  return _sdk;
}

export const alipayProvider: PaymentProvider = {
  id: "alipay",
  label: "支付宝",
  enabled: ENABLED,

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    if (!ENABLED) throw new Error("alipay not configured");
    const { order, returnUrl } = input;
    const totalAmount = (order.amount || 0).toFixed(2);
    // pageExecute 返回一个 GET 完整跳转 URL,可直接 302 给浏览器
    const url = sdk().pageExecute("alipay.trade.page.pay", "GET", {
      notify_url: `${getSiteUrl()}/api/payments/alipay/callback`,
      return_url: returnUrl,
      bizContent: {
        out_trade_no: order.id,
        product_code: "FAST_INSTANT_TRADE_PAY",
        total_amount: totalAmount,
        subject: order.refTitle.slice(0, 256),
      },
    });
    return { kind: "redirect", url, providerId: order.id };
  },

  async verifyCallback(
    _req: Request,
    rawBody: string,
  ): Promise<VerifyCallbackResult | null> {
    if (!ENABLED) return null;
    // 支付宝异步通知是 x-www-form-urlencoded
    const params = new URLSearchParams(rawBody);
    const postData: Record<string, string> = {};
    for (const [k, v] of params.entries()) {
      postData[k] = v;
    }
    if (Object.keys(postData).length === 0) return null;
    let ok = false;
    try {
      ok = sdk().checkNotifySignV2(postData);
    } catch {
      ok = false;
    }
    if (!ok) return null;
    const orderId = postData["out_trade_no"] ?? "";
    if (!orderId) return null;
    const tradeStatus = postData["trade_status"] ?? "";
    const paid =
      tradeStatus === "TRADE_SUCCESS" || tradeStatus === "TRADE_FINISHED";
    return {
      orderId,
      paid,
      providerId: postData["trade_no"] ?? orderId,
      raw: postData,
      // 支付宝严格要求返回字符串 "success" 才不重试
      response: "success",
    };
  },

  async refund(input: RefundInput): Promise<RefundResult> {
    if (!ENABLED) return { ok: false, reason: "alipay not configured" };
    const { order, amount } = input;
    const refundAmount = (amount ?? order.amount ?? 0).toFixed(2);
    const outRequestNo = `${order.id}_r${Date.now()}`;
    try {
      const res = (await sdk().exec("alipay.trade.refund", {
        bizContent: {
          out_trade_no: order.id,
          refund_amount: refundAmount,
          out_request_no: outRequestNo,
        },
      })) as { code?: string; msg?: string; trade_no?: string; fund_change?: string };
      const ok = res?.code === "10000";
      return {
        ok,
        providerRefundId: res?.trade_no ?? outRequestNo,
        raw: res,
        reason: ok ? undefined : `code=${res?.code} msg=${res?.msg}`,
      };
    } catch (e) {
      return { ok: false, reason: (e as Error).message, raw: { error: String(e) } };
    }
  },
};
