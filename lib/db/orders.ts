import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Order, OrderInsert, OrderType, PaymentMethod } from "@/db/schema";
import { newOrderId } from "@/lib/auth-user";
import { onOrderPaid, onOrderRefunded } from "@/lib/db/order-fulfillment";

export type { Order, OrderType, PaymentMethod };

export type OrderWithUser = Order & {
  userPhone: string;
  userNickname: string;
};

export async function list(opts?: { userId?: string }): Promise<Order[]> {
  const q = db.select().from(schema.orders);
  const rows = opts?.userId
    ? q.where(eq(schema.orders.userId, opts.userId)).orderBy(desc(schema.orders.createdAt)).all()
    : q.orderBy(desc(schema.orders.createdAt)).all();
  return rows;
}

export async function listWithUser(): Promise<OrderWithUser[]> {
  const rows = db
    .select({
      order: schema.orders,
      userPhone: schema.users.phone,
      userNickname: schema.users.nickname,
    })
    .from(schema.orders)
    .leftJoin(schema.users, eq(schema.orders.userId, schema.users.id))
    .orderBy(desc(schema.orders.createdAt))
    .all();
  return rows.map((r) => ({
    ...r.order,
    userPhone: r.userPhone ?? "—",
    userNickname: r.userNickname ?? "—",
  }));
}

export async function findById(id: string): Promise<Order | undefined> {
  const rows = db
    .select()
    .from(schema.orders)
    .where(eq(schema.orders.id, id))
    .all();
  return rows[0];
}

export async function findByIdForUser(id: string, userId: string): Promise<Order | undefined> {
  const rows = db
    .select()
    .from(schema.orders)
    .where(and(eq(schema.orders.id, id), eq(schema.orders.userId, userId)))
    .all();
  return rows[0];
}

export async function create(values: Omit<OrderInsert, "id" | "createdAt" | "status">): Promise<Order> {
  const now = Math.floor(Date.now() / 1000);
  const v: OrderInsert = {
    ...values,
    id: newOrderId(),
    status: "pending",
    createdAt: now,
  };
  await db.insert(schema.orders).values(v);
  const row = await findById(v.id);
  if (!row) throw new Error("order create failed");
  return row;
}

export async function markPaid(id: string, method: PaymentMethod): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const before = await findById(id);
  await db
    .update(schema.orders)
    .set({ status: "paid", paymentMethod: method, paidAt: now })
    .where(eq(schema.orders.id, id));
  if (before && before.status !== "paid") {
    await onOrderPaid({ ...before, status: "paid", paymentMethod: method, paidAt: now });
  }
}

export async function markPaidWithProvider(
  id: string,
  method: PaymentMethod,
  providerId: string | null,
  raw: unknown,
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const before = await findById(id);
  await db
    .update(schema.orders)
    .set({
      status: "paid",
      paymentMethod: method,
      providerId: providerId,
      paymentRaw: raw,
      paidAt: now,
    })
    .where(eq(schema.orders.id, id));
  if (before && before.status !== "paid") {
    await onOrderPaid({
      ...before,
      status: "paid",
      paymentMethod: method,
      providerId,
      paymentRaw: raw,
      paidAt: now,
    });
  }
}

export async function cancel(id: string): Promise<void> {
  await db
    .update(schema.orders)
    .set({ status: "cancelled" })
    .where(eq(schema.orders.id, id));
}

export async function setRefunded(
  id: string,
  amount: number,
  providerRefundId?: string,
  raw?: unknown,
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const existing = await findById(id);
  const merged =
    existing && existing.paymentRaw && typeof existing.paymentRaw === "object"
      ? { ...(existing.paymentRaw as Record<string, unknown>), refund: raw ?? null, providerRefundId: providerRefundId ?? null }
      : { refund: raw ?? null, providerRefundId: providerRefundId ?? null };
  await db
    .update(schema.orders)
    .set({
      status: "refunded",
      refundedAt: now,
      refundAmount: amount,
      paymentRaw: merged,
    })
    .where(eq(schema.orders.id, id));
  if (existing && existing.status === "paid") {
    await onOrderRefunded(existing);
  }
}

/**
 * 把 qrcode 渠道的待支付二维码 URL 暂存到 paymentRaw,
 * 订单详情页用它渲染扫码。回调成功后会被 markPaidWithProvider 覆写。
 */
export async function setPendingQrCode(
  id: string,
  providerId: string,
  codeUrl: string,
): Promise<void> {
  await db
    .update(schema.orders)
    .set({
      providerId,
      paymentRaw: { codeUrl, kind: "qrcode", createdAt: Math.floor(Date.now() / 1000) },
    })
    .where(eq(schema.orders.id, id));
}

export function readPendingCodeUrl(order: Order): string | null {
  const raw = order.paymentRaw;
  if (raw && typeof raw === "object" && raw !== null && "codeUrl" in raw) {
    const v = (raw as { codeUrl?: unknown }).codeUrl;
    if (typeof v === "string" && v.length > 0) return v;
  }
  return null;
}
