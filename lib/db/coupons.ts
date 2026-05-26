import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type {
  Coupon,
  CouponAppliesTo,
  CouponDiscountType,
  CouponInsert,
  OrderType,
} from "@/db/schema";

export type { Coupon, CouponDiscountType, CouponAppliesTo };

export type CouponResult =
  | { ok: true; coupon: Coupon; discount: number; payable: number }
  | { ok: false; reason: CouponRejection };

export type CouponRejection =
  | "not_found"
  | "inactive"
  | "expired"
  | "exhausted"
  | "applies_to_mismatch"
  | "min_amount_not_met";

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

export async function list(): Promise<Coupon[]> {
  return db
    .select()
    .from(schema.coupons)
    .orderBy(desc(schema.coupons.createdAt))
    .all();
}

export async function findByCode(code: string): Promise<Coupon | undefined> {
  const c = normalizeCode(code);
  const rows = db
    .select()
    .from(schema.coupons)
    .where(eq(schema.coupons.code, c))
    .all();
  return rows[0];
}

export function computeDiscount(coupon: Coupon, amount: number): number {
  if (coupon.discountType === "fixed") {
    return Math.min(coupon.discountValue, amount);
  }
  const pct = Math.max(0, Math.min(100, coupon.discountValue));
  return Math.floor((amount * pct) / 100);
}

export async function findActive(
  code: string,
  refType: OrderType,
  amount: number,
): Promise<CouponResult> {
  const coupon = await findByCode(code);
  if (!coupon) return { ok: false, reason: "not_found" };
  if (!coupon.active) return { ok: false, reason: "inactive" };
  const now = Math.floor(Date.now() / 1000);
  if (coupon.expiresAt && coupon.expiresAt < now) {
    return { ok: false, reason: "expired" };
  }
  if (coupon.maxUses > 0 && coupon.uses >= coupon.maxUses) {
    return { ok: false, reason: "exhausted" };
  }
  if (coupon.appliesTo !== "any" && coupon.appliesTo !== refType) {
    return { ok: false, reason: "applies_to_mismatch" };
  }
  if (amount < coupon.minAmount) {
    return { ok: false, reason: "min_amount_not_met" };
  }
  const discount = computeDiscount(coupon, amount);
  return {
    ok: true,
    coupon,
    discount,
    payable: Math.max(0, amount - discount),
  };
}

export async function incrementUses(code: string): Promise<void> {
  const c = normalizeCode(code);
  await db
    .update(schema.coupons)
    .set({ uses: sql`${schema.coupons.uses} + 1` })
    .where(eq(schema.coupons.code, c));
}

export async function upsert(values: {
  code: string;
  discountType: CouponDiscountType;
  discountValue: number;
  appliesTo: CouponAppliesTo;
  minAmount: number;
  maxUses: number;
  expiresAt: number | null;
  active: boolean;
}): Promise<void> {
  const code = normalizeCode(values.code);
  const existing = await findByCode(code);
  if (existing) {
    await db
      .update(schema.coupons)
      .set({
        discountType: values.discountType,
        discountValue: values.discountValue,
        appliesTo: values.appliesTo,
        minAmount: values.minAmount,
        maxUses: values.maxUses,
        expiresAt: values.expiresAt,
        active: values.active,
      })
      .where(eq(schema.coupons.code, code));
    return;
  }
  const v: CouponInsert = {
    code,
    discountType: values.discountType,
    discountValue: values.discountValue,
    appliesTo: values.appliesTo,
    minAmount: values.minAmount,
    maxUses: values.maxUses,
    uses: 0,
    expiresAt: values.expiresAt,
    active: values.active,
    createdAt: Math.floor(Date.now() / 1000),
  };
  await db.insert(schema.coupons).values(v);
}

export async function remove(code: string): Promise<void> {
  await db.delete(schema.coupons).where(eq(schema.coupons.code, normalizeCode(code)));
}

export const REJECTION_MSG: Record<CouponRejection, string> = {
  not_found: "优惠码不存在",
  inactive: "优惠码已停用",
  expired: "优惠码已过期",
  exhausted: "优惠码已被领完",
  applies_to_mismatch: "优惠码不适用本商品",
  min_amount_not_met: "未达使用门槛",
};
