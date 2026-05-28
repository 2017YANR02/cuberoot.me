import type { CSSProperties } from "react";
import Link from "next/link";
import { list, type QrCode } from "@/lib/db/qr";
import { absoluteUrl, getSiteUrl } from "@/lib/site";
import { qrSvg } from "@/lib/qr/svg";
import { PageHeader, GhostLink } from "../../../_components/Shell";
import { PrintButton } from "./_PrintButton";

export const dynamic = "force-dynamic";

// 正面默认语录(未填时按序轮换);第一行大字,其余行小字
const DEFAULT_QUOTES = [
  "慢就是快\n一次打乱 一次成长",
  "拧的是方块\n解的是心境",
  "手指快\n不如脑子快",
  "三阶之上\n皆是热爱",
  "热爱可抵\n万次打乱",
  "每一次复原\n都是新的开始",
];

// 魔方六面色,正面顶部装饰条
const CUBE_STRIP = ["#C41E3A", "#FF8A00", "#FFD500", "#009E60", "#0051BA", "#FFFFFF"];

const host = () => getSiteUrl().replace(/^https?:\/\//, "");

// 物理尺寸 × 屏幕缩放变量 --s(屏幕放大方便看,打印时 --s=1 回到精确 mm)
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

// 正面:魔方色块条 + 语录 + 品牌(无二维码)
function FrontPanel({ quote }: { quote: string }) {
  const lines = quote.split("\n").map((l) => l.trim()).filter(Boolean);
  const [main, ...subs] = lines.length ? lines : ["热爱魔方"];
  return (
    <div style={PANEL_BASE}>
      <div style={{ display: "flex", gap: m(0.6) }}>
        {CUBE_STRIP.map((c, i) => (
          <span
            key={i}
            style={{
              width: m(1.7),
              height: m(1.7),
              borderRadius: m(0.4),
              background: c,
              border: c === "#FFFFFF" ? `${m(0.18)} solid #E5E8EE` : "none",
              boxSizing: "border-box",
            }}
          />
        ))}
      </div>
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          textAlign: "center",
          gap: m(0.8),
        }}
      >
        <div style={{ fontSize: m(2.8), fontWeight: 800, color: "#11111A", lineHeight: 1.15 }}>
          {main}
        </div>
        {subs.map((s, i) => (
          <div key={i} style={{ fontSize: m(1.4), color: "#6B7280", lineHeight: 1.3 }}>
            {s}
          </div>
        ))}
      </div>
      <div style={{ fontSize: m(1.4), fontWeight: 700, color: "#2A5DF4" }}>魔方开放社群</div>
    </div>
  );
}

// 背面:唯一二维码 + 文案 + 网址
function BackPanel({ svg, code }: { svg: string; code: string }) {
  return (
    <div style={PANEL_BASE}>
      <div
        style={{
          fontSize: m(1.5),
          fontWeight: 600,
          color: "#11111A",
          textAlign: "center",
          lineHeight: 1.25,
        }}
      >
        扫码进社群
        <br />
        课程 / 商城 / 赛事 / 社群
      </div>
      <div style={{ width: m(17), height: m(17) }} dangerouslySetInnerHTML={{ __html: svg }} />
      <div
        style={{
          fontSize: m(1.15),
          color: "#9aa1ad",
          fontFamily: "ui-monospace, monospace",
          wordBreak: "break-all",
          textAlign: "center",
        }}
      >
        {host()}/qr/{code}
      </div>
    </div>
  );
}

export default async function QrCardsPage({
  searchParams,
}: {
  searchParams: Promise<{ codes?: string }>;
}) {
  const sp = await searchParams;
  let rows: QrCode[] = await list();
  if (sp.codes) {
    const set = new Set(
      sp.codes.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
    );
    rows = rows.filter((r) => set.has(r.code));
  }

  return (
    <div>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .qr-sheet { --s: 2.4; }
            .qr-unit { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            @media print {
              @page { size: A4; margin: 8mm; }
              .no-print { display: none !important; }
              .qr-sheet { --s: 1 !important; gap: 0 !important; }
              body { background: #fff !important; }
            }
          `,
        }}
      />

      <div className="no-print">
        <PageHeader
          title="二维码卡片打印"
          subtitle={`2x4cm 折叠卡 · 共 ${rows.length} 张。每个单元正面(语录)| 折线 | 背面(唯一二维码+网址),沿外框裁剪、对折即双面卡。`}
          actions={
            <div className="flex gap-2">
              <GhostLink href="/admin/qr">返回列表</GhostLink>
              <PrintButton />
            </div>
          }
        />
        {rows.length === 0 ? (
          <div className="rounded-[14px] border border-line bg-white p-8 text-center text-[13px] text-ink-3">
            没有匹配的 code。回列表选码,或用 ?codes=a,b 指定。
          </div>
        ) : (
          <p className="mb-6 text-[12px] text-ink-3">
            下方为放大预览,打印时自动回到实际 2×4cm。打印前在浏览器打印设置里勾选「背景图形」,否则二维码与配色不显示。
          </p>
        )}
      </div>

      <div
        className="qr-sheet flex flex-wrap"
        style={{ gap: m(3), alignContent: "flex-start" }}
      >
        {rows.map((r, idx) => {
          const svg = qrSvg(absoluteUrl(`/qr/${r.code}`));
          const quote = r.quote?.trim() || DEFAULT_QUOTES[idx % DEFAULT_QUOTES.length];
          return (
            <div
              key={r.code}
              className="qr-unit"
              style={{
                display: "flex",
                border: `${m(0.2)} dashed #c4c9d4`,
                background: "#fff",
              }}
            >
              <FrontPanel quote={quote} />
              <div style={{ borderLeft: `${m(0.2)} dotted #c4c9d4` }} />
              <BackPanel svg={svg} code={r.code} />
            </div>
          );
        })}
      </div>

      <div className="no-print mt-6">
        <Link href="/admin/qr" className="text-[13px] text-brand hover:underline">
          返回二维码列表
        </Link>
      </div>
    </div>
  );
}
