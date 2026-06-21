import { readFile } from "node:fs/promises";
import path from "node:path";
import { findByCode } from "@/lib/db/qr";
import { qrTargetUrl } from "@/lib/site";
import { cardSvg } from "@/lib/qr/cardSvg";
import { FRONT_ARTS, algImgUrl } from "@/lib/qr/cardText";
import { movesPath } from "@/lib/qr/glyphs";

export const runtime = "nodejs";

const MIME: Record<string, string> = {
  webp: "image/webp",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  svg: "image/svg+xml",
  woff2: "font/woff2",
};

// 把 public 下的本地艺术图读成 data URI(自包含,印厂收到单文件即可)。
// 远端 http(s) 图直接引用;读失败返回 undefined(cardSvg 退回全矢量正面)。
async function resolveArt(src: string): Promise<string | undefined> {
  const s = src.trim();
  if (/^https?:\/\//i.test(s)) return s;
  if (!s.startsWith("/")) return undefined;
  try {
    const file = path.join(process.cwd(), "public", s.replace(/^\/+/, ""));
    const buf = await readFile(file);
    const ext = (s.split(".").pop() ?? "").toLowerCase();
    return `data:${MIME[ext] ?? "image/png"};base64,${buf.toString("base64")}`;
  } catch {
    return undefined;
  }
}

// 单张折叠卡印刷母版(SVG):/api/qr/<code>/card?bleed=3&crop=1
// 正面内嵌魔方艺术图位图、背面流派公式 + 二维码全矢量,自包含、含出血 + 裁切线。
// noart=1 强制全矢量正面(无照片)。
export async function GET(
  req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code: raw } = await params;
  const code = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 64);
  if (!code) return new Response("bad code", { status: 400 });

  const entry = await findByCode(code);
  if (!entry) return new Response("not found", { status: 404 });

  const url = new URL(req.url);
  const bleedParam = url.searchParams.get("bleed");
  const bleed =
    bleedParam !== null && Number.isFinite(Number(bleedParam))
      ? Math.max(0, Math.min(6, Number(bleedParam)))
      : 3;
  const cropMarks = url.searchParams.get("crop") !== "0";
  const pattern = url.searchParams.get("bg") !== "plain"; // bg=plain 关掉记法底纹
  const idx = Math.max(0, Math.floor(Number(url.searchParams.get("idx")) || 0));

  // 正面艺术图:优先该码自带,否则按 idx 轮换默认两张;noart=1 走全矢量正面
  const artSrc = entry.frontArt?.trim() || FRONT_ARTS[idx % FRONT_ARTS.length].src;
  const art =
    url.searchParams.get("noart") === "1" ? undefined : await resolveArt(artSrc);

  // 背面背景图:仅该码显式设置才有(无默认轮换);noart=1 一并关掉走默认底纹
  const backArtSrc = entry.backArt?.trim();
  const backArt =
    url.searchParams.get("noart") === "1" || !backArtSrc
      ? undefined
      : await resolveArt(backArtSrc);

  // 内嵌 JetBrains Mono(记法字体)作 url/底纹 兜底;精选公式则转矢量轮廓(最稳)
  const monoFont = await resolveArt("/fonts/jetbrains-mono-latin-500-normal.woff2");
  const moves = entry.alg?.moves
    ? (await movesPath(entry.alg.moves, 1.1)) ?? undefined
    : undefined;

  // 案例图:抓主站 visualcube 的 SVG 内嵌为矢量(失败则不显示,降级到术语角标)
  let algSvg: string | undefined;
  const imgUrl = entry.alg ? algImgUrl(entry.alg) : null;
  if (imgUrl) {
    try {
      const res = await fetch(imgUrl, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const body = await res.text();
        if (body.includes("<svg")) algSvg = body;
      }
    } catch {
      algSvg = undefined;
    }
  }

  const svg = cardSvg(entry, {
    url: qrTargetUrl(code),
    art,
    backArt,
    algSvg,
    movesPath: moves,
    monoFont,
    bleed,
    cropMarks,
    pattern,
    idx,
  });

  // dl=1 走 attachment 强制下载(前端「保存后自动下载」用,导航即下文件不离开页面)
  const download = url.searchParams.get("dl") === "1";
  const fileName = `card-${code}${cropMarks ? "" : "-nocrop"}.svg`;
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
