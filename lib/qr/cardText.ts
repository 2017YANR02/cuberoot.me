import type { QrAlg, QrCode } from "@/lib/db/qr";

// 背面精选公式文本互转。格式:"名称 | 记法 | 链接"(后两段可省;只写一段当记法)。
export function parseAlg(raw: string): QrAlg | null {
  const parts = raw.split("|").map((s) => s.trim());
  if (parts.length === 1) {
    return parts[0] ? { moves: parts[0] } : null;
  }
  const [name, moves, url] = parts;
  const mv = (moves || name || "").trim();
  if (!mv) return null;
  return { name: name || undefined, moves: mv, url: url || undefined };
}

export function algToText(alg?: QrAlg | null): string {
  if (!alg?.moves) return "";
  return [alg.name, alg.moves, alg.url].filter(Boolean).join(" | ");
}

// 记法求逆(reverse + 每步取反),用作 visualcube 的 setup(从解法还原出案例状态)
export function inverseMoves(moves: string): string {
  return moves
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .reverse()
    .map((t) => (t.endsWith("'") ? t.slice(0, -1) : t.endsWith("2") ? t : t + "'"))
    .join(" ");
}

// 案例图视角(从名称推断):OLL 顶视 / F2L 立体 / PLL 顶视
function algView(alg: QrAlg): "oll" | "f2l" | "pll" {
  const n = (alg.name ?? "").toLowerCase();
  if (n.includes("f2l")) return "f2l";
  if (n.includes("pll")) return "pll";
  return "oll";
}

const VC_BASE = (process.env.NEXT_PUBLIC_VISUALCUBE_BASE || "https://api.cuberoot.me").replace(/\/+$/, "");

// 案例可视化图 URL(主站 visualcube,返回 SVG)。从解法记法自动推出 setup + 视角。
export function algImgUrl(alg?: QrAlg | null, size = 120): string | null {
  if (!alg?.moves) return null;
  const p = new URLSearchParams({
    view: algView(alg),
    size: String(size),
    setup: inverseMoves(alg.moves),
  });
  return `${VC_BASE}/v1/visualcube.svg?${p.toString()}`;
}

// 卡片文字字体注册表(DOM 卡 + 矢量母版共用同一份 font-family 栈;送印转轮廓兜底缺字)。
// key 存库,stack 是 CSS / SVG 的 font-family。
export const CARD_FONTS: { key: string; label: string; stack: string }[] = [
  { key: "sans", label: "黑体", stack: "-apple-system, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif" },
  { key: "serif", label: "宋体", stack: "'Songti SC', 'Noto Serif SC', 'SimSun', serif" },
  { key: "kai", label: "楷体", stack: "'Kaiti SC', 'STKaiti', 'KaiTi', 'Noto Serif SC', serif" },
  { key: "round", label: "圆体", stack: "'Yuanti SC', 'Hiragino Maru Gothic ProN', 'Microsoft YaHei', sans-serif" },
  { key: "mono", label: "等宽", stack: "'JetBrains Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace" },
];

// 字体 key → font-family 栈;未知 / 空返回 undefined(用元素默认字体)
export function fontStack(key?: string | null): string | undefined {
  if (!key) return undefined;
  return CARD_FONTS.find((f) => f.key === key)?.stack;
}

// 卡片文案逻辑(纯函数,DOM 卡片 QrCard.tsx 与矢量导出 cardSvg.ts 共用,避免两处漂移)。

// 正面艺术背景图注册表(后台缩略图选择器 + 卡片轮换 + 矢量母版内嵌共用同一份)
export const FRONT_ARTS: { src: string; label: string }[] = [
  { src: "/card/front-ink.webp", label: "流彩泼墨" },
  { src: "/card/front-city.webp", label: "微缩世界" },
];

// 魔方六面配色,logo / 色块散点底纹共用
export const CUBE_FACES = [
  "#C41E3A", "#FFFFFF", "#0051BA",
  "#FF8A00", "#FFD500", "#009E60",
  "#FFFFFF", "#C41E3A", "#FFD500",
];

