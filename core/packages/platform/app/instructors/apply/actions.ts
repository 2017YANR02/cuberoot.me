"use server";

import { getCurrentUser } from "@/lib/auth-user";
import { create as createApplication } from "@/lib/db/applications";
import { revalidatePath } from "next/cache";

export type ApplyResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

function isValidPhone(phone: string): boolean {
  return /^1[3-9]\d{9}$/.test(phone);
}

function parseList(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== "string") return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function submitApplication(f: FormData): Promise<ApplyResult> {
  const name = String(f.get("name") ?? "").trim();
  const phone = String(f.get("phone") ?? "").trim();
  const city = String(f.get("city") ?? "").trim();
  const wcaId = String(f.get("wcaId") ?? "").trim();
  const bio = String(f.get("bio") ?? "").trim();
  const direction = parseList(f.get("direction"));
  const formats = parseList(f.get("formats"));

  if (!name) return { ok: false, error: "请填写姓名" };
  if (!isValidPhone(phone)) return { ok: false, error: "手机号格式不正确" };
  if (!city) return { ok: false, error: "请填写所在城市" };
  if (direction.length === 0) return { ok: false, error: "至少选择一个授课方向" };
  if (formats.length === 0) return { ok: false, error: "至少选择一种授课形式" };
  if (bio.length < 10) return { ok: false, error: "个人简介至少 10 个字" };

  const user = await getCurrentUser();
  const row = await createApplication({
    userId: user?.id ?? null,
    name,
    phone,
    city,
    wcaId: wcaId || null,
    direction,
    formats,
    bio,
  });
  revalidatePath("/admin/applications");
  return { ok: true, id: row.id };
}
