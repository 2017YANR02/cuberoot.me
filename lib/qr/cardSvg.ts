import type { QrCode } from "@/lib/db/qr";
import { qrSvgBody, cubeLogo } from "./svg";
import { backText, frontQuote } from "./cardText";

// 整张折叠卡的「印刷母版」:单个自包含、100% 矢量的 SVG(无位图、无 CSS、无外链)。
// 二维码 / 文字 / 配色 / 魔方图形全是矢量路径,印刷厂可直接收、无限放大不糊。
// 单位 mm:viewBox 即物理尺寸。flat 40x40mm(正面 20 | 折线 | 背面 20),含出血 + 裁切线。
//
// 字体提醒:文本用 <text> 走系统字体栈。送印前建议在 Illustrator 里「创建轮廓」
// (Type → Create Outlines),或确认印厂装了中文字体,避免缺字回退。

type CardSvgOptions = {
  url: string; // 印进二维码里的落地地址(背面也显示这串,去协议)
  quote?: string; // 正面语录,\n 分行;不传按默认轮换
  bleed?: number; // 出血 mm,默认 3
  cropMarks?: boolean; // 角裁切线,默认 true
  pattern?: boolean; // 正面魔方记法底纹,默认 true
  idx?: number; // 默认语录轮换序号
};

const PANEL_W = 20;
const PANEL_H = 40;
const FONT = "-apple-system, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif";
const MONO = "ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace";
const BRAND = "#2A5DF4";
const BRAND_DARK = "#1E4ACB";
const INK = "#11111A";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function text(
  x: number,
  y: number,
  size: number,
  fill: string,
  content: string,
  opts: { weight?: number; mono?: boolean; spacing?: number; anchor?: string } = {},
): string {
  const { weight = 400, mono = false, spacing, anchor = "middle" } = opts;
  return (
    `<text x="${x}" y="${y}" font-family="${mono ? MONO : FONT}" font-size="${size}" ` +
    `font-weight="${weight}" fill="${fill}" text-anchor="${anchor}"` +
    (spacing ? ` letter-spacing="${spacing}"` : "") +
    `>${esc(content)}</text>`
  );
}

// 魔方记法 / 解法体系缩写,正面底纹用(全矢量文字水印)
const FORMULA_TOKENS = [
  "R U R' U'", "F2L", "CFOP", "OLL", "PLL", "R' D' R D", "U R U' R'",
  "Cross", "F R U R' U' F'", "M2 E2 S2", "ZBLL", "Sune", "T-Perm",
  "Roux", "ZZ", "L' U' L U", "x2 y'", "R U2 R'", "U' L' U L", "COLL",
];

// 正面底纹:斜排的淡白记法文字,clip 在面板内。背景加魔方公式 / 解法缩写(同事需求)。
function formulaPattern(x0: number, top: number): string {
  const cx = x0 + PANEL_W / 2;
  const cy = top + PANEL_H / 2;
  const lineH = 2.7;
  const rows: string[] = [];
  for (let i = 0; (i - 1) * lineH < PANEL_H + 4; i++) {
    const y = top - 2 + i * lineH;
    const start = (i * 3) % FORMULA_TOKENS.length;
    const seq: string[] = [];
    for (let k = 0; k < 6; k++) seq.push(FORMULA_TOKENS[(start + k * 2) % FORMULA_TOKENS.length]);
    const dx = i % 2 ? -5 : -2;
    rows.push(
      `<text x="${x0 + dx}" y="${y.toFixed(2)}" font-family="${MONO}" font-size="1.5" fill="#FFFFFF" fill-opacity="0.11">${esc(seq.join("   "))}</text>`,
    );
  }
  return `<g clip-path="url(#frontClip)"><g transform="rotate(-8 ${cx} ${cy})">${rows.join("")}</g></g>`;
}

// 正面:深色封面式,记法底纹 + 顶部魔方 logo + 底部语录 + 品牌名。全矢量。
function front(x0: number, top: number, quote: string, pattern: boolean): string {
  const cx = x0 + PANEL_W / 2;
  const lines = quote.split("\n").map((l) => l.trim()).filter(Boolean);
  const main = lines[0] ?? "热爱魔方";
  const subs = lines.slice(1);

  const logoSize = 7;
  const logo = cubeLogo(cx - logoSize / 2, top + 5, logoSize);

  const mainY = top + PANEL_H - 9;
  const subEls = subs
    .map((s, i) => text(cx, mainY + 2 + i * 1.7, 1.4, "rgba(255,255,255,0.85)", s))
    .join("");
  const brandY = mainY + 2 + subs.length * 1.7 + 2.6;

  return (
    `<rect x="${x0}" y="${top}" width="${PANEL_W}" height="${PANEL_H}" fill="${INK}"/>` +
    (pattern ? formulaPattern(x0, top) : "") +
    `<rect x="${x0}" y="${top}" width="${PANEL_W}" height="${PANEL_H}" fill="url(#frontGlow)"/>` +
    logo +
    text(cx, mainY, 2.8, "#FFFFFF", main, { weight: 800 }) +
    subEls +
    text(cx, brandY, 1.4, "rgba(255,255,255,0.92)", "魔方开放社群", { weight: 700, spacing: 0.1 })
  );
}

