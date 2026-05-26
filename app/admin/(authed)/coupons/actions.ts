"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { remove, upsert } from "@/lib/db/coupons";
import type { CouponAppliesTo, CouponDiscountType } from "@/db/schema";

function parseDate(input: string): number | null {
  if (!input) return null;
  const t = Date.parse(input);
  if (Number.isNaN(t)) return null;
  return Math.floor(t / 1000);
}

export async function createCoupon(f: FormData): Promise<void> {
  const code = String(f.get("code") ?? "").trim().toUpperCase();
  const discountType = String(f.get("discountType") ?? "fixed") as CouponDiscountType;
  const discountValue = Number(f.get("discountValue") ?? 0);
  const appliesTo = String(f.get("appliesTo") ?? "any") as CouponAppliesTo;
  const minAmount = Number(f.get("minAmount") ?? 0);
  const maxUses = Number(f.get("maxUses") ?? 0);
  const expiresAtRaw = String(f.get("expiresAt") ?? "").trim();
  const active = f.get("active") === "on";

  if (!code || !Number.isFinite(discountValue) || discountValue <= 0) {
    redirect("/admin/coupons?error=invalid");
  }
  await upsert({
    code,
    discountType,
    discountValue: Math.floor(discountValue),
    appliesTo,
    minAmount: Math.max(0, Math.floor(minAmount)),
    maxUses: Math.max(0, Math.floor(maxUses)),
    expiresAt: parseDate(expiresAtRaw),
    active,
  });
  revalidatePath("/admin/coupons");
  redirect("/admin/coupons");
}

export async function deleteCoupon(f: FormData): Promise<void> {
  const id = String(f.get("id") ?? "");
  if (id) await remove(id);
  revalidatePath("/admin/coupons");
  redirect("/admin/coupons");
}