export type FaceletSpot = {
  x: number; // 面板内 0..1
  y: number;
  size: number; // mm
  colorIndex: number; // CUBE_FACES 下标
  opacity: number;
  rot: number; // deg
};

// 散落魔方色块的确定性坐标(整数位运算哈希,避免 Math.random),DOM 卡与矢量卡共用同一份散点。
// 不能用 Math.sin 哈希:sin 末位精度因 V8 版本而异(Node vs 浏览器),会造成 SSR 水合不匹配。
export function cubeFaceletSpots(count = 14): FaceletSpot[] {
  const h = (i: number, seed: number) => {
    let t = Math.imul(i + 1, 0x9e3779b1) ^ Math.imul(seed + 1, 0x85ebca6b);
    t = Math.imul(t ^ (t >>> 15), 0x2b2ae35);
    t ^= t >>> 13;
    return (t >>> 0) / 4294967296;
  };
  return Array.from({ length: count }, (_, i) => ({
    x: h(i, 1),
    y: h(i, 2),
    size: 1.1 + h(i, 3) * 1.7,
    colorIndex: Math.floor(h(i, 4) * CUBE_FACES.length),
    opacity: 0.1 + h(i, 5) * 0.13,
    rot: h(i, 6) * 44 - 22,
  }));
}

// 魔方记法 + 解法流派缩写,背面底纹用。CFOP/Roux/ZZ/Petrus… 是主流流派。
export const FORMULA_TOKENS = [
  "R U R' U'", "F2L", "CFOP", "OLL", "PLL", "R' D' R D", "U R U' R'",
  "Cross", "F R U R' U' F'", "ZBLL", "Sune", "T-Perm", "Roux", "ZZ",
  "Petrus", "L' U' L U", "x2 y'", "R U2 R'", "COLL", "Mehta", "Heise",
];

// 一行 N 个 token 的底纹文本(背面 DOM / SVG 共用,保证流派词一致)
export function formulaRow(rowIndex: number, count = 6): string {
  const start = (rowIndex * 3) % FORMULA_TOKENS.length;
  const seq: string[] = [];
  for (let k = 0; k < count; k++) seq.push(FORMULA_TOKENS[(start + k * 2) % FORMULA_TOKENS.length]);
  return seq.join("   ");
}

// 正面默认语录(未填时按序轮换);第一行大字,其余行小字
export const DEFAULT_QUOTES = [
  "慢就是快\n一次打乱 一次成长",
  "拧的是方块\n解的是心境",
  "手指快\n不如脑子快",
  "三阶之上\n皆是热爱",
  "热爱可抵\n万次打乱",
  "每一次复原\n都是新的开始",
];

// 跳转码目标路径 → 中文目的地(背面文案用,告诉扫码人到底去哪)
const PATH_LABELS: Record<string, string> = {
  "/": "首页",
  "/courses": "课程",
  "/shop": "商城",
  "/events": "赛事",
  "/community": "社群",
  "/news": "资讯",
  "/instructors": "讲师",
  "/about": "关于",
  "/login": "登录",
  "/me/courses": "我的课程",
  "/orders": "我的订单",
};

export function destLabel(target: string): string {
  const path = target.split("?")[0].replace(/\/+$/, "") || "/";
  if (PATH_LABELS[path]) return PATH_LABELS[path];
  const seg = "/" + (path.split("/")[1] ?? "");
  return PATH_LABELS[seg] ?? "";
}

export function frontQuote(entry: Pick<QrCode, "quote">, idx = 0): string {
  return entry.quote?.trim() || DEFAULT_QUOTES[idx % DEFAULT_QUOTES.length];
}

// 背面主标题:优先用后台填的 title,否则按类型 + 去向兜底
// 副标题:完全跟随「简介」字段,留空即不显示(所见即所得,不自动拼链接名/兜底文案)
export function backText(entry: QrCode): { main: string; sub: string } {
  const isLanding = entry.type === "landing";
  const dest = destLabel(entry.target);
  const main =
    entry.title?.trim() ||
    (isLanding ? "扫码进社群" : dest ? `扫码直达${dest}` : "扫码直达");
  const sub = entry.intro?.trim() || "";
  return { main, sub };
}
