"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { removePost } from "@/lib/db/posts";

export async function deletePost(f: FormData) {
  const id = String(f.get("id") ?? "");
  if (id) {
    await removePost(id);
    revalidatePath("/community");
    revalidatePath("/admin/posts");
  }
  redirect("/admin/posts");
}
