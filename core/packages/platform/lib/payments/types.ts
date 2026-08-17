import "server-only";
import type { Order } from "@/db/schema";

export type ProviderId =
  | "mock_wechat"
  | "mock_alipay"
  | "stripe"
  | "wechat"
  | "alipay";

export type CreatePaymentInput = {
  order: Order;
  returnUrl: string;
};

export type CreatePaymentResult =
  | { kind: "redirect"; url: string; providerId?: string }
  | { kind: "qrcode"; codeUrl: string; providerId?: string }
  | { kind: "done"; paidAt: number };

export type VerifyCallbackResult = {
  orderId: string;
  paid: boolean;
  providerId?: string;
  raw?: unknown;
  /** 可选自定义响应体（如支付宝要求返回 "success" 才不重试） */
  response?: string;
};

export type RefundInput = {
  order: Order;
  /** 退款金额(与 order.amount 同单位,元整数);默认全额 */
  amount?: number;
};

export type RefundResult = {
  ok: boolean;
  providerRefundId?: string;
  raw?: unknown;
  reason?: string;
};

export interface PaymentProvider {
  id: ProviderId;
  label: string;
  enabled: boolean;
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  verifyCallback(
    req: Request,
    rawBody: string,
  ): Promise<VerifyCallbackResult | null>;
  refund?(input: RefundInput): Promise<RefundResult>;
}
