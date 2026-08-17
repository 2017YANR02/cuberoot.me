import type { CardCustomText, CardEl, CardLayout, CardTextStyles, QrCode, TextStyle } from "@/lib/db/qr";
import { qrSvgBody, cubeLogo, CUBE_FACES } from "./svg";
import { backText, frontQuote, frontBrand, FORMULA_TOKENS, cubeFaceletSpots, fontStack } from "./cardText";

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
  backArt?: string; // 背面背景图 data URI / URL;有则内嵌位图背景 + 压亮罩,无则默认底纹
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

// 元素位置微调:把一段 svg 包进 translate 组(无偏移原样返回),与 DOM 卡 elShift 同语义
const shift = (layout: CardLayout | null | undefined, key: CardEl, body: string): string => {
  const o = layout?.[key];
  return o && (o.x !== 0 || o.y !== 0)
    ? `<g transform="translate(${o.x} ${o.y})">${body}</g>`
    : body;
};

function text(
  x: number,
  y: number,
  size: number,
  fill: string,
  content: string,
  opts: {
    weight?: number;
    mono?: boolean;
    spacing?: number;
    anchor?: string;
    font?: string; // 覆盖字体栈(用户选字体);否则按 mono 选 MONO/FONT
    stroke?: string; // 描边色
    strokeW?: number; // 描边宽 mm(paint-order 让描边在字底)
  } = {},
): string {
  const { weight = 400, mono = false, spacing, anchor = "middle", font, stroke, strokeW } = opts;
  return (
    `<text x="${x}" y="${y}" font-family="${font ?? (mono ? MONO : FONT)}" font-size="${size}" ` +
    `font-weight="${weight}" fill="${fill}" text-anchor="${anchor}"` +
    (spacing ? ` letter-spacing="${spacing}"` : "") +
    (stroke && strokeW
      ? ` stroke="${stroke}" stroke-width="${strokeW}" paint-order="stroke" stroke-linejoin="round"`
      : "") +
    `>${esc(content)}</text>`
  );
}

// 自建文本框 → SVG <text>:面板中心 +(x,y)mm 偏移,多行各自一行垂直居中。defColor 随面板深浅。
function customTextsSvg(
  items: CardCustomText[],
  cxC: number,
  cyC: number,
  defColor: string,
): string {
  return items
    .map((ct) => {
      const st = styled(ct.style, 2.4, defColor);
      const lines = ct.text.split("\n");
      const lh = st.size * 1.2;
      const x = cxC + ct.x;
      const startY = cyC + ct.y - ((lines.length - 1) * lh) / 2 + st.size * 0.35;
      return lines
        .map((ln, i) =>
          text(x, startY + i * lh, st.size, st.fill, ln, {
            weight: 600,
            font: st.font,
            stroke: st.stroke,
            strokeW: st.strokeW,
          }),
        )
        .join("");
    })
    .join("");
}

