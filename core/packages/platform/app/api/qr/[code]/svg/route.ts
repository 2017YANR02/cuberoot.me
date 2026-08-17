import { qrTargetUrl } from "@/lib/site";
import { qrSvg } from "@/lib/qr/svg";

export const runtime = "nodejs";

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

  const url = new URL(req.url);
  const logo = url.searchParams.get("logo") !== "0";
  const fg = url.searchParams.get("fg");

  const svg = qrSvg(qrTargetUrl(code), {
    logo,
    fg: fg && /^#[0-9a-fA-F]{6}$/.test(fg) ? fg : undefined,
  });

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
