import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  const cell = 60;
  const gap = 8;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#2A5DF4",
        }}
      >
        <div
          style={{
            width: cell * 2 + gap,
            height: cell * 2 + gap,
            display: "flex",
            flexWrap: "wrap",
            gap,
          }}
        >
          <div style={{ width: cell, height: cell, background: "#fff", borderRadius: 10, display: "flex" }} />
          <div style={{ width: cell, height: cell, background: "rgba(255,255,255,0.55)", borderRadius: 10, display: "flex" }} />
          <div style={{ width: cell, height: cell, background: "rgba(255,255,255,0.55)", borderRadius: 10, display: "flex" }} />
          <div style={{ width: cell, height: cell, background: "#fff", borderRadius: 10, display: "flex" }} />
        </div>
      </div>
    ),
    { ...size },
  );
}
