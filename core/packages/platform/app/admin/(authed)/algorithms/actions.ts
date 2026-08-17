"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  createAlgorithm,
  updateAlgorithm,
  deleteAlgorithm,
  swapAlgorithmOrder,
  type AlgorithmInput,
} from "@/lib/db/algorithms";

function refresh(id?: string) {
  revalidatePath("/algorithms");
  revalidatePath("/admin/algorithms");
  if (id) revalidatePath(`/algorithms/${id}`);
}

function valuesFromForm(f: FormData): AlgorithmInput {
  const str = (k: string) => String(f.get(k) ?? "").trim();
  const opt = (k: string) => {
    const v = str(k);
    return v === "" ? null : v;
  };
  return {
    id: str("id") || undefined,
    category: str("category"),
    name: str("name"),
    notation: str("notation"),
    puzzle: str("puzzle") || "333",
    caseGroup: opt("caseGroup"),
    description: opt("description"),
    hint: opt("hint"),
    sortOrder: Number(f.get("sortOrder") ?? 0) || 0,
  };
}

export async function saveAlgorithm(f: FormData): Promise<void> {
  const isNew = String(f.get("mode") ?? "") === "new";
  const v = valuesFromForm(f);
  // 边界:类目 / 名称 / 记法必填,缺一不写库。
  if (!v.category || !v.name || !v.notation) {
    redirect("/admin/algorithms?error=missing");
  }

  if (isNew) {
    await createAlgorithm(v);
  } else {
    const id = String(f.get("id") ?? "").trim();
    if (!id) redirect("/admin/algorithms?error=missing");
    await updateAlgorithm(id, v);
  }
  refresh(v.id);
  redirect("/admin/algorithms");
}

export async function removeAlgorithm(f: FormData): Promise<void> {
  const id = String(f.get("id") ?? "").trim();
  if (id) {
    await deleteAlgorithm(id);
    refresh(id);
  }
  redirect("/admin/algorithms");
}

// 上 / 下移:前端传当前 id + 相邻 id,交换 sortOrder
export async function reorderAlgorithm(f: FormData): Promise<void> {
  const a = String(f.get("a") ?? "").trim();
  const b = String(f.get("b") ?? "").trim();
  if (a && b) await swapAlgorithmOrder(a, b);
  refresh();
  redirect("/admin/algorithms");
}
