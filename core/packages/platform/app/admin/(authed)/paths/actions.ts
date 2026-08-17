"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  createCollection,
  updateCollection,
  deleteCollection,
  addItem,
  removeItem,
  moveItem,
} from "@/lib/db/collections";

function trimOrNull(v: FormDataEntryValue | null): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s : null;
}

function revalidatePaths(collectionId?: string) {
  revalidatePath("/paths");
  revalidatePath("/admin/paths");
  if (collectionId) revalidatePath(`/paths/${collectionId}`);
}

export async function createCollectionFromForm(f: FormData) {
  const title = String(f.get("title") ?? "").trim();
  if (!title) {
    redirect("/admin/paths?error=missing");
  }
  const sortRaw = String(f.get("sortOrder") ?? "").trim();
  await createCollection({
    title,
    subtitle: trimOrNull(f.get("subtitle")),
    description: trimOrNull(f.get("description")),
    coverUrl: trimOrNull(f.get("coverUrl")),
    sortOrder: sortRaw === "" ? 0 : Number(sortRaw) || 0,
  });
  revalidatePaths();
  redirect("/admin/paths");
}

export async function updateCollectionFromForm(f: FormData) {
  const id = String(f.get("id") ?? "").trim();
  const title = String(f.get("title") ?? "").trim();
  if (!id || !title) {
    redirect("/admin/paths?error=missing");
  }
  const sortRaw = String(f.get("sortOrder") ?? "").trim();
  await updateCollection(id, {
    title,
    subtitle: trimOrNull(f.get("subtitle")),
    description: trimOrNull(f.get("description")),
    coverUrl: trimOrNull(f.get("coverUrl")),
    sortOrder: sortRaw === "" ? 0 : Number(sortRaw) || 0,
  });
  revalidatePaths(id);
  redirect("/admin/paths");
}

export async function deleteCollectionFromForm(f: FormData) {
  const id = String(f.get("id") ?? "").trim();
  if (id) {
    await deleteCollection(id);
    revalidatePaths(id);
  }
  redirect("/admin/paths");
}

export async function addItemFromForm(f: FormData) {
  const collectionId = String(f.get("collectionId") ?? "").trim();
  const courseId = String(f.get("courseId") ?? "").trim();
  if (collectionId && courseId) {
    await addItem(collectionId, courseId);
    revalidatePaths(collectionId);
  }
  redirect("/admin/paths");
}

export async function removeItemFromForm(f: FormData) {
  const itemId = String(f.get("itemId") ?? "").trim();
  const collectionId = String(f.get("collectionId") ?? "").trim();
  if (itemId) {
    await removeItem(itemId);
    revalidatePaths(collectionId || undefined);
  }
  redirect("/admin/paths");
}

export async function moveItemFromForm(f: FormData) {
  const itemId = String(f.get("itemId") ?? "").trim();
  const collectionId = String(f.get("collectionId") ?? "").trim();
  const direction = String(f.get("direction") ?? "").trim();
  if (itemId && (direction === "up" || direction === "down")) {
    await moveItem(itemId, direction);
    revalidatePaths(collectionId || undefined);
  }
  redirect("/admin/paths");
}
