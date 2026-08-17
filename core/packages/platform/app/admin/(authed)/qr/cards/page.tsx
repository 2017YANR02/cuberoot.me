import Link from "next/link";
import { list, type QrCode } from "@/lib/db/qr";
import { qrTargetUrl } from "@/lib/site";
import { qrSvg } from "@/lib/qr/svg";
import { QrCardUnit } from "@/components/QrCard";
import { PageHeader, GhostLink } from "../../../_components/Shell";
import { PrintButton, BrowserPrintButton } from "./_PrintButton";
import { loadQrCardsParams } from "@/lib/search-params";
import type { SearchParams } from "nuqs/server";

export const dynamic = "force-dynamic";

export default async function QrCardsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { codes } = await loadQrCardsParams(searchParams);
  let rows: QrCode[] = await list();
  if (codes) {
    const set = new Set(
      codes.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
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
          subtitle={`2x4cm 折叠卡 · 共 ${rows.length} 张。正面(slogan + 魔方艺术图)| 折线 | 背面(解法流派公式 + 唯一二维码)。`}
          actions={
            <div className="flex gap-2">
              <GhostLink href="/admin/qr">返回列表</GhostLink>
              <GhostLink href="/admin/qr/stats">数据看板</GhostLink>
              <BrowserPrintButton />
              <PrintButton codes={rows.map((r) => r.code)} />
            </div>
          }
        />
        {rows.length === 0 ? (
          <div className="rounded-[14px] border border-line bg-white p-8 text-center text-[13px] text-ink-3">
            没有匹配的 code。回列表选码,或用 ?codes=a,b 指定。
          </div>
        ) : (
          <p className="mb-6 text-[12px] text-ink-3">
            下方为放大预览。「打印」走浏览器打印(A4 多卡平铺,自留 / 应急用)；「下载 SVG」逐张导出印刷厂母版(全矢量,含出血 + 裁切线,自包含单文件),交印厂用这个。
          </p>
        )}
      </div>

      <div
        className="qr-sheet flex flex-wrap"
        style={{ gap: "calc(var(--s) * 3mm)", alignContent: "flex-start" }}
      >
        {rows.map((r, idx) => (
          <QrCardUnit key={r.code} entry={r} svg={qrSvg(qrTargetUrl(r.code))} idx={idx} />
        ))}
      </div>

      <div className="no-print mt-6">
        <Link href="/admin/qr" className="text-[13px] text-brand hover:underline">
          返回二维码列表
        </Link>
      </div>
    </div>
  );
}
