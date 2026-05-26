import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

const BRAND = "#2A5DF4";
const BRAND_SOFT = "#EAF0FE";
const BRAND_TINT = "#F5F8FF";
const INK = "#1F2937";
const INK_3 = "#6B7280";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("title") ?? "魔方开放社群";
  const title = raw.length > 60 ? raw.slice(0, 58) + "…" : raw;
  const subtitle = searchParams.get("subtitle") ?? "一站式魔方垂直综合服务平台";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: `linear-gradient(135deg, ${BRAND_TINT} 0%, ${BRAND_SOFT} 100%)`,
          padding: "72px 80px",
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
          position: "relative",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none">
            <rect x="2" y="2" width="9" height="9" rx="1.5" fill={BRAND} />
            <rect x="13" y="2" width="9" height="9" rx="1.5" fill={BRAND} opacity="0.35" />
            <rect x="2" y="13" width="9" height="9" rx="1.5" fill={BRAND} opacity="0.35" />
            <rect x="13" y="13" width="9" height="9" rx="1.5" fill={BRAND} />
          </svg>
          <div
            style={{
              fontSize: 28,
              color: INK,
              fontWeight: 600,
              letterSpacing: 0.5,
            }}
          >
            魔方开放社群
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            flex: 1,
            paddingTop: 40,
            paddingBottom: 40,
          }}
        >
          <div
            style={{
              fontSize: title.length > 24 ? 64 : 80,
              fontWeight: 700,
              color: INK,
              lineHeight: 1.15,
              display: "flex",
            }}
          >
            {title}
          </div>
          <div
            style={{
              marginTop: 28,
              fontSize: 28,
              color: INK_3,
              display: "flex",
            }}
          >
            {subtitle}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            color: BRAND,
            fontSize: 22,
          }}
        >
          <div style={{ display: "flex", gap: 28 }}>
            <span>课程</span>
            <span>商城</span>
            <span>赛事</span>
            <span>社群</span>
          </div>
          <div style={{ color: INK_3, fontSize: 20 }}>cube.community</div>
        </div>

        <div
          style={{
            position: "absolute",
            right: -120,
            bottom: -120,
            width: 480,
            height: 480,
            borderRadius: 240,
            background: BRAND,
            opacity: 0.08,
            display: "flex",
          }}
        />
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
