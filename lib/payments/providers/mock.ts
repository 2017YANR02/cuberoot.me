import "server-only";
import type { PaymentProvider } from "../types";

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

export const mockWechat: PaymentProvider = {
  id: "mock_wechat",
  label: "微信支付（模拟）",
  enabled: true,
  async createPayment() {
    return { kind: "done", paidAt: nowSec() };
  },
  async verifyCallback() {
    return null;
  },
  async refund({ order, amount }) {
    return {
      ok: true,
      providerRefundId: "mock_" + Date.now(),
      raw: { orderId: order.id, amount: amount ?? order.amount, kind: "mock_refund" },
    };
  },
};

export const mockAlipay: PaymentProvider = {
  id: "mock_alipay",
  label: "支付宝（模拟）",
  enabled: true,
  async createPayment() {
    return { kind: "done", paidAt: nowSec() };
  },
  async verifyCallback() {
    return null;
  },
  async refund({ order, amount }) {
    return {
      ok: true,
      providerRefundId: "mock_" + Date.now(),
      raw: { orderId: order.id, amount: amount ?? order.amount, kind: "mock_refund" },
    };
  },
};
