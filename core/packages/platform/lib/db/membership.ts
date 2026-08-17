import "server-only";
import { and, asc, desc, eq, gt } from "drizzle-orm";
import { db, schema } from "@/db";
import type { Membership, Order } from "@/db/schema";
import { newMembershipId } from "@/lib/auth-user";

export type { Membership };

// 会员套餐(价格单位:元,与 courses.price / events.fee 一致)。
// 一档会员在有效期内解锁全部付费课程(canAccessCourse 走 isMember 放行)。
export type MembershipPlan = {
  id: string; // 计划标识,同时作为下单 refId
  label: string;
  days: number;
  price: number;
  per: string; // 计费口径文案
  badge?: string; // 推荐角标
  highlight?: boolean;
};

export const MEMBERSHIP_PLANS: MembershipPlan[] = [
  { id: "monthly", label: "月度会员", days: 30, price: 49, per: "每月" },
  {
    id: "quarterly",
    label: "季度会员",
    days: 90,
    price: 129,
    per: "每季",
    badge: "省 ¥18",
    highlight: true,
  },
  { id: "yearly", label: "年度会员", days: 365, price: 399, per: "每年", badge: "最超值" },
];

export function getPlan(id: string): MembershipPlan | undefined {
  return MEMBERSHIP_PLANS.find((p) => p.id === id);
}

function activeRow(userId: string, now: number): Membership | undefined {
  const rows = db
    .select()
    .from(schema.memberships)
    .where(
      and(
        eq(schema.memberships.userId, userId),
        eq(schema.memberships.status, "active"),
        gt(schema.memberships.expiresAt, now),
      ),
    )
    .orderBy(desc(schema.memberships.expiresAt))
    .all();
  return rows[0];
}

export async function activeMembership(userId: string): Promise<Membership | null> {
  const now = Math.floor(Date.now() / 1000);
  return activeRow(userId, now) ?? null;
}

export async function isMember(userId: string): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  return Boolean(activeRow(userId, now));
}

export type MembershipState = {
  active: boolean;
  plan: MembershipPlan | null;
  expiresAt: number | null;
  membership: Membership | null;
};

export async function membershipState(userId: string): Promise<MembershipState> {
  const now = Math.floor(Date.now() / 1000);
  const m = activeRow(userId, now) ?? null;
  return {
    active: Boolean(m),
    plan: m ? getPlan(m.plan) ?? null : null,
    expiresAt: m?.expiresAt ?? null,
    membership: m,
  };
}

// 支付成功钩子(由 lib/db/order-fulfillment.ts 调度)。已有有效会员则叠加续费,否则开新卡。
export async function fulfillMembershipOrder(order: Order): Promise<void> {
  const plan = getPlan(order.refId);
  if (!plan) return;
  const now = Math.floor(Date.now() / 1000);
  const addSec = plan.days * 86400;
  const existing = activeRow(order.userId, now);
  if (existing) {
    const base = Math.max(existing.expiresAt, now);
    db
      .update(schema.memberships)
      .set({
        plan: plan.id,
        status: "active",
        expiresAt: base + addSec,
        orderId: order.id,
        updatedAt: now,
      })
      .where(eq(schema.memberships.id, existing.id))
      .run();
    return;
  }
  db
    .insert(schema.memberships)
    .values({
      id: newMembershipId(),
      userId: order.userId,
      plan: plan.id,
      status: "active",
      startedAt: now,
      expiresAt: now + addSec,
      orderId: order.id,
      createdAt: now,
      updatedAt: now,
    })
    .run();
}

// ── 会员时间线(只读)──────────────────────────────────────────────
// memberships 行是「续费就地叠加」的单行,历史无法从它推导;
// 真正的开通/续费/退款流水从 orders(type=membership)还原。
// 到期事件从当前会员行的 expiresAt 推:未来 = 即将到期,过去 = 已过期。

export type TimelineKind = "activate" | "renew" | "refund" | "expire";

export type MembershipEvent = {
  kind: TimelineKind;
  at: number; // 事件发生秒级时间戳(到期事件可能在未来)
  planId: string | null;
  planLabel: string | null;
  amount: number | null; // 元;到期事件无金额
  orderId: string | null;
  upcoming?: boolean; // 到期事件:true = 尚未到期(预告)
};

export type MembershipTimeline = {
  state: MembershipState;
  events: MembershipEvent[]; // 倒序:最新在前
};

// 该用户全部会员相关事件(开通 / 续费 / 退款 / 到期),供 /me/membership 渲染时间线。
export async function getMembershipTimeline(
  userId: string,
): Promise<MembershipTimeline> {
  const now = Math.floor(Date.now() / 1000);
  const state = await membershipState(userId);

  // 已付的会员订单按付款时间正序:首单 = 开通,其余 = 续费。
  const paidOrders = db
    .select()
    .from(schema.orders)
    .where(
      and(
        eq(schema.orders.userId, userId),
        eq(schema.orders.type, "membership"),
        eq(schema.orders.status, "paid"),
      ),
    )
    .orderBy(asc(schema.orders.paidAt), asc(schema.orders.createdAt))
    .all();

  const events: MembershipEvent[] = [];
  paidOrders.forEach((o, i) => {
    const plan = getPlan(o.refId);
    events.push({
      kind: i === 0 ? "activate" : "renew",
      at: o.paidAt ?? o.createdAt,
      planId: plan?.id ?? o.refId,
      planLabel: plan?.label ?? o.refTitle,
      amount: o.amount,
      orderId: o.id,
    });
  });

  // 退款订单:单独成条(退款撤回会员)。
  const refundedOrders = db
    .select()
    .from(schema.orders)
    .where(
      and(
        eq(schema.orders.userId, userId),
        eq(schema.orders.type, "membership"),
        eq(schema.orders.status, "refunded"),
      ),
    )
    .all();
  for (const o of refundedOrders) {
    const plan = getPlan(o.refId);
    events.push({
      kind: "refund",
      at: o.refundedAt ?? o.paidAt ?? o.createdAt,
      planId: plan?.id ?? o.refId,
      planLabel: plan?.label ?? o.refTitle,
      amount: o.refundAmount ?? o.amount,
      orderId: o.id,
    });
  }

  // 到期事件:取当前(或最近一张)会员行的到期时间。
  const latest =
    state.membership ??
    db
      .select()
      .from(schema.memberships)
      .where(eq(schema.memberships.userId, userId))
      .orderBy(desc(schema.memberships.expiresAt))
      .all()[0];
  if (latest) {
    const plan = getPlan(latest.plan);
    events.push({
      kind: "expire",
      at: latest.expiresAt,
      planId: plan?.id ?? latest.plan,
      planLabel: plan?.label ?? null,
      amount: null,
      orderId: null,
      upcoming: latest.expiresAt > now,
    });
  }

  // 倒序:最新事件在前。到期预告(未来)自然排到最上。
  events.sort((a, b) => b.at - a.at);

  return { state, events };
}

// 退款撤销:把该订单开通/续费过的会员行收回(到期时间回拨到当下并置 cancelled)。
export async function cancelMembershipForOrder(order: Order): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const rows = db
    .select()
    .from(schema.memberships)
    .where(eq(schema.memberships.orderId, order.id))
    .all();
  for (const m of rows) {
    db
      .update(schema.memberships)
      .set({
        status: "cancelled",
        expiresAt: Math.min(m.expiresAt, now),
        updatedAt: now,
      })
      .where(eq(schema.memberships.id, m.id))
      .run();
  }
}
