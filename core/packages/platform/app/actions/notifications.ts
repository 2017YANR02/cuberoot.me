"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth-user";
import { markAllRead, markRead } from "@/lib/db/notifications";

// 全部标记已读。表单 action,无参。
export async function markAllReadAction(): Promise<void> {
  const user = await requireUser("/notifications");
  await markAllRead(user.id);
  revalidatePath("/notifications");
}

// 标记单条已读(校验属于当前用户在数据层完成)。
export async function markReadAction(f: FormData): Promise<void> {
  const user = await requireUser("/notifications");
  const id = String(f.get("id") ?? "");
  if (!id) return;
  await markRead(id, user.id);
  revalidatePath("/notifications");
}
