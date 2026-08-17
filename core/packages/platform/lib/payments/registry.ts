import "server-only";
import type { PaymentProvider, ProviderId } from "./types";
import { mockWechat, mockAlipay } from "./providers/mock";
import { stripeProvider } from "./providers/stripe";
import { wechatProvider } from "./providers/wechat";
import { alipayProvider } from "./providers/alipay";

const ALL: PaymentProvider[] = [
  mockWechat,
  mockAlipay,
  stripeProvider,
  wechatProvider,
  alipayProvider,
];

export function getProvider(id: ProviderId): PaymentProvider | null {
  return ALL.find((p) => p.id === id) ?? null;
}

export function enabledProviders(): PaymentProvider[] {
  return ALL.filter((p) => p.enabled);
}

export function allProviders(): PaymentProvider[] {
  return ALL;
}
