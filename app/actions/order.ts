"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth-user";
import { logError } from "@/lib/db/logs";

function isNextControlFlow(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const digest = (e as { digest?: unknown }).digest;
  if (typeof digest !== "string") return false;
  return digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND");
}
import { findById as findCourse } from "@/lib/db/courses";
import { findById as findProduct } from "@/lib/db/products";
import { findById as findEvent } from "@/lib/db/events";
import {
  cancel as cancelOrder,
  create as createOrder,
  findByIdForUser,
  markPaid,
  setPendingQrCode,
} from "@/lib/db/orders";
import {
  findActive as findActiveCoupon,
  incrementUses as incrementCouponUses,
  REJECTION_MSG,
  type CouponResult,
} from "@/lib/db/coupons";
import type { OrderType, PaymentMethod } from "@/db/schema";
import { getProvider } from "@/lib/payments/registry";
import type { ProviderId } from "@/lib/payments/types";
import { getSiteUrl } from "@/lib/site";

type PlaceInput = {
  type: OrderType;
  refId: string;
  qty?: number;
  couponCode?: string | null;
};

async function resolveRef(
  type: OrderType,
  refId: string,
): Promise<{ title: string; price: number } | null> {
  if (type === "course") {
    const c = await findCourse(refId);
    return c ? { title: c.title, price: c.price } : null;
  }
  if (type === "product") {
    const p = await findProduct(refId);
    return p ? { title: p.name, price: p.price } : null;
  }
  const e = await findEvent(refId);
  return e ? { title: e.title, price: e.fee } : null;
}

export async function placeOrder(input: PlaceInput): Promise<void> {
  try {
    return await placeOrderImpl(input);
  } catch (e) {
    if (isNextControlFlow(e)) throw e;
    const err = e as Error;
    await logError({
      level: "error",
      message: `placeOrder:${err.message}`,
      stack: err.stack,
      path: "actions/order/placeOrder",
    });
    throw e;
  }
}

async function placeOrderImpl(input: PlaceInput): Promise<void> {
  const user = await getCurrentUser();
  if (!user) {
    const next = orderEntryPath(input.type, input.refId);
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }
  const ref = await resolveRef(input.type, input.refId);
  if (!ref) {
    redirect(orderEntryPath(input.type, input.refId) + "?error=not_found");
  }
  const qty = Math.max(1, Math.floor(input.qty ?? 1));
  const gross = ref.price * qty;

  let discount = 0;
  let couponCode: string | null = null;
  const rawCoupon = (input.couponCode ?? "").trim();
  if (rawCoupon) {
    const r = await findActiveCoupon(rawCoupon, input.type, gross);
    if (r.ok) {
      discount = r.discount;
      couponCode = r.coupon.code;
    } else {
      redirect(
        orderEntryPath(input.type, input.refId) +
          `?error=coupon&reason=${encodeURIComponent(r.reason)}`,
      );
    }
  }

  const amount = Math.max(0, gross - discount);

  const order = await createOrder({
    userId: user.id,
    type: input.type,
    refId: input.refId,
    refTitle: ref.title,
    qty,
    amount,
    discount,
    couponCode,
    paymentMethod: null,
    paidAt: null,
  });
  if (couponCode) {
    await incrementCouponUses(couponCode);
  }
  revalidatePath("/orders");
  redirect(`/orders/${order.id}`);
}

export async function placeOrderFromForm(f: FormData): Promise<void> {
  const type = String(f.get("type") ?? "") as OrderType;
  const refId = String(f.get("refId") ?? "");
  const qtyRaw = f.get("qty");
  const qty = qtyRaw ? Number(qtyRaw) : 1;
  const couponCode = String(f.get("couponCode") ?? "").trim() || null;
  if (!type || !refId) {
    redirect("/");
  }
  await placeOrder({ type, refId, qty, couponCode });
}

export type CouponPreview =
  | { ok: true; code: string; gross: number; discount: number; payable: number; label: string }
  | { ok: false; reason: string; message: string };

