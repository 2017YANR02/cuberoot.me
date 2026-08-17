"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth-user";
import { isCircleId } from "@/lib/db/posts";
import { joinCircle, leaveCircle } from "@/lib/db/circle-members";

// 切换圈子成员关系:next="join" 加入,否则退出。幂等。
export async function toggleCircleMembershipAction(f: FormData): Promise<void> {
  const circleId = String(f.get("circleId") ?? "");
  if (!isCircleId(circleId)) redirect("/community");
  const user = await requireUser(`/community/circle/${circleId}`);
  const next = String(f.get("next") ?? "");
  if (next === "join") {
    await joinCircle(user.id, circleId);
  } else {
    await leaveCircle(user.id, circleId);
  }
  revalidatePath(`/community/circle/${circleId}`);
  revalidatePath("/community");
}
