import type { CSSProperties } from "react";
import type { CardEl, CardLayout, QrCode } from "@/lib/db/qr";
import {
  CUBE_FACES,
  DEFAULT_QUOTES,
  FRONT_ARTS,
  algImgUrl,
  backText,
  cubeFaceletSpots,
  formulaRow,
} from "@/lib/qr/cardText";

// 2x4cm 折叠卡:正面(slogan + 魔方艺术图)| 折线 | 背面(解法流派公式底纹 + 唯一二维码)。
// 尺寸走 --s 缩放变量:屏幕放大方便看,打印时由外层把 --s 设回 1 即精确 mm。
// 纯展示组件,svg(二维码)由调用方传入,卡片打印页与编辑页预览共用。

// 正面艺术背景图注册表从 cardText 共享(后台选择器 / 卡片轮换 / 矢量母版同源)
export { FRONT_ARTS };

const m = (n: number) => `calc(var(--s) * ${n}mm)`;

// 元素位置微调(编辑器拖动写入,mm):translate 只动自己,不影响兄弟布局
const elShift = (layout: CardLayout | null | undefined, key: CardEl): CSSProperties =>
  layout?.[key]
    ? { transform: `translate(${m(layout[key]!.x)}, ${m(layout[key]!.y)})` }
    : {};

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
function FrontPanel({
  quote,
  art,
  layout,
}: {
  quote: string;
  art: string;
  layout: CardLayout | null | undefined;
}) {
  const lines = quote.split("\n").map((l) => l.trim()).filter(Boolean);
  const [main, ...subs] = lines.length ? lines : ["热爱魔方"];
  // 正面图几何与矢量母版 cardSvg.ts 一致(默认出血 3mm):屏幕预览(此面板 20x40)裁掉出血
  // 只看成品,即印刷裁切后的真实画面;母版另渲出血,故图框须撑到盖住出血才不露底。
  // cover:图框以成品面中心为锚、26x46(left/top -3)盖住 左/上/下 出血,绕成品面中心缩放。
  // contain:整图完整装进成品面、留 1mm 安全边(18x38),不裁切,空余露深色底。
  // layout.front = 平移(mm)+ 缩放 s(绕成品面中心),编辑器拖动/滑块写入。
  const ft = layout?.front;
  // 默认完整显示不裁(contain);仅显式 cover 才铺满裁切
  const fitContain = ft?.fit !== "cover";
  // cover 缩放钳到 ≥1,与母版一致:cover 缩到 <1 会露底,违背「铺满」语义
  const drawScale = fitContain ? (ft?.s ?? 1) : Math.max(1, ft?.s ?? 1);
  return (
    <div
      data-panel="front"
      style={{
        ...PANEL_BASE,
        justifyContent: "flex-end",
        position: "relative",
        overflow: "hidden",
        color: "#fff",
        backgroundColor: "#11111A",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={art}
        alt=""
        aria-hidden
        draggable={false}
        style={{
          position: "absolute",
          // 压过 Tailwind preflight 的 img{max-width:100%;height:auto},
          // 否则绝对定位背景图宽被钳到 100% 致比例失真
          maxWidth: "none",
          maxHeight: "none",
          ...(fitContain
            ? {
                left: m(1),
                top: m(1),
                width: m(18),
                height: m(38),
                objectFit: "contain" as const,
                transformOrigin: `${m(9)} ${m(19)}`,
              }
            : {
                left: m(-3),
                top: m(-3),
                width: m(26),
                height: m(46),
                objectFit: "cover" as const,
                transformOrigin: `${m(13)} ${m(23)}`,
              }),
          transform: ft
            ? `translate(${m(ft.x)}, ${m(ft.y)}) scale(${drawScale})`
            : undefined,
        }}
      />
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
      <div
        data-el="quote"
        style={{ position: "relative", textAlign: "center", ...elShift(layout, "quote") }}
      >
        <div style={{ fontSize: m(2.6), fontWeight: 800, lineHeight: 1.18 }}>{main}</div>
        {subs.map((s, i) => (
          <div
            key={i}
            style={{ fontSize: m(1.4), color: "rgba(255,255,255,0.85)", lineHeight: 1.3, marginTop: m(0.4) }}
          >
            {s}
          </div>
        ))}
      </div>
      <div
        data-el="brand"
        style={{
          position: "relative",
          textAlign: "center",
          marginTop: m(1.2),
          fontSize: m(1.4),
          fontWeight: 700,
          letterSpacing: m(0.1),
          color: "rgba(255,255,255,0.92)",
          ...elShift(layout, "brand"),
        }}
      >
        魔方开放社群
      </div>
    </div>
  );
}

// 背面:唯一二维码(白芯片保证可扫)+ 按该码去向生成的文案 + 网址
function BackPanel({ entry, svg }: { entry: QrCode; svg: string }) {
  const term = entry.term?.trim();
  const { main, sub } = backText(entry);
  return (
    <div
      data-panel="back"
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
      {/* 散落魔方色块底纹(衬在二维码后,和正面同源散点) */}
      <div aria-hidden style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
        {cubeFaceletSpots().map((sp, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: m(1 + sp.x * 17),
              top: m(1 + sp.y * 37),
              width: m(sp.size),
              height: m(sp.size),
              borderRadius: m(sp.size * 0.2),
              background: CUBE_FACES[sp.colorIndex],
              opacity: sp.opacity,
              transform: `rotate(${sp.rot}deg)`,
            }}
          />
        ))}
      </div>
      {/* 解法流派 / 公式底纹(斜排淡蓝,衬在二维码后) */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: `${m(-4)} ${m(-3)}`,
          transform: "rotate(-8deg)",
          fontFamily: "ui-monospace, monospace",
          fontSize: m(1.1),
          lineHeight: 2.45,
          color: "#2A5DF4",
          opacity: 0.08,
          whiteSpace: "nowrap",
          pointerEvents: "none",
        }}
      >
        {Array.from({ length: 16 }, (_, i) => (
          <div key={i}>{formulaRow(i)}</div>
        ))}
      </div>
      <div
        data-el="backText"
        style={{
          position: "relative",
          textAlign: "center",
          lineHeight: 1.25,
          ...elShift(entry.layout, "backText"),
        }}
      >
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
        {!entry.alg?.moves && term ? (
          <div
            data-el="term"
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
              ...elShift(entry.layout, "term"),
            }}
          >
            {term}
          </div>
        ) : null}
        <div
          data-el="qr"
          style={{
            background: "#fff",
            borderRadius: m(1.4),
            padding: m(0.8),
            border: `${m(0.14)} solid #E5E8EE`,
            boxShadow: "0 1px 4px rgba(30,74,203,0.14)",
            ...elShift(entry.layout, "qr"),
          }}
        >
          <div style={{ width: m(14.5), height: m(14.5) }} dangerouslySetInnerHTML={{ __html: svg }} />
        </div>
        {/* 精选公式:案例图(魔方)正上方对齐 记法,不显示名称 */}
        {entry.alg?.moves ? (
          <div
            data-el="alg"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: m(0.5),
              ...elShift(entry.layout, "alg"),
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={algImgUrl(entry.alg) ?? ""}
              alt="魔方案例"
              style={{ width: m(6), height: m(6), display: "block" }}
            />
            <div
              style={{
                fontSize: m(1.1),
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                fontWeight: 500,
                color: "#2A5DF4",
                letterSpacing: m(0.01),
                whiteSpace: "nowrap",
              }}
            >
              {entry.alg.moves}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// 四角裁切标记:对应印刷母版的裁切线(成品边外侧,落在出血里)。
// 黑线 + 白色描边(boxShadow spread),深色正面 / 浅色背面角上都看得见。
// 绝对定位、不占布局尺寸,故不影响卡片 bounding box 与编辑器热区测量。
function CropMarks() {
  const mark = (s: CSSProperties): CSSProperties => ({
    position: "absolute",
    background: "#111",
    boxShadow: `0 0 0 ${m(0.09)} #fff`,
    ...s,
  });
  const H = { width: m(3), height: m(0.12) }; // 横向裁切线
  const V = { width: m(0.12), height: m(3) }; // 纵向裁切线
  const a = m(-0.06); // 贴边(线宽一半)
  const o = m(-3.6); // 外端(成品边外 3.6mm,与母版一致)
  return (
    <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <span style={mark({ ...H, left: o, top: a })} />
      <span style={mark({ ...V, top: o, left: a })} />
      <span style={mark({ ...H, right: o, top: a })} />
      <span style={mark({ ...V, top: o, right: a })} />
      <span style={mark({ ...H, left: o, bottom: a })} />
      <span style={mark({ ...V, bottom: o, left: a })} />
      <span style={mark({ ...H, right: o, bottom: a })} />
      <span style={mark({ ...V, bottom: o, right: a })} />
    </div>
  );
}

// 一张折叠卡单元:正面 | 折线 | 背面,外框为裁剪虚线。
// cropMarks:叠加四角裁切标记(编辑预览开,与「带裁切线」母版一致;打印页默认关)。
export function QrCardUnit({
  entry,
  svg,
  idx = 0,
  cropMarks = false,
}: {
  entry: QrCode;
  svg: string;
  idx?: number;
  cropMarks?: boolean;
}) {
  const quote = entry.quote?.trim() || DEFAULT_QUOTES[idx % DEFAULT_QUOTES.length];
  const art = entry.frontArt?.trim() || FRONT_ARTS[idx % FRONT_ARTS.length].src;
  return (
    <div
      className="qr-unit"
      style={{
        display: "flex",
        position: "relative",
        border: `${m(0.2)} dashed #c4c9d4`,
        background: "#fff",
      }}
    >
      <FrontPanel quote={quote} art={art} layout={entry.layout} />
      <div style={{ borderLeft: `${m(0.2)} dotted #c4c9d4` }} />
      <BackPanel entry={entry} svg={svg} />
      {cropMarks ? <CropMarks /> : null}
    </div>
  );
}
