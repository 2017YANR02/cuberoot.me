import "server-only";
import { and, desc, eq, gt } from "drizzle-orm";
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
