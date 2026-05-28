"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createBatch, remove, update, type QrLink, type QrType } from "@/lib/db/qr";

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

// 每行 "标签 | 链接 | 备注(可选)";只写一段则当作 href,label 同值
function parseLinks(raw: string): QrLink[] {
  return raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const parts = l.split("|").map((p) => p.trim());
      if (parts.length === 1) return { label: parts[0], href: parts[0] };
      const [label, href, note] = parts;
      return {
        label: label || href || "链接",
        href: href || "/",
        note: note || undefined,
      };
    })
    .filter((x) => x.href);
}

export async function saveQr(f: FormData): Promise<void> {
  const code = String(f.get("code") ?? "").trim();
  if (!code) redirect("/admin/qr");
  const type: QrType =
    String(f.get("type") ?? "redirect") === "landing" ? "landing" : "redirect";
  await update(code, {
    label: String(f.get("label") ?? ""),
    type,
    target: String(f.get("target") ?? "/"),
    title: String(f.get("title") ?? ""),
    intro: String(f.get("intro") ?? ""),
    term: String(f.get("term") ?? ""),
    links: parseLinks(String(f.get("links") ?? "")),
  });
  revalidatePath("/admin/qr");
  revalidatePath(`/admin/qr/${code}`);
  revalidatePath(`/qr/${code}`);
  redirect(`/admin/qr/${code}?saved=1`);
}
