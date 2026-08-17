import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexWrap: "wrap",
          background: "#2A5DF4",
          borderRadius: 6,
          padding: 3,
          gap: 2,
        }}
      >
        <div style={{ width: 12, height: 12, background: "#fff", borderRadius: 2, display: "flex" }} />
        <div style={{ width: 12, height: 12, background: "rgba(255,255,255,0.55)", borderRadius: 2, display: "flex" }} />
        <div style={{ width: 12, height: 12, background: "rgba(255,255,255,0.55)", borderRadius: 2, display: "flex" }} />
        <div style={{ width: 12, height: 12, background: "#fff", borderRadius: 2, display: "flex" }} />
      </div>
    ),
    { ...size },
  );
}
