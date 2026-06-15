import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { getByCode } from "@/lib/db/certificates";

export const runtime = "nodejs";

const BRAND = "#2A5DF4";
const BRAND_SOFT = "#EAF0FE";
const BRAND_TINT = "#F5F8FF";
const INK = "#1F2937";
const INK_2 = "#374151";
const INK_3 = "#6B7280";
const LINE = "#E5E7EB";

function fmtDate(unixSec: number): string {
  const d = new Date(unixSec * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ code: string }> },
) {
  const { code } = await ctx.params;
  const cert = await getByCode(code);

  const userName = cert?.userName ?? "魔方学员";
  const courseTitle = cert?.courseTitle ?? "魔方系统课";
  const issuedAt = cert ? fmtDate(cert.issuedAt) : "";
  const codeText = cert?.code ?? code;
  const valid = Boolean(cert);

  const courseDisplay =
    courseTitle.length > 28 ? courseTitle.slice(0, 27) + "…" : courseTitle;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: `linear-gradient(135deg, ${BRAND_TINT} 0%, ${BRAND_SOFT} 100%)`,
          padding: 40,
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
          position: "relative",
        }}
      >
        {/* 内框,留白边模拟实体证书 */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            background: "#ffffff",
            border: `2px solid ${valid ? BRAND : LINE}`,
            borderRadius: 20,
            padding: "56px 72px",
            position: "relative",
            justifyContent: "space-between",
          }}
        >
          {/* 页眉:品牌 */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none">
              <rect x="2" y="2" width="9" height="9" rx="1.5" fill={BRAND} />
              <rect x="13" y="2" width="9" height="9" rx="1.5" fill={BRAND} opacity="0.35" />
              <rect x="2" y="13" width="9" height="9" rx="1.5" fill={BRAND} opacity="0.35" />
              <rect x="13" y="13" width="9" height="9" rx="1.5" fill={BRAND} />
            </svg>
            <div style={{ fontSize: 24, color: INK, fontWeight: 600, letterSpacing: 0.5 }}>
              魔方开放社群
            </div>
          </div>

          {/* 正文 */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 22, color: BRAND, fontWeight: 600, letterSpacing: 6 }}>
              结课证书
            </div>
            <div style={{ display: "flex", fontSize: 18, color: INK_3, marginTop: 8 }}>
              CERTIFICATE OF COMPLETION
            </div>
            <div style={{ display: "flex", fontSize: 64, color: INK, fontWeight: 700, marginTop: 28 }}>
              {userName}
            </div>
            <div style={{ display: "flex", fontSize: 22, color: INK_2, marginTop: 18, lineHeight: 1.4 }}>
              已完成课程
            </div>
            <div style={{ display: "flex", fontSize: 32, color: BRAND, fontWeight: 600, marginTop: 6 }}>
              {courseDisplay}
            </div>
          </div>

          {/* 页脚:日期 + 验证码 + 状态 */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", fontSize: 16, color: INK_3 }}>
                颁发日期 {issuedAt}
              </div>
              <div style={{ display: "flex", fontSize: 16, color: INK_3 }}>
                验证码 {codeText}
              </div>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                fontSize: 16,
                color: valid ? BRAND : INK_3,
                fontWeight: 600,
                background: valid ? BRAND_SOFT : "#F3F4F6",
                borderRadius: 999,
                padding: "8px 18px",
              }}
            >
              {valid ? "已认证 · platform.cuberoot.me" : "无效证书"}
            </div>
          </div>

          {/* 装饰圆 */}
          <div
            style={{
              position: "absolute",
              right: -90,
              bottom: -90,
              width: 320,
              height: 320,
              borderRadius: 160,
              background: BRAND,
              opacity: 0.06,
              display: "flex",
            }}
          />
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
