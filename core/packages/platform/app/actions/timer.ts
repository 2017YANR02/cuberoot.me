"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth-user";
import {
  deleteSolve,
  insertSolve,
  updatePenalty,
} from "@/lib/db/timer";
import { checkInToday } from "@/lib/db/checkins";
import { recomputeAchievements } from "@/lib/db/achievements";
import { scramble } from "@/lib/cube/scramble";
import type { CubeEventId, SolvePenalty } from "@/db/schema";

const EVENT_SET = new Set<CubeEventId>([
  "333",
  "222",
  "444",
  "555",
  "333oh",
  "333bf",
  "pyram",
  "skewb",
  "clock",
  "minx",
]);
const PENALTY_SET = new Set<SolvePenalty>(["none", "plus2", "dnf"]);

function isEvent(v: string): v is CubeEventId {
  return EVENT_SET.has(v as CubeEventId);
}
function isPenalty(v: string): v is SolvePenalty {
  return PENALTY_SET.has(v as SolvePenalty);
}

export type SaveSolveResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function saveSolveAction(input: {
  event: string;
  timeMs: number;
  scramble: string;
  penalty?: string;
}): Promise<SaveSolveResult> {
  const user = await requireUser("/timer");
  // 入口校验:非法 event / 非有限或负时间 / 空打乱 直接拒。
  if (!isEvent(input.event)) return { ok: false, error: "bad_event" };
  if (!Number.isFinite(input.timeMs) || input.timeMs < 0) {
    return { ok: false, error: "bad_time" };
  }
  const sc =
    typeof input.scramble === "string" && input.scramble.trim()
      ? input.scramble.trim().slice(0, 400)
      : scramble(input.event);
  const penalty =
    input.penalty && isPenalty(input.penalty) ? input.penalty : "none";

  const row = await insertSolve(user.id, {
    event: input.event,
    timeMs: Math.floor(input.timeMs),
    scramble: sc,
    penalty,
  });
  // 存了一条成绩即算当日打卡(幂等,不重复占当天)。
  await checkInToday(user.id, "timer");
  // 计时不发积分,单独触发破纪录 / 计时次数类成就。
  await recomputeAchievements(user.id);
  revalidatePath("/timer");
  return { ok: true, id: row.id };
}

export async function setPenaltyAction(
  id: string,
  penalty: string,
): Promise<{ ok: boolean }> {
  const user = await requireUser("/timer");
  if (!id || !isPenalty(penalty)) return { ok: false };
  const ok = await updatePenalty(id, user.id, penalty);
  if (ok) revalidatePath("/timer");
  return { ok };
}

export async function deleteSolveAction(id: string): Promise<{ ok: boolean }> {
  const user = await requireUser("/timer");
  if (!id) return { ok: false };
  const ok = await deleteSolve(id, user.id);
  if (ok) revalidatePath("/timer");
  return { ok };
}
