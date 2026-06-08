import type { QrCode } from "@/lib/db/qr";

// 卡片文案逻辑(纯函数,DOM 卡片 QrCard.tsx 与矢量导出 cardSvg.ts 共用,避免两处漂移)。

// 正面艺术背景图注册表(后台缩略图选择器 + 卡片轮换 + 矢量母版内嵌共用同一份)
export const FRONT_ARTS: { src: string; label: string }[] = [
  { src: "/card/front-ink.webp", label: "流彩泼墨" },
  { src: "/card/front-city.webp", label: "微缩世界" },
];

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

// 背面主标题 / 副标题:优先用后台填的 title/intro,否则按类型 + 去向兜底
export function backText(entry: QrCode): { main: string; sub: string } {
  const isLanding = entry.type === "landing";
  const dest = destLabel(entry.target);
  const main =
    entry.title?.trim() ||
    (isLanding ? "扫码进社群" : dest ? `扫码直达${dest}` : "扫码直达");
  const sub =
    entry.intro?.trim() ||
    (isLanding
      ? entry.links && entry.links.length > 0
        ? entry.links.map((l) => l.label).join(" / ")
        : "课程 / 商城 / 赛事 / 社群"
      : "");
  return { main, sub };
}
