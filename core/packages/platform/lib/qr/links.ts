import type { QrLink } from "@/lib/db/qr";

// 链接列表与文本互转,客户端 / 服务端共用(纯函数,无副作用)。
// 文本格式:每行 "标签 | 链接 | 备注(可选)";只写一段则当作 href,label 同值。
export function parseLinks(raw: string): QrLink[] {
  return raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const parts = l.split("|").map((p) => p.trim());
      if (parts.length === 1) return { label: parts[0], href: parts[0] };
      const [label, href, note] = parts;
      return {
        label: label || href || "链接",
        href: href || "/",
        note: note || undefined,
      };
    })
    .filter((x) => x.href);
}

export function linksToText(links: QrLink[] | null | undefined): string {
  if (!links || links.length === 0) return "";
  return links
    .map((l) =>
      l.label === l.href && !l.note
        ? l.href
        : [l.label, l.href, l.note].filter(Boolean).join(" | "),
    )
    .join("\n");
}
