"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  createBatch,
  duplicate,
  isProtectedQr,
  remove,
  rename,
  setDisabled,
  update,
  type CardLayout,
  type QrType,
} from "@/lib/db/qr";
import { parseLinks } from "@/lib/qr/links";
import { parseAlg } from "@/lib/qr/cardText";

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

// 彻底删除:仅非演示码,需前端二次确认;演示码服务端再兜底拦一道。
export async function deleteQr(f: FormData): Promise<void> {
  const id = String(f.get("id") ?? "");
  if (id && !isProtectedQr(id)) await remove(id);
  revalidatePath("/admin/qr");
  redirect("/admin/qr");
}

// 复制为新码:拷贝卡面配置、code 全新(二维码图案自动不同),复制完留在列表页
export async function duplicateQr(f: FormData): Promise<void> {
  const id = String(f.get("id") ?? "");
  if (id) await duplicate(id);
  revalidatePath("/admin/qr");
  redirect("/admin/qr");
}

// 停用 / 恢复:作废 = 留数据、扫码给停用页;恢复 = 重新启用。印过的码用这个,别硬删。
export async function toggleQrDisabled(f: FormData): Promise<void> {
  const id = String(f.get("id") ?? "");
  const disabled = String(f.get("disabled") ?? "") === "1";
  if (id) await setDisabled(id, disabled);
  revalidatePath("/admin/qr");
  revalidatePath(`/admin/qr/${id}`);
  revalidatePath(`/qr/${id}`);
  redirect(`/admin/qr/${id}?saved=1`);
}

// 卡面元素布局 JSON({quote:{x,y},...});非法返回 null,具体键校验在 db 层
function parseLayout(raw: string): CardLayout | null {
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" && !Array.isArray(v) ? (v as CardLayout) : null;
  } catch {
    return null;
  }
}

export async function saveQr(f: FormData): Promise<void> {
  const code = String(f.get("code") ?? "").trim();
  if (!code) redirect("/admin/qr");

  // 改 code(主键):新值与当前不同才尝试改名,失败不阻断其余字段保存、回显错误
  let effective = code;
  let codeErr = "";
  const newCode = String(f.get("newCode") ?? "").trim();
  if (newCode && newCode.toLowerCase() !== code.toLowerCase()) {
    const res = await rename(code, newCode);
    if (res.ok) effective = res.code;
    else codeErr = res.reason;
  }

  const type: QrType =
    String(f.get("type") ?? "redirect") === "landing" ? "landing" : "redirect";
  await update(effective, {
    label: String(f.get("label") ?? ""),
    type,
    target: String(f.get("target") ?? "/"),
    title: String(f.get("title") ?? ""),
    intro: String(f.get("intro") ?? ""),
    term: String(f.get("term") ?? ""),
    quote: String(f.get("quote") ?? ""),
    frontArt: String(f.get("frontArt") ?? ""),
    backArt: String(f.get("backArt") ?? ""),
    frontArtPrompt: String(f.get("frontArtPrompt") ?? ""),
    alg: parseAlg(String(f.get("alg") ?? "")),
    layout: parseLayout(String(f.get("layout") ?? "")),
    links: parseLinks(String(f.get("links") ?? "")),
  });
  revalidatePath("/admin/qr");
  revalidatePath(`/admin/qr/${effective}`);
  revalidatePath(`/qr/${effective}`);
  redirect(`/admin/qr/${effective}?saved=1${codeErr ? `&codeErr=${codeErr}` : ""}`);
}
