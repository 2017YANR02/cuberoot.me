import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { db, schema } from "@/db";
import type { CardCustomText, CardEl, CardLayout, CardTextStyles, QrAlg, QrCode, QrCodeInsert, QrLink, QrType, TextStyle } from "@/db/schema";
import { CARD_FONTS } from "@/lib/qr/cardText";

export type { CardCustomText, CardEl, CardLayout, CardTextStyles, QrAlg, QrCode, QrLink, QrType, TextStyle };

export type QrUpdate = Partial<
  Pick<
    QrCode,
    "label" | "type" | "target" | "title" | "intro" | "links" | "term" | "quote" | "brand" | "frontArt" | "backArt" | "frontArtPrompt" | "alg" | "layout" | "textStyles" | "customTexts"
  >
>;

// 文字样式校验:合法字体 key / #hex 色 / 字号倍率(0.3~3)/ 描边宽(0~1mm)。内置文字 + 自建文本框共用。
const TEXT_ELS: CardEl[] = ["quote", "brand", "backText", "term", "alg"];
const FONT_KEYS = new Set(CARD_FONTS.map((f) => f.key));
const isHex = (v: unknown): v is string => typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);

function cleanStyle(st: unknown): TextStyle | null {
  if (!st || typeof st !== "object") return null;
  const o = st as TextStyle;
  const v: TextStyle = {};
  if (o.font && FONT_KEYS.has(o.font)) v.font = o.font;
  if (isHex(o.color)) v.color = o.color;
  if (Number.isFinite(o.size)) {
    const sz = Math.round(Math.max(0.3, Math.min(3, o.size!)) * 100) / 100;
    if (sz !== 1) v.size = sz;
  }
  if (isHex(o.stroke)) v.stroke = o.stroke;
  if (Number.isFinite(o.strokeW)) {
    const sw = Math.round(Math.max(0, Math.min(1, o.strokeW!)) * 100) / 100;
    if (sw > 0) v.strokeW = sw;
  }
  return Object.keys(v).length ? v : null;
}

function sanitizeTextStyles(raw: CardTextStyles | null | undefined): CardTextStyles | null {
  if (!raw || typeof raw !== "object") return null;
  const out: CardTextStyles = {};
  for (const k of TEXT_ELS) {
    const st = raw[k];
    if (!st || typeof st !== "object") continue;
    const v: TextStyle & { hidden?: boolean } = cleanStyle(st) ?? {};
    if (st.hidden) v.hidden = true;
    if (Object.keys(v).length) out[k] = v;
  }
  return Object.keys(out).length ? out : null;
}

// 自建文本框校验:最多 30 个,id/text 必填,side front/back,位移 ±40mm,样式走 cleanStyle
function sanitizeCustomTexts(raw: CardCustomText[] | null | undefined): CardCustomText[] | null {
  if (!Array.isArray(raw)) return null;
  const out: CardCustomText[] = [];
  const clampMm = (n: unknown) =>
    Number.isFinite(n) ? Math.round(Math.max(-40, Math.min(40, n as number)) * 10) / 10 : 0;
  for (const t of raw.slice(0, 30)) {
    if (!t || typeof t !== "object") continue;
    const id = typeof t.id === "string" && t.id ? t.id.slice(0, 40) : "";
    const text = typeof t.text === "string" ? t.text.slice(0, 200) : "";
    if (!id || !text.trim()) continue;
    const style = cleanStyle(t.style);
    out.push({
      id,
      side: t.side === "front" ? "front" : "back",
      text: text.replace(/\r\n/g, "\n").trimEnd(),
      x: clampMm(t.x),
      y: clampMm(t.y),
      ...(style ? { style } : {}),
    });
  }
  return out.length ? out : null;
}

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
  // 标题 / 简介保留内部换行(卡面与落地页按 \n 分行),仅统一 \r\n 并 trim 两端
  if (patch.title !== undefined) next.title = patch.title?.replace(/\r\n/g, "\n").trim() || null;
  if (patch.intro !== undefined) next.intro = patch.intro?.replace(/\r\n/g, "\n").trim() || null;
  if (patch.term !== undefined) next.term = patch.term?.trim() || null;
  if (patch.quote !== undefined) next.quote = patch.quote?.trim() || null;
  if (patch.brand !== undefined) next.brand = patch.brand?.trim() || null;
  if (patch.frontArt !== undefined) next.frontArt = patch.frontArt?.trim() || null;
  if (patch.backArt !== undefined) next.backArt = patch.backArt?.trim() || null;
  if (patch.frontArtPrompt !== undefined) next.frontArtPrompt = patch.frontArtPrompt?.trim() || null;
  if (patch.alg !== undefined) next.alg = patch.alg && patch.alg.moves ? patch.alg : null;
  if (patch.layout !== undefined) {
    // 只收已知元素键,坐标钳 ±40mm、0.1mm 取整;全空则置 null(回默认布局)
    // 背景图(front/back)与二维码(qr)额外带缩放 s(0.5~3,0.01 取整,1 = 默认不存)
    // fit(铺满/完整)仅背景图用
    const KEYS: CardEl[] = ["quote", "brand", "backText", "term", "qr", "alg", "front", "back"];
    const ART_KEYS: CardEl[] = ["front", "back"];
    const SCALE_KEYS: CardEl[] = ["front", "back", "qr"];
    // 所有可拖元素(文字 / 二维码 / 背景图)都可跨整卡移动到对面,位移统一钳到 ±40mm(整卡宽)
    const clamp = (n: number) =>
      Math.round(Math.max(-40, Math.min(40, n)) * 10) / 10;
    const out: CardLayout = {};
    for (const k of KEYS) {
      const o = patch.layout?.[k];
      if (!o || !Number.isFinite(o.x) || !Number.isFinite(o.y)) continue;
      const x = clamp(o.x);
      const y = clamp(o.y);
      // 缩放下限:二维码可无限缩小(留 0.01 防归零/翻转),背景图保 0.5 防露底过多
      const sMin = k === "qr" ? 0.01 : 0.5;
      const s =
        SCALE_KEYS.includes(k) && Number.isFinite(o.s)
          ? Math.round(Math.max(sMin, Math.min(3, o.s!)) * 100) / 100
          : undefined;
      // 默认(不存)= 完整显示;仅显式 "cover"(铺满裁切)才落库
      const fit = ART_KEYS.includes(k) && o.fit === "cover" ? ("cover" as const) : undefined;
      if (x !== 0 || y !== 0 || (s !== undefined && s !== 1) || fit) {
        const v: { x: number; y: number; s?: number; fit?: "cover" } = { x, y };
        if (s !== undefined && s !== 1) v.s = s;
        if (fit) v.fit = fit;
        out[k] = v;
      }
    }
    next.layout = Object.keys(out).length > 0 ? out : null;
  }
  if (patch.links !== undefined) next.links = patch.links;
  if (patch.textStyles !== undefined) next.textStyles = sanitizeTextStyles(patch.textStyles);
  if (patch.customTexts !== undefined) next.customTexts = sanitizeCustomTexts(patch.customTexts);
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
    brand: src.brand,
    frontArt: src.frontArt,
    backArt: src.backArt,
    frontArtPrompt: src.frontArtPrompt,
    alg: src.alg,
    layout: src.layout,
    textStyles: src.textStyles,
    customTexts: src.customTexts,
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