// 文字样式 → text() 用的尺寸 / 填色 / 字体栈 / 描边(集中一处,DOM 卡 txtCss 同语义)
function styled(
  st: (TextStyle & { hidden?: boolean }) | undefined,
  baseSize: number,
  defFill: string,
  defMono = false,
): { size: number; fill: string; font: string; stroke?: string; strokeW?: number } {
  const on = !!(st?.stroke && st?.strokeW);
  return {
    size: Math.round(baseSize * (st?.size ?? 1) * 1000) / 1000,
    fill: st?.color || defFill,
    font: fontStack(st?.font) ?? (defMono ? MONO : FONT),
    stroke: on ? st!.stroke : undefined,
    strokeW: on ? st!.strokeW : undefined,
  };
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

// 正面 / 背面共用的背景图层(内嵌位图):与 DOM 卡 QrCard.tsx 的 ArtImage 同一套几何。
// cover(铺满):画框 = 成品面四周各外扩出血(slice 裁满),绕成品面中心缩放,缩放钳 ≥1 绝不露底。
// contain(默认完整显示):整图装进成品面、留 1mm 安全边(meet 不裁切),四周露底色。
// ft = 平移(mm)+ 缩放 s(绕成品面中心);x0/top 为该面板左上角,bleed 出血。
function artLayer(
  art: string,
  x0: number,
  top: number,
  bleed: number,
  ft: { x: number; y: number; s?: number; fit?: "contain" | "cover" } | undefined,
): string {
  const cx = x0 + PANEL_W / 2;
  const cy = top + PANEL_H / 2;
  const fitContain = ft?.fit !== "cover";
  const img = fitContain
    ? `<image href="${art}" x="${x0 + 1}" y="${top + 1}" width="${PANEL_W - 2}" height="${PANEL_H - 2}" preserveAspectRatio="xMidYMid meet"/>`
    : `<image href="${art}" x="${x0 - bleed}" y="${top - bleed}" width="${PANEL_W + 2 * bleed}" height="${PANEL_H + 2 * bleed}" preserveAspectRatio="xMidYMid slice"/>`;
  // cover 缩放钳到 ≥1(cover 缩到 <1 会从边缘露底,违背「铺满」语义)
  const drawScale = fitContain ? (ft?.s ?? 1) : Math.max(1, ft?.s ?? 1);
  return ft
    ? `<g transform="translate(${ft.x} ${ft.y}) translate(${cx} ${cy}) scale(${drawScale}) translate(${-cx} ${-cy})">${img}</g>`
    : img;
}

// 正面:魔方艺术图(内嵌位图,印满含出血)+ 底部压暗 + slogan + 品牌名。
// 无艺术图时退回全矢量(深色 + 散落魔方色块 + logo),保证始终能出图。
// art 为 data URI 或可达 URL;artW/artH 是正面含出血的覆盖区(0..foldX, 0..h)。
// 返回 { bg, fg } 分层:文字 fg 由调用方统一画在两面 bg 之上,文字才能拖过折线压在对面背景上。
function front(
  bleed: number,
  foldX: number,
  h: number,
  quote: string,
  brand: string,
  pattern: boolean,
  art: string | undefined,
  layout: CardLayout | null | undefined,
  styles: CardTextStyles | null | undefined,
  customTexts: CardCustomText[],
): { bg: string; fg: string } {
  const x0 = bleed;
  const top = bleed;
  const cx = x0 + PANEL_W / 2;
  const customEls = customTextsSvg(customTexts, cx, top + PANEL_H / 2, "#FFFFFF");
  const lines = quote.split("\n").map((l) => l.trim()).filter(Boolean);
  const main = lines[0] ?? "热爱魔方";
  const subs = lines.slice(1);

  const qs = styles?.quote;
  const bs = styles?.brand;
  const qMain = styled(qs, 2.8, "#FFFFFF");
  const qSub = styled(qs, 1.4, "rgba(255,255,255,0.85)");
  const bSt = styled(bs, 1.4, "rgba(255,255,255,0.92)");
  const qMul = qs?.size ?? 1; // 字号倍率,带动多行间距防重叠
  const mainY = top + PANEL_H - 9;
  const subEls = subs
    .map((s, i) =>
      text(cx, mainY + 2 + i * 1.7 * qMul, qSub.size, qSub.fill, s, {
        font: qSub.font,
        stroke: qSub.stroke,
        strokeW: qSub.strokeW,
      }),
    )
    .join("");
  const brandY = mainY + 2 + subs.length * 1.7 * qMul + 2.6;
  const quoteEl = qs?.hidden
    ? ""
    : shift(
        layout,
        "quote",
        text(cx, mainY, qMain.size, qMain.fill, main, {
          weight: 800,
          font: qMain.font,
          stroke: qMain.stroke,
          strokeW: qMain.strokeW,
        }) + subEls,
      );
  const brandEl = bs?.hidden
    ? ""
    : shift(
        layout,
        "brand",
        text(cx, brandY, bSt.size, bSt.fill, brand, {
          weight: 700,
          spacing: 0.1,
          font: bSt.font,
          stroke: bSt.stroke,
          strokeW: bSt.strokeW,
        }),
      );
  const fg = quoteEl + brandEl + customEls;

  if (art) {
    // 艺术图正面:几何与 DOM 卡 QrCard.tsx 同源(见 artLayer 注释)。变换后可能越界,clip 回正面出血区。
    const body = artLayer(art, x0, top, bleed, layout?.front);
    return {
      bg:
        `<rect x="0" y="0" width="${foldX}" height="${h}" fill="${INK}"/>` +
        `<g clip-path="url(#frontArtClip)">${body}</g>` +
        `<rect x="0" y="0" width="${foldX}" height="${h}" fill="url(#frontShade)"/>`,
      fg,
    };
  }

  // 无图回退:全矢量深色封面
  const logoSize = 7.5;
  return {
    bg:
      `<rect x="${x0}" y="${top}" width="${PANEL_W}" height="${PANEL_H}" fill="${INK}"/>` +
      (pattern ? cubeFacelets(x0, top, "frontClip") : "") +
      `<rect x="${x0}" y="${top}" width="${PANEL_W}" height="${PANEL_H}" fill="url(#frontGlow)"/>` +
      cubeLogo(cx - logoSize / 2, top + 5, logoSize),
    fg,
  };
}

// 把一段 <svg> 作为嵌套矢量放进卡片坐标(保留其 viewBox,只改外层 x/y/尺寸)
function embedSvg(svg: string, x: number, y: number, size: number): string {
  const inner = svg.replace(/^<\?xml[^>]*>\s*/i, "").trim();
  return inner.replace(/^<svg([^>]*)>/i, (_m, attrs: string) => {
    const cleaned = attrs.replace(/\s(width|height|x|y)="[^"]*"/gi, "");
    return `<svg${cleaned} x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${size}" height="${size}">`;
  });
}

// 背面:浅色 + 流派/公式底纹(或背景图 + 压亮罩)+ 案例图/术语 + 标题 + 二维码 + 公式 + 网址。
// 有背景图(backArt)时衬底图 + 压亮罩(保文字 / 码可读)并隐去默认底纹;二维码白芯片始终在。
function back(
  x0: number,
  top: number,
  entry: QrCode,
  url: string,
  pattern: boolean,
  algSvg?: string,
  movesPath?: { d: string; width: number },
  backArt?: string,
): { bg: string; fg: string } {
  const cx = x0 + PANEL_W / 2;
  const { main, sub } = backText(entry);
  const term = entry.term?.trim();
  const ts = entry.textStyles;
  const hasAlg = !!entry.alg?.moves && !ts?.alg?.hidden;
  const hasBackArt = !!backArt;

  // 二维码白芯片:小卡用 margin:2 让码点更大更好扫,白底兼当静默区。
  // 有精选公式时二维码上移腾出下方空间(放 案例图 + 公式)。
  const { inner, dim } = qrSvgBody(url, { margin: 2, fg: BRAND });
  const chip = 14.5;
  const pad = 0.9;
  const chipX = cx - chip / 2;
  const chipTop = top + (hasAlg ? 12 : 15.75);
  const scale = (chip - pad * 2) / dim;
  // 二维码缩放 s(绕芯片中心),与 DOM 卡 elTransform 同语义;shift 再叠加平移
  const qrScale = entry.layout?.qr?.s ?? 1;
  const qcy = chipTop + chip / 2;
  const chipBody =
    `<rect x="${chipX}" y="${chipTop}" width="${chip}" height="${chip}" rx="1.4" fill="#FFFFFF" stroke="#E5E8EE" stroke-width="0.14"/>` +
    `<g transform="translate(${(chipX + pad).toFixed(3)} ${(chipTop + pad).toFixed(3)}) scale(${scale.toFixed(4)})">${inner}</g>`;
  const scaledChip =
    qrScale !== 1
      ? `<g transform="translate(${cx} ${qcy}) scale(${qrScale}) translate(${-cx} ${-qcy})">${chipBody}</g>`
      : chipBody;
  const qr = shift(entry.layout, "qr", scaledChip);

  // 术语角标:仅无精选公式时显示在二维码上方(可删除/改样式)
  const tSt = styled(ts?.term, 1.1, BRAND_DARK);
  const termEl = !hasAlg && term && !ts?.term?.hidden
    ? shift(
        entry.layout,
        "term",
        `<rect x="${cx - (term.length * 1.2 + 1.8) / 2}" y="${chipTop - 3.4}" width="${term.length * 1.2 + 1.8}" height="2.4" rx="1.2" fill="rgba(42,93,244,0.10)" stroke="rgba(42,93,244,0.28)" stroke-width="0.12"/>` +
          text(cx, chipTop - 1.7, tSt.size, tSt.fill, term, { weight: 700, spacing: 0.06, font: tSt.font, stroke: tSt.stroke, strokeW: tSt.strokeW }),
      )
    : "";

  // 精选公式区:案例图(魔方)正上方对齐 记法,衬在二维码下方。不显示名称。
  // 记法默认用矢量轮廓(movesPath,最精确);一旦用户改了字体/字号/颜色/描边则改用 <text> 应用样式。
  let algEl = "";
  if (hasAlg) {
    const cubeSize = 6;
    const caseImg = algSvg ? embedSvg(algSvg, cx - cubeSize / 2, top + 26.8, cubeSize) : "";
    const movesY = top + 34.8;
    const algSt = ts?.alg;
    const algStyled = !!(algSt && (algSt.font || algSt.size || algSt.color || algSt.stroke));
    const mv = styled(algSt, 1.1, BRAND, true);
    const movesEl =
      movesPath && !algStyled
        ? `<path transform="translate(${(cx - movesPath.width / 2).toFixed(3)} ${movesY})" d="${movesPath.d}" fill="${BRAND}"/>`
        : text(cx, movesY, mv.size, mv.fill, entry.alg!.moves, { weight: 500, font: mv.font, stroke: mv.stroke, strokeW: mv.strokeW });
    algEl = shift(entry.layout, "alg", caseImg + movesEl);
  }

  // 背景层:有背景图 → 衬底图(clip 在背面含出血区);无图 → 默认色块 / 公式底纹
  const bg = hasBackArt
    ? `<g clip-path="url(#backArtClip)">${artLayer(backArt!, x0, top, top, entry.layout?.back)}</g>`
    : (pattern ? cubeFacelets(x0, top, "backClip") : "") +
      (pattern ? notationPattern(x0, top, "backClip", BRAND, 0.08) : "");

  // 背面标题 / 简介(可删除/改样式;均按 \n 分多行,行距 1.25 与 DOM 卡 pre-line 同);字号放大时副标题下移防重叠
  const bts = ts?.backText;
  const btMain = styled(bts, 1.6, BRAND_DARK);
  const btSub = styled(bts, 1.2, "#6B7280");
  const btMul = bts?.size ?? 1;
  const mainLines = main.split("\n");
  const subLines = sub ? sub.split("\n") : [];
  const mainLH = btMain.size * 1.25;
  const subLH = btSub.size * 1.25;
  const mainY0 = top + 6.5;
  const mainEls = mainLines
    .map((ln, i) =>
      text(cx, mainY0 + i * mainLH, btMain.size, btMain.fill, ln, {
        weight: 700,
        font: btMain.font,
        stroke: btMain.stroke,
        strokeW: btMain.strokeW,
      }),
    )
    .join("");
  const subY0 = mainY0 + (mainLines.length - 1) * mainLH + 2.9 * btMul;
  const subEls = subLines
    .map((ln, i) =>
      text(cx, subY0 + i * subLH, btSub.size, btSub.fill, ln, {
        font: btSub.font,
        stroke: btSub.stroke,
        strokeW: btSub.strokeW,
      }),
    )
    .join("");
  const backTextEl = bts?.hidden ? "" : shift(entry.layout, "backText", mainEls + subEls);

  const customEls = customTextsSvg(
    (entry.customTexts ?? []).filter((c) => c.side === "back"),
    cx,
    top + PANEL_H / 2,
    INK,
  );

  return {
    bg:
      `<rect x="${x0}" y="${top}" width="${PANEL_W}" height="${PANEL_H}" fill="url(#backBg)"/>` +
      bg,
    fg: backTextEl + termEl + qr + algEl + customEls,
  };
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
  const brand = frontBrand(entry);
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
    `<clipPath id="frontArtClip"><rect x="0" y="0" width="${foldX}" height="${h}"/></clipPath>` +
    `<clipPath id="backArtClip"><rect x="${foldX}" y="0" width="${w - foldX}" height="${h}"/></clipPath>` +
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

  const f = front(
    bleed,
    foldX,
    h,
    quote,
    brand,
    pattern,
    opts.art,
    entry.layout,
    entry.textStyles,
    (entry.customTexts ?? []).filter((c) => c.side === "front"),
  );
  const b = back(foldX, bleed, entry, opts.url, pattern, opts.algSvg, opts.movesPath, opts.backArt);

  // 先铺两面背景,再叠两面文字 / 二维码:任一面的文字拖过折线都压在对面背景之上(与 DOM 卡 z-index 同效)
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}mm" height="${h}mm" viewBox="0 0 ${w} ${h}" role="img" aria-label="魔方开放社群二维码卡片">` +
    defs +
    bleedBg +
    f.bg +
    b.bg +
    f.fg +
    b.fg +
    fold +
    (cropMarks ? cropMarksSvg(bleed, w, h) : "") +
    `</svg>`
  );
}
