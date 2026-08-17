"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { upsert, remove } from "@/lib/db/news";
import type { NewsItemInsert } from "@/db/schema";

function valuesFromForm(f: FormData): NewsItemInsert {
  const body = String(f.get("body") ?? "");
  return {
    id: String(f.get("id") ?? "").trim(),
    title: String(f.get("title") ?? "").trim(),
    date: String(f.get("date") ?? "").trim(),
    category: String(f.get("category") ?? "公告") as NewsItemInsert["category"],
    excerpt: String(f.get("excerpt") ?? "").trim(),
    body: body.trim() ? body : null,
  };
}

export async function saveNews(f: FormData) {
  const v = valuesFromForm(f);
  if (!v.id || !v.title) {
    redirect("/admin/news?error=missing");
  }
  await upsert(v);
  revalidatePath("/news");
  revalidatePath(`/news/${v.id}`);
  revalidatePath("/admin/news");
  redirect("/admin/news");
}

export async function deleteNews(f: FormData) {
  const id = String(f.get("id") ?? "");
  if (id) {
    await remove(id);
    revalidatePath("/news");
    revalidatePath("/admin/news");
  }
  redirect("/admin/news");
}
