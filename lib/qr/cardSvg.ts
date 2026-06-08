import type { QrCode } from "@/lib/db/qr";
import { qrSvgBody, cubeLogo, CUBE_FACES } from "./svg";
import { backText, frontQuote, FORMULA_TOKENS, cubeFaceletSpots } from "./cardText";

// 整张折叠卡的「印刷母版」:单个自包含、100% 矢量的 SVG(无位图、无 CSS、无外链)。
// 二维码 / 文字 / 配色 / 魔方图形全是矢量路径,印刷厂可直接收、无限放大不糊。
// 单位 mm:viewBox 即物理尺寸。flat 40x40mm(正面 20 | 折线 | 背面 20),含出血 + 裁切线。
//
// 字体提醒:文本用 <text> 走系统字体栈。送印前建议在 Illustrator 里「创建轮廓」
// (Type → Create Outlines),或确认印厂装了中文字体,避免缺字回退。

type CardSvgOptions = {
  url: string; // 印进二维码里的落地地址(背面也显示这串,去协议)
  quote?: string; // 正面语录,\n 分行;不传按默认轮换
  art?: string; // 正面艺术图 data URI / URL;有则内嵌位图正面,无则全矢量回退
  algSvg?: string; // 案例图(visualcube SVG 源串),内嵌为矢量放二维码上方
  movesPath?: { d: string; width: number }; // 记法的矢量轮廓(fontSize 1.1mm),最稳的字体方案
  monoFont?: string; // JetBrains Mono woff2 的 data URI;母版内嵌 @font-face 让记法字体独立可渲染
  bleed?: number; // 出血 mm,默认 3
  cropMarks?: boolean; // 角裁切线,默认 true
  pattern?: boolean; // 底纹(背面流派公式 + 无图时正面色块),默认 true
  idx?: number; // 默认语录轮换序号
};

const PANEL_W = 20;
const PANEL_H = 40;
const FONT = "-apple-system, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif";
// 记法字体对齐主站 alg 工具(JetBrains Mono);母版里由 monoFont 内嵌 @font-face 兜底
const MONO = "'JetBrains Mono', ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace";
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

// 斜排淡色记法 / 流派文字底纹,clip 在指定面板内。fill / opacity 由调用方按深浅底定。
function notationPattern(
  x0: number,
  top: number,
  clipId: string,
  fill: string,
  opacity: number,
): string {
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
      `<text x="${x0 + dx}" y="${y.toFixed(2)}" font-family="${MONO}" font-size="1.4" fill="${fill}" fill-opacity="${opacity}">${esc(seq.join("   "))}</text>`,
    );
  }
  return `<g clip-path="url(#${clipId})"><g transform="rotate(-8 ${cx} ${cy})">${rows.join("")}</g></g>`;
}

// 散落的六色魔方色块(魔方面块),低透明度,clip 在指定面板内。正面 / 背面共用,散点同源。
function cubeFacelets(x0: number, top: number, clipId: string): string {
  const out = cubeFaceletSpots().map((sp) => {
    const fx = x0 + 1 + sp.x * (PANEL_W - 3);
    const fy = top + 1 + sp.y * (PANEL_H - 3);
    const s = sp.size;
    const color = CUBE_FACES[sp.colorIndex];
    return `<rect x="${fx.toFixed(2)}" y="${fy.toFixed(2)}" width="${s.toFixed(2)}" height="${s.toFixed(2)}" rx="${(s * 0.2).toFixed(2)}" fill="${color}" fill-opacity="${sp.opacity.toFixed(2)}" transform="rotate(${sp.rot.toFixed(1)} ${(fx + s / 2).toFixed(2)} ${(fy + s / 2).toFixed(2)})"/>`;
  });
  return `<g clip-path="url(#${clipId})">${out.join("")}</g>`;
}

