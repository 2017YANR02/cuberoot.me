"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createBatch, remove } from "@/lib/db/qr";

export async function createQrBatch(f: FormData): Promise<void> {
  const prefix = String(f.get("prefix") ?? "").trim();
  const countRaw = Number(f.get("count") ?? 1);
  const label = String(f.get("label") ?? "").trim();
  const target = String(f.get("target") ?? "/").trim();
  if (!label || !Number.isFinite(countRaw) || countRaw < 1) {
    redirect("/admin/qr?error=invalid");
  }
  await createBatch({ prefix, count: countRaw, label, target });
  revalidatePath("/admin/qr");
  redirect("/admin/qr");
}

export async function deleteQr(f: FormData): Promise<void> {
  const id = String(f.get("id") ?? "");
  if (id) await remove(id);
  revalidatePath("/admin/qr");
  redirect("/admin/qr");
}