// 背面:浅色 + 标题/副标题 + 术语角标 + 二维码白芯片 + 网址。全矢量(二维码内联缩放)。
function back(x0: number, top: number, entry: QrCode, url: string): string {
  const cx = x0 + PANEL_W / 2;
  const { main, sub } = backText(entry);
  const term = entry.term?.trim();

  // 二维码白芯片:小卡用 margin:2 让码点更大更好扫,白底兼当静默区
  const { inner, dim } = qrSvgBody(url, { margin: 2, fg: BRAND });
  const chip = 14.5;
  const pad = 0.9;
  const chipX = cx - chip / 2;
  const chipTop = top + 15.75;
  const scale = (chip - pad * 2) / dim;
  const qr =
    `<rect x="${chipX}" y="${chipTop}" width="${chip}" height="${chip}" rx="1.4" fill="#FFFFFF" stroke="#E5E8EE" stroke-width="0.14"/>` +
    `<g transform="translate(${(chipX + pad).toFixed(3)} ${(chipTop + pad).toFixed(3)}) scale(${scale.toFixed(4)})">${inner}</g>`;

  const termEl = term
    ? `<rect x="${cx - (term.length * 1.2 + 1.8) / 2}" y="${chipTop - 3.4}" width="${term.length * 1.2 + 1.8}" height="2.4" rx="1.2" fill="rgba(42,93,244,0.10)" stroke="rgba(42,93,244,0.28)" stroke-width="0.12"/>` +
      text(cx, chipTop - 1.7, 1.1, BRAND_DARK, term, { weight: 700, spacing: 0.06 })
    : "";

  return (
    `<rect x="${x0}" y="${top}" width="${PANEL_W}" height="${PANEL_H}" fill="url(#backBg)"/>` +
    text(cx, top + 6.5, 1.6, BRAND_DARK, main, { weight: 700 }) +
    (sub ? text(cx, top + 9.4, 1.2, "#6B7280", sub) : "") +
    termEl +
    qr +
    text(cx, top + PANEL_H - 3, 1.1, "#9aa1ad", url.replace(/^https?:\/\//, ""), { mono: true })
  );
}

function cropMarksSvg(bleed: number, w: number, h: number): string {
  const len = Math.min(bleed, 3);
  const xs = [bleed, w - bleed];
  const ys = [bleed, h - bleed];
  const marks: string[] = [];
  // 双描边:白色垫底 + 黑色压面,深色出血(正面)与浅色出血(背面)上都看得见
  const seg = (x1: number, y1: number, x2: number, y2: number) =>
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#FFF" stroke-width="0.3"/>` +
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#111" stroke-width="0.12"/>`;
  for (const x of xs) {
    for (const y of ys) {
      const ox = x === bleed ? -1 : 1; // 向外方向
      const oy = y === bleed ? -1 : 1;
      marks.push(
        seg(x + ox * (len + 0.6), y, x + ox * 0.6, y),
        seg(x, y + oy * (len + 0.6), x, y + oy * 0.6),
      );
    }
  }
  return marks.join("");
}

export function cardSvg(entry: QrCode, opts: CardSvgOptions): string {
  const bleed = opts.bleed ?? 3;
  const cropMarks = opts.cropMarks ?? true;
  const pattern = opts.pattern ?? true;
  const quote = opts.quote ?? frontQuote(entry, opts.idx ?? 0);
  const w = PANEL_W * 2 + bleed * 2;
  const h = PANEL_H + bleed * 2;
  const foldX = bleed + PANEL_W;

  const defs =
    `<defs>` +
    `<clipPath id="frontClip"><rect x="${bleed}" y="${bleed}" width="${PANEL_W}" height="${PANEL_H}"/></clipPath>` +
    `<linearGradient id="frontGlow" x1="0" y1="1" x2="0" y2="0">` +
    `<stop offset="0" stop-color="${BRAND}" stop-opacity="0.55"/>` +
    `<stop offset="0.45" stop-color="${BRAND}" stop-opacity="0.12"/>` +
    `<stop offset="1" stop-color="${BRAND}" stop-opacity="0"/>` +
    `</linearGradient>` +
    `<linearGradient id="backBg" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="#FFFFFF"/>` +
    `<stop offset="0.46" stop-color="#F5F8FF"/>` +
    `<stop offset="1" stop-color="#E7EEFE"/>` +
    `</linearGradient>` +
    `</defs>`;

  // 出血:正面深色铺到左/上/下出血,背面浅色铺到右/上/下出血
  const bleedBg =
    `<rect x="0" y="0" width="${foldX}" height="${h}" fill="${INK}"/>` +
    `<rect x="${foldX}" y="0" width="${w - foldX}" height="${h}" fill="url(#backBg)"/>`;

  const fold = `<line x1="${foldX}" y1="${bleed}" x2="${foldX}" y2="${bleed + PANEL_H}" stroke="rgba(0,0,0,0.18)" stroke-width="0.12" stroke-dasharray="0.8 0.8"/>`;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}mm" height="${h}mm" viewBox="0 0 ${w} ${h}" role="img" aria-label="魔方开放社群二维码卡片">` +
    defs +
    bleedBg +
    front(bleed, bleed, quote, pattern) +
    back(foldX, bleed, entry, opts.url) +
    fold +
    (cropMarks ? cropMarksSvg(bleed, w, h) : "") +
    `</svg>`
  );
}