export async function previewCoupon(args: {
  type: OrderType;
  refId: string;
  qty?: number;
  code: string;
}): Promise<CouponPreview> {
  const ref = await resolveRef(args.type, args.refId);
  if (!ref) return { ok: false, reason: "ref_not_found", message: "商品不存在" };
  const qty = Math.max(1, Math.floor(args.qty ?? 1));
  const gross = ref.price * qty;
  const code = args.code.trim();
  if (!code) return { ok: false, reason: "empty", message: "请输入优惠码" };
  const r: CouponResult = await findActiveCoupon(code, args.type, gross);
  if (!r.ok) {
    return { ok: false, reason: r.reason, message: REJECTION_MSG[r.reason] };
  }
  const label =
    r.coupon.discountType === "fixed"
      ? `立减 ¥${r.coupon.discountValue}`
      : `${r.coupon.discountValue}% off`;
  return {
    ok: true,
    code: r.coupon.code,
    gross,
    discount: r.discount,
    payable: r.payable,
    label,
  };
}

const VALID_PROVIDER_IDS: ProviderId[] = [
  "mock_wechat",
  "mock_alipay",
  "stripe",
  "wechat",
  "alipay",
];

export async function startPayment(orderId: string, providerId: ProviderId): Promise<void> {
  try {
    return await startPaymentImpl(orderId, providerId);
  } catch (e) {
    if (isNextControlFlow(e)) throw e;
    const err = e as Error;
    await logError({
      level: "error",
      message: `startPayment:${providerId}:${err.message}`,
      stack: err.stack,
      path: "actions/order/startPayment",
    });
    throw e;
  }
}

async function startPaymentImpl(orderId: string, providerId: ProviderId): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/orders/${orderId}`)}`);
  const order = await findByIdForUser(orderId, user.id);
  if (!order) redirect("/orders");
  if (order.status === "paid") {
    redirect(`/orders/${orderId}`);
  }
  if (order.status !== "pending") {
    redirect(`/orders/${orderId}`);
  }
  const provider = getProvider(providerId);
  if (!provider || !provider.enabled) {
    redirect(`/orders/${orderId}?error=provider_unavailable`);
  }
  const returnUrl = `${getSiteUrl()}/orders/${orderId}`;
  const result = await provider.createPayment({ order, returnUrl });
  if (result.kind === "done") {
    await markPaid(orderId, providerId as PaymentMethod);
    revalidatePath("/orders");
    revalidatePath(`/orders/${orderId}`);
    redirect(`/orders/${orderId}`);
  }
  if (result.kind === "redirect") {
    redirect(result.url);
  }
  if (result.kind === "qrcode") {
    await setPendingQrCode(orderId, result.providerId ?? orderId, result.codeUrl);
    revalidatePath(`/orders/${orderId}`);
    redirect(`/orders/${orderId}?pay=qrcode&provider=${providerId}`);
  }
  throw new Error("unsupported payment result");
}

export async function startPaymentFromForm(f: FormData): Promise<void> {
  const id = String(f.get("orderId") ?? "");
  const providerId = String(f.get("providerId") ?? "") as ProviderId;
  if (!id || !VALID_PROVIDER_IDS.includes(providerId)) {
    redirect("/orders");
  }
  await startPayment(id, providerId);
}

export async function mockPay(orderId: string, method: PaymentMethod): Promise<void> {
  await startPayment(orderId, method as ProviderId);
}

export async function mockPayFromForm(f: FormData): Promise<void> {
  const id = String(f.get("orderId") ?? "");
  const method = String(f.get("method") ?? "") as PaymentMethod;
  if (!id || (method !== "mock_wechat" && method !== "mock_alipay")) {
    redirect("/orders");
  }
  await startPayment(id, method as ProviderId);
}

export async function cancelOrderFromForm(f: FormData): Promise<void> {
  const id = String(f.get("orderId") ?? "");
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const order = await findByIdForUser(id, user.id);
  if (!order) redirect("/orders");
  if (order.status === "pending") {
    await cancelOrder(id);
  }
  revalidatePath("/orders");
  revalidatePath(`/orders/${id}`);
  redirect(`/orders/${id}`);
}

function orderEntryPath(type: OrderType, refId: string): string {
  if (type === "course") return `/courses/${refId}`;
  if (type === "product") return `/shop/${refId}`;
  return `/events/${refId}`;
}