// 正面:魔方艺术图(内嵌位图,印满含出血)+ 底部压暗 + slogan + 品牌名。
// 无艺术图时退回全矢量(深色 + 散落魔方色块 + logo),保证始终能出图。
// art 为 data URI 或可达 URL;artW/artH 是正面含出血的覆盖区(0..foldX, 0..h)。
function front(
  bleed: number,
  foldX: number,
  h: number,
  quote: string,
  pattern: boolean,
  art?: string,
): string {
  const x0 = bleed;
  const top = bleed;
  const cx = x0 + PANEL_W / 2;
  const lines = quote.split("\n").map((l) => l.trim()).filter(Boolean);
  const main = lines[0] ?? "热爱魔方";
  const subs = lines.slice(1);

  const mainY = top + PANEL_H - 9;
  const subEls = subs
    .map((s, i) => text(cx, mainY + 2 + i * 1.7, 1.4, "rgba(255,255,255,0.85)", s))
    .join("");
  const brandY = mainY + 2 + subs.length * 1.7 + 2.6;
  const slogan =
    text(cx, mainY, 2.8, "#FFFFFF", main, { weight: 800 }) +
    subEls +
    text(cx, brandY, 1.4, "rgba(255,255,255,0.92)", "魔方开放社群", { weight: 700, spacing: 0.1 });

  if (art) {
    // 艺术图铺满正面(含左/上/下出血),<image> slice 自带裁剪到该矩形
    return (
      `<rect x="0" y="0" width="${foldX}" height="${h}" fill="${INK}"/>` +
      `<image href="${art}" x="0" y="0" width="${foldX}" height="${h}" preserveAspectRatio="xMidYMid slice"/>` +
      `<rect x="0" y="0" width="${foldX}" height="${h}" fill="url(#frontShade)"/>` +
      slogan
    );
  }

  // 无图回退:全矢量深色封面
  const logoSize = 7.5;
  return (
    `<rect x="${x0}" y="${top}" width="${PANEL_W}" height="${PANEL_H}" fill="${INK}"/>` +
    (pattern ? cubeFacelets(x0, top, "frontClip") : "") +
    `<rect x="${x0}" y="${top}" width="${PANEL_W}" height="${PANEL_H}" fill="url(#frontGlow)"/>` +
    cubeLogo(cx - logoSize / 2, top + 5, logoSize) +
    slogan
  );
}

// 把一段 <svg> 作为嵌套矢量放进卡片坐标(保留其 viewBox,只改外层 x/y/尺寸)
function embedSvg(svg: string, x: number, y: number, size: number): string {
  const inner = svg.replace(/^<\?xml[^>]*>\s*/i, "").trim();
  return inner.replace(/^<svg([^>]*)>/i, (_m, attrs: string) => {
    const cleaned = attrs.replace(/\s(width|height|x|y)="[^"]*"/gi, "");
    return `<svg${cleaned} x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${size}" height="${size}">`;
  });
}

