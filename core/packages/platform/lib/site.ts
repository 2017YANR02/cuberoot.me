export const SITE_NAME = "魔方开放社群";
export const SITE_DESCRIPTION =
  "汇聚精准流量、系统教学、教培、商城、赛事与高阶交流于一体的开放式兴趣社群,成为魔方爱好者的首选聚集地和成长家园。";

export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:3100";
  return raw.replace(/\/+$/, "");
}

// 二维码专用 base:印在卡片上的码就用这个域名编码。
// 将来上专用短域名(如 https://q.cuberoot.me)只需设 NEXT_PUBLIC_QR_BASE,
// 把它反代/302 到平台 /qr 路由即可,印刷流程与代码都不用动。
// 未设则退回站点域名,行为与之前一致。
export function getQrBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_QR_BASE?.trim();
  return raw ? raw.replace(/\/+$/, "") : getSiteUrl();
}

// 一个 code 印在码里的最终落地地址。短域名场景下生成 https://q.cuberoot.me/<code>,
// 否则 https://platform.cuberoot.me/qr/<code>。是否带 /qr 前缀由 NEXT_PUBLIC_QR_PATH 控制(默 "/qr")。
export function qrTargetUrl(code: string): string {
  const base = getQrBaseUrl();
  const prefixRaw = process.env.NEXT_PUBLIC_QR_PATH ?? "/qr";
  const prefix = prefixRaw === "" || prefixRaw === "/" ? "" : `/${prefixRaw.replace(/^\/+|\/+$/g, "")}`;
  return `${base}${prefix}/${code}`;
}

export function absoluteUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${getSiteUrl()}${p}`;
}

export function ogImageUrl(title: string): string {
  return `${getSiteUrl()}/og?title=${encodeURIComponent(title)}`;
}
