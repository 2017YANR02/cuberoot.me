"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth-user";
import { isFavoriteTarget, toggleFavorite } from "@/lib/db/favorites";

/**
 * 切换收藏。FormData: targetType / targetId / next(切换后回跳并重渲染的路径)。
 * 未登录跳 /login?next=<next>。非法 targetType / 缺 targetId 直接 no-op 返回。
 */
export async function toggleFavoriteAction(f: FormData): Promise<void> {
  const next = String(f.get("next") ?? "");
  const user = await requireUser(next || undefined);

  const targetType = String(f.get("targetType") ?? "");
  const targetId = String(f.get("targetId") ?? "").trim();
  if (!isFavoriteTarget(targetType) || !targetId) return;

  await toggleFavorite(user.id, targetType, targetId);

  if (next) revalidatePath(next);
  revalidatePath("/me/favorites");
}
