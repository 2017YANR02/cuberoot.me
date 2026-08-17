"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { upsert, remove } from "@/lib/db/products";
import type { ProductInsert } from "@/db/schema";

function parseLines(v: FormDataEntryValue | null): string[] {
  if (typeof v !== "string") return [];
  return v
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function valuesFromForm(f: FormData): ProductInsert {
  const originalRaw = f.get("originalPrice");
  const originalStr = typeof originalRaw === "string" ? originalRaw.trim() : "";
  const memberRaw = f.get("memberPrice");
  const memberStr = typeof memberRaw === "string" ? memberRaw.trim() : "";
  return {
    id: String(f.get("id") ?? "").trim(),
    name: String(f.get("name") ?? "").trim(),
    category: String(f.get("category") ?? "竞速魔方") as ProductInsert["category"],
    brand: String(f.get("brand") ?? "").trim(),
    price: Number(f.get("price") ?? 0),
    originalPrice: originalStr === "" ? null : Number(originalStr),
    rating: Number(f.get("rating") ?? 0),
    reviews: Number(f.get("reviews") ?? 0),
    description: String(f.get("description") ?? "").trim(),
    features: parseLines(f.get("features")),
    inStock: f.get("inStock") === "on",
    memberOnly: f.get("memberOnly") === "on",
    memberPrice: memberStr === "" ? null : Number(memberStr),
  };
}

export async function saveProduct(f: FormData) {
  const v = valuesFromForm(f);
  if (!v.id || !v.name) {
    redirect("/admin/products?error=missing");
  }
  await upsert(v);
  revalidatePath("/shop");
  revalidatePath(`/shop/${v.id}`);
  revalidatePath("/admin/products");
  redirect("/admin/products");
}

export async function deleteProduct(f: FormData) {
  const id = String(f.get("id") ?? "");
  if (id) {
    await remove(id);
    revalidatePath("/shop");
    revalidatePath("/admin/products");
  }
  redirect("/admin/products");
}
