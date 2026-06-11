"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  createPromptTemplate,
  updatePromptTemplate,
  removePromptTemplate,
  swapPromptTemplateOrder,
} from "@/lib/db/prompt-templates";

function refresh() {
  revalidatePath("/admin/qr/prompts");
}

export async function createPrompt(f: FormData): Promise<void> {
  const name = String(f.get("name") ?? "").trim();
  const category = String(f.get("category") ?? "").trim();
  const body = String(f.get("body") ?? "").trim();
  if (!name || !body) redirect("/admin/qr/prompts?error=invalid");
  await createPromptTemplate({ name, category, body });
  refresh();
  redirect("/admin/qr/prompts?saved=1");
}

export async function updatePrompt(f: FormData): Promise<void> {
  const id = Number(f.get("id") ?? 0);
  const name = String(f.get("name") ?? "").trim();
  const category = String(f.get("category") ?? "").trim();
  const body = String(f.get("body") ?? "").trim();
  if (!id || !name || !body) redirect("/admin/qr/prompts?error=invalid");
  await updatePromptTemplate(id, { name, category, body });
  refresh();
  redirect("/admin/qr/prompts?saved=1");
}

export async function deletePrompt(f: FormData): Promise<void> {
  const id = Number(f.get("id") ?? 0);
  if (id) await removePromptTemplate(id);
  refresh();
  redirect("/admin/qr/prompts");
}

// 上 / 下移:前端传当前 id + 相邻 id,交换 sortOrder
export async function reorderPrompt(f: FormData): Promise<void> {
  const a = Number(f.get("a") ?? 0);
  const b = Number(f.get("b") ?? 0);
  if (a && b) await swapPromptTemplateOrder(a, b);
  refresh();
  redirect("/admin/qr/prompts");
}