// 背面:浅色 + 流派/公式底纹 + 案例图/术语 + 标题 + 二维码 + 公式 + 网址。全矢量。
function back(
  x0: number,
  top: number,
  entry: QrCode,
  url: string,
  pattern: boolean,
  algSvg?: string,
  movesPath?: { d: string; width: number },
): string {
  const cx = x0 + PANEL_W / 2;
  const { main, sub } = backText(entry);
  const term = entry.term?.trim();
  const hasAlg = !!entry.alg?.moves;

  // 二维码白芯片:小卡用 margin:2 让码点更大更好扫,白底兼当静默区。
  // 有精选公式时二维码上移腾出下方空间(放 案例图 + 公式)。
  const { inner, dim } = qrSvgBody(url, { margin: 2, fg: BRAND });
  const chip = 14.5;
  const pad = 0.9;
  const chipX = cx - chip / 2;
  const chipTop = top + (hasAlg ? 12 : 15.75);
  const scale = (chip - pad * 2) / dim;
  const qr =
    `<rect x="${chipX}" y="${chipTop}" width="${chip}" height="${chip}" rx="1.4" fill="#FFFFFF" stroke="#E5E8EE" stroke-width="0.14"/>` +
    `<g transform="translate(${(chipX + pad).toFixed(3)} ${(chipTop + pad).toFixed(3)}) scale(${scale.toFixed(4)})">${inner}</g>`;

  // 术语角标:仅无精选公式时显示在二维码上方
  const termEl = !hasAlg && term
    ? `<rect x="${cx - (term.length * 1.2 + 1.8) / 2}" y="${chipTop - 3.4}" width="${term.length * 1.2 + 1.8}" height="2.4" rx="1.2" fill="rgba(42,93,244,0.10)" stroke="rgba(42,93,244,0.28)" stroke-width="0.12"/>` +
      text(cx, chipTop - 1.7, 1.1, BRAND_DARK, term, { weight: 700, spacing: 0.06 })
    : "";

  // 精选公式区:案例图(魔方)正上方对齐 记法,衬在二维码下方。不显示名称。
  // 记法优先用矢量轮廓(movesPath,任何查看器都精确),无则退回 <text>(JetBrains Mono)。
  let algEl = "";
  if (hasAlg) {
    const cubeSize = 6;
    const caseImg = algSvg ? embedSvg(algSvg, cx - cubeSize / 2, top + 26.8, cubeSize) : "";
    const movesY = top + 34.8;
    const movesEl = movesPath
      ? `<path transform="translate(${(cx - movesPath.width / 2).toFixed(3)} ${movesY})" d="${movesPath.d}" fill="${BRAND}"/>`
      : text(cx, movesY, 1.1, BRAND, entry.alg!.moves, { mono: true, weight: 500 });
    algEl = caseImg + movesEl;
  }

  return (
    `<rect x="${x0}" y="${top}" width="${PANEL_W}" height="${PANEL_H}" fill="url(#backBg)"/>` +
    (pattern ? cubeFacelets(x0, top, "backClip") : "") +
    (pattern ? notationPattern(x0, top, "backClip", BRAND, 0.08) : "") +
    text(cx, top + 6.5, 1.6, BRAND_DARK, main, { weight: 700 }) +
    (sub ? text(cx, top + 9.4, 1.2, "#6B7280", sub) : "") +
    termEl +
    qr +
    algEl +
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

  const fontFace = opts.monoFont
    ? `<style>@font-face{font-family:'JetBrains Mono';font-style:normal;font-weight:400 700;src:url(${opts.monoFont}) format('woff2');}</style>`
    : "";

  const defs =
    `<defs>` +
    fontFace +
    `<clipPath id="frontClip"><rect x="${bleed}" y="${bleed}" width="${PANEL_W}" height="${PANEL_H}"/></clipPath>` +
    `<clipPath id="backClip"><rect x="${foldX}" y="${bleed}" width="${PANEL_W}" height="${PANEL_H}"/></clipPath>` +
    `<linearGradient id="frontGlow" x1="0" y1="1" x2="0" y2="0">` +
    `<stop offset="0" stop-color="${BRAND}" stop-opacity="0.55"/>` +
    `<stop offset="0.45" stop-color="${BRAND}" stop-opacity="0.12"/>` +
    `<stop offset="1" stop-color="${BRAND}" stop-opacity="0"/>` +
    `</linearGradient>` +
    `<linearGradient id="frontShade" x1="0" y1="1" x2="0" y2="0">` +
    `<stop offset="0" stop-color="${INK}" stop-opacity="0.92"/>` +
    `<stop offset="0.42" stop-color="${INK}" stop-opacity="0.55"/>` +
    `<stop offset="1" stop-color="${INK}" stop-opacity="0"/>` +
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
    front(bleed, foldX, h, quote, pattern, opts.art) +
    back(foldX, bleed, entry, opts.url, pattern, opts.algSvg, opts.movesPath) +
    fold +
    (cropMarks ? cropMarksSvg(bleed, w, h) : "") +
    `</svg>`
  );
}
