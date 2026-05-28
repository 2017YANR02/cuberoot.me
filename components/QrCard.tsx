import type { CSSProperties } from "react";
import type { QrCode } from "@/lib/db/qr";
import { getSiteUrl } from "@/lib/site";

// 2x4cm 折叠卡:正面(语录 + 艺术图)| 折线 | 背面(唯一二维码)。
// 尺寸走 --s 缩放变量:屏幕放大方便看,打印时由外层把 --s 设回 1 即精确 mm。
// 纯展示组件,svg(二维码)由调用方传入,卡片打印页与编辑页预览共用。

// 正面默认语录(未填时按序轮换);第一行大字,其余行小字
const DEFAULT_QUOTES = [
  "慢就是快\n一次打乱 一次成长",
  "拧的是方块\n解的是心境",
  "手指快\n不如脑子快",
  "三阶之上\n皆是热爱",
  "热爱可抵\n万次打乱",
  "每一次复原\n都是新的开始",
];

// 正面艺术背景图可选项(后台缩略图选择器 + 卡片轮换共用同一份注册表)
export const FRONT_ARTS: { src: string; label: string }[] = [
  { src: "/card/front-ink.webp", label: "流彩泼墨" },
  { src: "/card/front-city.webp", label: "微缩世界" },
];

// 跳转码目标路径 → 中文目的地(背面文案用,告诉扫码人到底去哪)
const PATH_LABELS: Record<string, string> = {
  "/": "首页",
  "/courses": "课程",
  "/shop": "商城",
  "/events": "赛事",
  "/community": "社群",
  "/news": "资讯",
  "/instructors": "讲师",
  "/about": "关于",
  "/login": "登录",
  "/me/courses": "我的课程",
  "/orders": "我的订单",
};
function destLabel(target: string): string {
  const path = target.split("?")[0].replace(/\/+$/, "") || "/";
  if (PATH_LABELS[path]) return PATH_LABELS[path];
  const seg = "/" + (path.split("/")[1] ?? "");
  return PATH_LABELS[seg] ?? "";
}

const host = () => getSiteUrl().replace(/^https?:\/\//, "");
const m = (n: number) => `calc(var(--s) * ${n}mm)`;

const PANEL_BASE: CSSProperties = {
  width: m(20),
  height: m(40),
  padding: m(1.6),
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "space-between",
  boxSizing: "border-box",
};

// 正面:艺术图铺满 + 底部压暗 + 语录/品牌叠底(无二维码)。杂志封面式。
function FrontPanel({ quote, art }: { quote: string; art: string }) {
  const lines = quote.split("\n").map((l) => l.trim()).filter(Boolean);
  const [main, ...subs] = lines.length ? lines : ["热爱魔方"];
  return (
    <div
      style={{
        ...PANEL_BASE,
        justifyContent: "flex-end",
        position: "relative",
        overflow: "hidden",
        color: "#fff",
        backgroundColor: "#11111A",
        backgroundImage: `url(${art})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: "58%",
          background:
            "linear-gradient(to top, rgba(17,17,26,0.9) 0%, rgba(17,17,26,0.6) 42%, transparent 100%)",
        }}
      />
      <div style={{ position: "relative", textAlign: "center" }}>
        <div style={{ fontSize: m(2.6), fontWeight: 800, lineHeight: 1.18 }}>{main}</div>
        {subs.map((s, i) => (
          <div
            key={i}
            style={{ fontSize: m(1.4), color: "rgba(255,255,255,0.85)", lineHeight: 1.3, marginTop: m(0.4) }}
          >
            {s}
          </div>
        ))}
        <div
          style={{
            marginTop: m(1.2),
            fontSize: m(1.4),
            fontWeight: 700,
            letterSpacing: m(0.1),
            color: "rgba(255,255,255,0.92)",
          }}
        >
          魔方开放社群
        </div>
      </div>
    </div>
  );
}

// 背面:唯一二维码(白芯片保证可扫)+ 按该码去向生成的文案 + 网址
function BackPanel({ entry, svg }: { entry: QrCode; svg: string }) {
  const isLanding = entry.type === "landing";
  const dest = destLabel(entry.target);
  const term = entry.term?.trim();
  const main =
    entry.title?.trim() ||
    (isLanding ? "扫码进社群" : dest ? `扫码直达${dest}` : "扫码直达");
  const sub =
    entry.intro?.trim() ||
    (isLanding
      ? entry.links && entry.links.length > 0
        ? entry.links.map((l) => l.label).join(" / ")
        : "课程 / 商城 / 赛事 / 社群"
      : "");
  return (
    <div
      style={{
        ...PANEL_BASE,
        position: "relative",
        overflow: "hidden",
        color: "#11111A",
        background: "linear-gradient(165deg, #FFFFFF 0%, #F5F8FF 46%, #E7EEFE 100%)",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(42% 22% at 100% 0%, rgba(42,93,244,0.12), transparent 70%), radial-gradient(46% 24% at 0% 100%, rgba(42,93,244,0.10), transparent 70%)",
        }}
      />
      <div style={{ position: "relative", textAlign: "center", lineHeight: 1.25 }}>
        <div style={{ fontSize: m(1.6), fontWeight: 700, color: "#1E4ACB" }}>{main}</div>
        {sub ? (
          <div style={{ fontSize: m(1.2), color: "#6B7280", marginTop: m(0.5) }}>{sub}</div>
        ) : null}
      </div>
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: m(0.7),
        }}
      >
        {term ? (
          <div
            style={{
              fontSize: m(1.1),
              fontWeight: 700,
              letterSpacing: m(0.08),
              color: "#1E4ACB",
              background: "rgba(42,93,244,0.10)",
              border: `${m(0.12)} solid rgba(42,93,244,0.28)`,
              borderRadius: m(2),
              padding: `${m(0.2)} ${m(0.9)}`,
              whiteSpace: "nowrap",
            }}
          >
            {term}
          </div>
        ) : null}
        <div
          style={{
            background: "#fff",
            borderRadius: m(1.4),
            padding: m(0.8),
            border: `${m(0.14)} solid #E5E8EE`,
            boxShadow: "0 1px 4px rgba(30,74,203,0.14)",
          }}
        >
          <div style={{ width: m(14.5), height: m(14.5) }} dangerouslySetInnerHTML={{ __html: svg }} />
        </div>
      </div>
      <div
        style={{
          position: "relative",
          fontSize: m(1.1),
          color: "#9aa1ad",
          fontFamily: "ui-monospace, monospace",
          wordBreak: "break-all",
          textAlign: "center",
        }}
      >
        {host()}/qr/{entry.code}
      </div>
    </div>
  );
}

// 一张折叠卡单元:正面 | 折线 | 背面,外框为裁剪虚线
export function QrCardUnit({
  entry,
  svg,
  idx = 0,
}: {
  entry: QrCode;
  svg: string;
  idx?: number;
}) {
  const quote = entry.quote?.trim() || DEFAULT_QUOTES[idx % DEFAULT_QUOTES.length];
  const art = entry.frontArt?.trim() || FRONT_ARTS[idx % FRONT_ARTS.length].src;
  return (
    <div
      className="qr-unit"
      style={{ display: "flex", border: `${m(0.2)} dashed #c4c9d4`, background: "#fff" }}
    >
      <FrontPanel quote={quote} art={art} />
      <div style={{ borderLeft: `${m(0.2)} dotted #c4c9d4` }} />
      <BackPanel entry={entry} svg={svg} />
    </div>
  );
}
