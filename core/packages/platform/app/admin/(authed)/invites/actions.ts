"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createForUser, remove } from "@/lib/db/invites";
import { findById as findUser } from "@/lib/db/users";

export async function createInvite(f: FormData): Promise<void> {
  const ownerId = String(f.get("ownerId") ?? "").trim();
  const reward = String(f.get("rewardCoupon") ?? "").trim().toUpperCase() || null;
  if (!ownerId) {
    redirect("/admin/invites?error=missing_owner");
  }
  const user = await findUser(ownerId);
  if (!user) {
    redirect("/admin/invites?error=user_not_found");
  }
  await createForUser(ownerId, reward);
  revalidatePath("/admin/invites");
  redirect("/admin/invites");
}

export async function deleteInvite(f: FormData): Promise<void> {
  const id = String(f.get("id") ?? "");
  if (id) await remove(id);
  revalidatePath("/admin/invites");
  redirect("/admin/invites");
}
