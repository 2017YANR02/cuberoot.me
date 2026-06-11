import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { db, schema } from "@/db";
import type { CardEl, CardLayout, QrAlg, QrCode, QrCodeInsert, QrLink, QrType } from "@/db/schema";

export type { CardEl, CardLayout, QrAlg, QrCode, QrLink, QrType };

export type QrUpdate = Partial<
  Pick<
    QrCode,
    "label" | "type" | "target" | "title" | "intro" | "links" | "term" | "quote" | "frontArt" | "alg" | "layout"
  >
>;

function normalize(code: string): string {
  return code.trim().toLowerCase();
}

// 演示码:站点用来展示聚合 / 跳转两种形态,永久保留,任何路径都不允许删除(可停用)。
export const PROTECTED_QR_CODES = ["demo-landing", "demo-redirect"];

export function isProtectedQr(code: string): boolean {
  return PROTECTED_QR_CODES.includes(normalize(code));
}

function randomSuffix(len: number): string {
  const buf = randomBytes(len);
  const alphabet = "abcdefghijkmnopqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[buf[i % buf.length] % alphabet.length];
  return out;
}

export async function list(): Promise<QrCode[]> {
  return db
    .select()
    .from(schema.qrCodes)
    .orderBy(desc(schema.qrCodes.createdAt))
    .all();
}

export async function findByCode(code: string): Promise<QrCode | undefined> {
  const c = normalize(code);
  const rows = db
    .select()
    .from(schema.qrCodes)
    .where(eq(schema.qrCodes.code, c))
    .all();
  return rows[0];
}

export async function incrementScans(code: string): Promise<void> {
  const c = normalize(code);
  await db
    .update(schema.qrCodes)
    .set({ scans: sql`${schema.qrCodes.scans} + 1` })
    .where(eq(schema.qrCodes.code, c));
}

export async function createBatch(values: {
  prefix: string;
  count: number;
  label: string;
  target: string;
}): Promise<QrCode[]> {
  const prefix = normalize(values.prefix).replace(/[^a-z0-9-]/g, "");
  const count = Math.max(1, Math.min(500, Math.floor(values.count)));
  const label = values.label.trim() || "未命名批次";
  const target = values.target.trim() || "/";
  const now = Math.floor(Date.now() / 1000);
  const created: QrCode[] = [];
  for (let i = 0; i < count; i++) {
    let code = `${prefix ? prefix + "-" : ""}${randomSuffix(6)}`;
    for (let r = 0; r < 5; r++) {
      const dup = await findByCode(code);
      if (!dup) break;
      code = `${prefix ? prefix + "-" : ""}${randomSuffix(6)}`;
    }
    const v: QrCodeInsert = {
      code,
      label,
      target,
      scans: 0,
      createdAt: now,
    };
    await db.insert(schema.qrCodes).values(v);
    const row = await findByCode(code);
    if (row) created.push(row);
  }
  return created;
}

export async function update(code: string, patch: QrUpdate): Promise<void> {
  const c = normalize(code);
  const next: QrUpdate = {};
  if (patch.label !== undefined) next.label = patch.label.trim() || "未命名";
  if (patch.type !== undefined) next.type = patch.type;
  if (patch.target !== undefined) next.target = patch.target.trim() || "/";
  if (patch.title !== undefined) next.title = patch.title?.trim() || null;
  if (patch.intro !== undefined) next.intro = patch.intro?.trim() || null;
  if (patch.term !== undefined) next.term = patch.term?.trim() || null;
  if (patch.quote !== undefined) next.quote = patch.quote?.trim() || null;
  if (patch.frontArt !== undefined) next.frontArt = patch.frontArt?.trim() || null;
  if (patch.alg !== undefined) next.alg = patch.alg && patch.alg.moves ? patch.alg : null;
  if (patch.layout !== undefined) {
    // 只收已知元素键,坐标钳 ±20mm、0.1mm 取整;全空则置 null(回默认布局)
    // front 额外带缩放 s(0.5~3,0.01 取整,1 = 默认铺满不存)
    const KEYS: CardEl[] = ["quote", "brand", "backText", "term", "qr", "alg", "front"];
    const clamp = (n: number) => Math.round(Math.max(-20, Math.min(20, n)) * 10) / 10;
    const out: CardLayout = {};
    for (const k of KEYS) {
      const o = patch.layout?.[k];
      if (!o || !Number.isFinite(o.x) || !Number.isFinite(o.y)) continue;
      const x = clamp(o.x);
      const y = clamp(o.y);
      const s =
        k === "front" && Number.isFinite(o.s)
          ? Math.round(Math.max(0.5, Math.min(3, o.s!)) * 100) / 100
          : undefined;
      if (x !== 0 || y !== 0 || (s !== undefined && s !== 1))
        out[k] = s !== undefined && s !== 1 ? { x, y, s } : { x, y };
    }
    next.layout = Object.keys(out).length > 0 ? out : null;
  }
  if (patch.links !== undefined) next.links = patch.links;
  if (Object.keys(next).length === 0) return;
  await db.update(schema.qrCodes).set(next).where(eq(schema.qrCodes.code, c));
}

