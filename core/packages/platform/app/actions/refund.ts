"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { findById, setRefunded } from "@/lib/db/orders";
import { write as writePaymentLog } from "@/lib/db/payment-logs";
import { getProvider } from "@/lib/payments/registry";
import type { ProviderId } from "@/lib/payments/types";
import { logError } from "@/lib/db/logs";

function isNextControlFlow(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const digest = (e as { digest?: unknown }).digest;
  if (typeof digest !== "string") return false;
  return digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND");
}

async function requireAdmin(): Promise<void> {
  const c = await cookies();
  const token = c.get(SESSION_COOKIE)?.value;
  if (!verifySession(token)) {
    redirect("/admin/login");
  }
}

export async function refundOrder(
  orderId: string,
  reason?: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    return await refundOrderImpl(orderId, reason);
  } catch (e) {
    if (isNextControlFlow(e)) throw e;
    const err = e as Error;
    await logError({
      level: "error",
      message: `refundOrder:${err.message}`,
      stack: err.stack,
      path: "actions/refund/refundOrder",
    });
    return { ok: false, error: "internal_error" };
  }
}

async function refundOrderImpl(
  orderId: string,
  reason?: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  const order = await findById(orderId);
  if (!order) {
    return { ok: false, error: "order_not_found" };
  }
  if (order.status !== "paid") {
    return { ok: false, error: "not_paid" };
  }
  const providerId = (order.paymentMethod ?? "") as ProviderId;
  const provider = providerId ? getProvider(providerId) : null;
  if (!provider) {
    await writePaymentLog({
      orderId,
      providerId: providerId || "unknown",
      kind: "refund",
      payload: { ok: false, reason: "provider_not_found", note: reason ?? null },
    });
    return { ok: false, error: "provider_not_found" };
  }
  if (typeof provider.refund !== "function") {
    await writePaymentLog({
      orderId,
      providerId,
      kind: "refund",
      payload: { ok: false, reason: "refund_not_supported", note: reason ?? null },
    });
    return { ok: false, error: "refund_not_supported" };
  }
  const result = await provider.refund({ order, amount: order.amount });
  await writePaymentLog({
    orderId,
    providerId,
    kind: "refund",
    payload: {
      ok: result.ok,
      providerRefundId: result.providerRefundId ?? null,
      reason: result.reason ?? null,
      note: reason ?? null,
      raw: result.raw ?? null,
    },
  });
  if (!result.ok) {
    return { ok: false, error: result.reason ?? "refund_failed" };
  }
  await setRefunded(orderId, order.amount, result.providerRefundId, result.raw);
  revalidatePath("/admin/orders");
  revalidatePath("/admin/reconcile");
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  return { ok: true };
}

export async function refundOrderFromForm(f: FormData): Promise<void> {
  const id = String(f.get("orderId") ?? "");
  const reason = String(f.get("reason") ?? "") || undefined;
  if (!id) {
    redirect("/admin/orders");
  }
  const r = await refundOrder(id, reason);
  if (!r.ok) {
    const q = encodeURIComponent(r.error ?? "refund_failed");
    redirect(`/admin/orders?error=${q}&id=${encodeURIComponent(id)}`);
  }
  redirect(`/admin/orders?refunded=${encodeURIComponent(id)}`);
}
