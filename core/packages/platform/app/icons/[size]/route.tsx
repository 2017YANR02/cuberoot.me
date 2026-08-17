import { ImageResponse } from "next/og";

export const runtime = "nodejs";

const BRAND = "#2A5DF4";
const BRAND_DARK = "#1E4ACB";

type Spec = { px: number; maskable: boolean };

const SPECS: Record<string, Spec> = {
  "192": { px: 192, maskable: false },
  "512": { px: 512, maskable: false },
  "maskable-512": { px: 512, maskable: true },
};

export const dynamic = "force-static";
export const revalidate = false;

export function generateStaticParams() {
  return Object.keys(SPECS).map((size) => ({ size }));
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ size: string }> },
) {
  const { size } = await ctx.params;
  const spec = SPECS[size];
  if (!spec) {
    return new Response("not found", { status: 404 });
  }

  const { px, maskable } = spec;
  // Maskable 安全区在内 80%,所以 logo 缩到 60% 并居中,留出 corner 区域给系统 mask
  const inner = maskable ? Math.round(px * 0.6) : Math.round(px * 0.78);
  const radius = maskable ? 0 : Math.round(px * 0.22);
  const cell = Math.round(inner / 2.4);
  const gap = Math.round(inner * 0.06);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: BRAND,
          borderRadius: radius,
        }}
      >
        <div
          style={{
            width: inner,
            height: inner,
            display: "flex",
            flexWrap: "wrap",
            gap,
            alignContent: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ width: cell, height: cell, background: "#fff", borderRadius: cell * 0.15, display: "flex" }} />
          <div style={{ width: cell, height: cell, background: "rgba(255,255,255,0.55)", borderRadius: cell * 0.15, display: "flex" }} />
          <div style={{ width: cell, height: cell, background: "rgba(255,255,255,0.55)", borderRadius: cell * 0.15, display: "flex" }} />
          <div style={{ width: cell, height: cell, background: "#fff", borderRadius: cell * 0.15, display: "flex" }} />
        </div>
      </div>
    ),
    {
      width: px,
      height: px,
    },
  );
}