// 复制为新码:拷贝全部卡面配置(类型/目标/文案/链接/图/公式/布局),
// 但 code 必然是新的 → 印进码里的地址不同,二维码图案天然不同;扫码数归零。
export async function duplicate(code: string): Promise<string | null> {
  const src = await findByCode(code);
  if (!src) return null;
  let next = `${src.code}-copy`;
  for (let i = 2; await findByCode(next); i++) next = `${src.code}-copy-${i}`;
  const v: QrCodeInsert = {
    code: next,
    label: `${src.label} (副本)`,
    type: src.type,
    target: src.target,
    title: src.title,
    intro: src.intro,
    links: src.links,
    term: src.term,
    quote: src.quote,
    frontArt: src.frontArt,
    alg: src.alg,
    layout: src.layout,
    scans: 0,
    disabled: false,
    createdAt: Math.floor(Date.now() / 1000),
  };
  await db.insert(schema.qrCodes).values(v);
  return next;
}

// 把字符串规范成合法 code(小写 + [a-z0-9-],去首尾连字符,截断 64)
export function slugifyCode(raw: string): string {
  return normalize(raw)
    .replace(/[^a-z0-9-]/g, "")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export type RenameResult =
  | { ok: true; code: string }
  | { ok: false; reason: "invalid" | "exists" | "protected" | "notfound" };

// 改 code(主键):code 进了二维码地址,改了二维码图案就变,印过的码会失效 → UI 须警示。
// 演示码不可改;新 code 须合法且未被占用。统计等行数据随主键一起保留。
export async function rename(oldCode: string, newCodeRaw: string): Promise<RenameResult> {
  const from = normalize(oldCode);
  if (isProtectedQr(from)) return { ok: false, reason: "protected" };
  const to = slugifyCode(newCodeRaw);
  if (!to) return { ok: false, reason: "invalid" };
  if (to === from) return { ok: true, code: from };
  if (await findByCode(to)) return { ok: false, reason: "exists" };
  if (!(await findByCode(from))) return { ok: false, reason: "notfound" };
  await db.update(schema.qrCodes).set({ code: to }).where(eq(schema.qrCodes.code, from));
  return { ok: true, code: to };
}

// 停用 / 恢复:作废一个码只翻 disabled 标记、不删数据,扫码落地页给「已停用」提示,
// 可随时恢复。二维码无硬删(印出去的码硬删会 404、统计与配置全丢),只用停用作废。
export async function setDisabled(code: string, disabled: boolean): Promise<void> {
  await db
    .update(schema.qrCodes)
    .set({ disabled })
    .where(eq(schema.qrCodes.code, normalize(code)));
}

// 硬删:仅非演示码可删(演示码 isProtectedQr 兜底拦截);删前请确认,印过的码建议改用停用。
export async function remove(code: string): Promise<void> {
  const c = normalize(code);
  if (isProtectedQr(c)) throw new Error(`演示码 ${c} 不可删除`);
  await db.delete(schema.qrCodes).where(eq(schema.qrCodes.code, c));
}
