export const SITE_NAME = "魔方开放社群";
export const SITE_DESCRIPTION =
  "汇聚精准流量、系统教学、教培、商城、赛事与高阶交流于一体的开放式兴趣社群,成为魔方爱好者的首选聚集地和成长家园。";

export function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:3100";
  return raw.replace(/\/+$/, "");
}

export function absoluteUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${getSiteUrl()}${p}`;
}

export function ogImageUrl(title: string): string {
  return `${getSiteUrl()}/og?title=${encodeURIComponent(title)}`;
}
