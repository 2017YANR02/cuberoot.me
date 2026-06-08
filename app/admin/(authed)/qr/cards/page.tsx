import Link from "next/link";
import { list, type QrCode } from "@/lib/db/qr";
import { qrTargetUrl } from "@/lib/site";
import { qrSvg } from "@/lib/qr/svg";
import { cardSvg } from "@/lib/qr/cardSvg";
import { QrCardUnit } from "@/components/QrCard";
import { PageHeader, GhostLink } from "../../../_components/Shell";
import { PrintButton } from "./_PrintButton";

export const dynamic = "force-dynamic";

export default async function QrCardsPage({
  searchParams,
}: {
  searchParams: Promise<{ codes?: string; style?: string }>;
}) {
  const sp = await searchParams;
  // 矢量版(印刷母版,默认) / 照片版(占位艺术图,印前换素材)
  const style = sp.style === "photo" ? "photo" : "vector";
  let rows: QrCode[] = await list();
  if (sp.codes) {
    const set = new Set(
      sp.codes.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
    );
    rows = rows.filter((r) => set.has(r.code));
  }

  const codesQ = sp.codes ? `&codes=${encodeURIComponent(sp.codes)}` : "";
  const tab = (s: "vector" | "photo") => `/admin/qr/cards?style=${s}${codesQ}`;
  const segCls = (active: boolean) =>
    "px-3 py-1.5 transition " +
    (active ? "bg-brand text-white" : "bg-white text-ink-2 hover:text-brand");

  return (
    <div>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .qr-sheet { --s: 2.4; }
            .qr-unit { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .vcard svg { display: block; width: 414px; height: 414px; }
            @media print {
              @page { size: A4; margin: 8mm; }
              .no-print { display: none !important; }
              .qr-sheet { --s: 1 !important; gap: 0 !important; }
              .vec-sheet { gap: 2mm !important; }
              .vcard svg { width: 46mm !important; height: 46mm !important; }
              body { background: #fff !important; }
            }
          `,
        }}
      />

      <div className="no-print">
        <PageHeader
          title="二维码卡片打印"
          subtitle={`2x4cm 折叠卡 · 共 ${rows.length} 张。正面(魔方元素+slogan)| 折线 | 背面(流派公式+唯一二维码)。`}
          actions={
            <div className="flex gap-2">
              <GhostLink href="/admin/qr">返回列表</GhostLink>
              <GhostLink href="/admin/qr/stats">数据看板</GhostLink>
              <PrintButton />
            </div>
          }
        />

        <div className="mb-4 inline-flex overflow-hidden rounded-md border border-line text-[13px]">
          <Link href={tab("vector")} className={segCls(style === "vector")}>
            矢量版
          </Link>
          <Link
            href={tab("photo")}
            className={"border-l border-line " + segCls(style === "photo")}
          >
            照片版
          </Link>
        </div>

        {rows.length === 0 ? (
          <div className="rounded-[14px] border border-line bg-white p-8 text-center text-[13px] text-ink-3">
            没有匹配的 code。回列表选码,或用 ?codes=a,b 指定。
          </div>
        ) : style === "vector" ? (
          <p className="mb-6 text-[12px] text-ink-3">
            矢量版:正面 / 配色 / 二维码全为 SVG 矢量,每张含 3mm 出血 + 裁切线,印刷厂可直接收。打印或「存 PDF」即可,无需勾选背景图形。
          </p>
        ) : (
          <p className="mb-6 text-[12px] text-ink-3">
            照片版:正面为艺术占位图(印前换正式素材)。下方为放大预览,打印时自动回到实际 2×4cm;打印前在浏览器打印设置里勾选「背景图形」,否则二维码与配色不显示。
          </p>
        )}
      </div>

      {style === "vector" ? (
        <div className="vec-sheet flex flex-wrap" style={{ gap: "14px", alignContent: "flex-start" }}>
          {rows.map((r, idx) => (
            <div
              key={r.code}
              className="vcard"
              dangerouslySetInnerHTML={{
                __html: cardSvg(r, { url: qrTargetUrl(r.code), idx }),
              }}
            />
          ))}
        </div>
      ) : (
        <div
          className="qr-sheet flex flex-wrap"
          style={{ gap: "calc(var(--s) * 3mm)", alignContent: "flex-start" }}
        >
          {rows.map((r, idx) => (
            <QrCardUnit key={r.code} entry={r} svg={qrSvg(qrTargetUrl(r.code))} idx={idx} />
          ))}
        </div>
      )}

      <div className="no-print mt-6">
        <Link href="/admin/qr" className="text-[13px] text-brand hover:underline">
          返回二维码列表
        </Link>
      </div>
    </div>
  );
}
