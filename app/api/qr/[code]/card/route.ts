import { findByCode } from "@/lib/db/qr";
import { qrTargetUrl } from "@/lib/site";
import { cardSvg } from "@/lib/qr/cardSvg";

export const runtime = "nodejs";

// 单张折叠卡的矢量母版(SVG):/api/qr/<code>/card?bleed=3&crop=1
// 全矢量、自包含,印刷厂可直接收。bleed 出血 mm,crop 裁切线。
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

  const svg = cardSvg(entry, {
    url: qrTargetUrl(code),
    bleed,
    cropMarks,
    pattern,
    idx,
  });

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Content-Disposition": `inline; filename="card-${code}.svg"`,
      "Cache-Control": "no-store",
    },
  });
}
