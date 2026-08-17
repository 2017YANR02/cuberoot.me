"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth-user";
import { checkInToday } from "@/lib/db/checkins";
import { awardPoints } from "@/lib/db/points";

export async function checkInAction(
  source: string = "study",
): Promise<{ ok: true; created: boolean; date: string }> {
  const user = await requireUser("/me");
  const result = await checkInToday(user.id, source);
  // 当天首次签到才发分(同 date 去重,重复签到不重复发)。
  if (result.created) {
    await awardPoints(user.id, 5, "checkin", { refId: result.date });
  }
  revalidatePath("/me");
  return { ok: true, ...result };
}
