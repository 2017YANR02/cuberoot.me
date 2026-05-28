import Link from "next/link";
import { list, type QrCode } from "@/lib/db/qr";
import { absoluteUrl, getSiteUrl } from "@/lib/site";
import { qrSvg } from "@/lib/qr/svg";
import { PageHeader, GhostLink } from "../../../_components/Shell";
import { PrintButton } from "./_PrintButton";

export const dynamic = "force-dynamic";

// term 未填时按序轮换,给卡片"魔方术语"质感
const FALLBACK_TERMS = ["CFOP", "OLL", "PLL", "F2L", "CROSS", "BLD", "ROUX", "ZBLL"];

const host = () => getSiteUrl().replace(/^https?:\/\//, "");

// 物理尺寸 × 屏幕缩放变量 --s(屏幕放大方便看,打印时 --s=1 回到精确 mm)
const m = (n: number) => `calc(var(--s) * ${n}mm)`;

function Panel({
  svg,
  term,
  code,
  kind,
}: {
  svg: string;
  term: string;
  code: string;
  kind: "front" | "back";
}) {
  return (
    <div
      style={{
        width: m(20),
        height: m(40),
        padding: m(1.6),
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        boxSizing: "border-box",
      }}
    >
      {kind === "front" ? (
        <>
          <div style={{ textAlign: "center", lineHeight: 1.15 }}>
            <div style={{ fontSize: m(1.5), fontWeight: 700, color: "#2A5DF4" }}>
              魔方开放社群
            </div>
            <div style={{ fontSize: m(1.2), color: "#9aa1ad" }}>cuberoot.me</div>
          </div>
          <div
            style={{ width: m(16), height: m(16) }}
            dangerouslySetInnerHTML={{ __html: svg }}
          />
          <div
            style={{
              fontSize: m(2),
              fontWeight: 800,
              letterSpacing: m(0.3),
              color: "#11111A",
            }}
          >
            {term}
          </div>
        </>
      ) : (
        <>
          <div
            style={{
              fontSize: m(1.5),
              fontWeight: 600,
              color: "#11111A",
              textAlign: "center",
              lineHeight: 1.25,
            }}
          >
            扫码解锁
            <br />
            课程 / 商城 / 赛事 / 社群
          </div>
          <div
            style={{ width: m(16), height: m(16) }}
            dangerouslySetInnerHTML={{ __html: svg }}
          />
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
        </>
      )}
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
          subtitle={`2x4cm 折叠卡 · 共 ${rows.length} 张。每个单元正面(术语+码)| 折线 | 背面(码+网址),沿外框裁剪、对折即双面卡。`}
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
          const term = r.term?.trim() || FALLBACK_TERMS[idx % FALLBACK_TERMS.length];
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
              <Panel svg={svg} term={term} code={r.code} kind="front" />
              <div style={{ borderLeft: `${m(0.2)} dotted #c4c9d4` }} />
              <Panel svg={svg} term={term} code={r.code} kind="back" />
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
