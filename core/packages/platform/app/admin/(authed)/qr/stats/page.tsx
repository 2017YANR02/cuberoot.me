import { QrCode, Scan, Users } from "lucide-react";
import {
  scanTrend,
  statsByBatch,
  statsByCode,
  statsSummary,
} from "@/lib/db/qr-stats";
import { Card, GhostLink, PageHeader, Th, Td } from "../../../_components/Shell";

export const dynamic = "force-dynamic";

function fmtDateTime(ts: number): string {
  const d = new Date(ts * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default async function QrStatsPage() {
  const [summary, byCode, byBatch, trend] = await Promise.all([
    statsSummary(),
    statsByCode(),
    statsByBatch(),
    scanTrend(30),
  ]);

  const maxTrend = trend.reduce((m, p) => Math.max(m, p.count), 0);

  return (
    <div>
      <PageHeader
        title="二维码数据看板"
        subtitle="每个码的扫码量、独立访客与最近 30 天趋势(独立访客按匿名 cookie 去重)"
        actions={<GhostLink href="/admin/qr">返回列表</GhostLink>}
      />

      {/* 顶部汇总 */}
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <SummaryCard icon={<Scan size={16} />} label="总扫码数" value={summary.totalScans} />
        <SummaryCard icon={<QrCode size={16} />} label="码总数" value={summary.totalCodes} />
        <SummaryCard
          icon={<Users size={16} />}
          label="独立访客"
          value={summary.uniqueVisitors}
        />
      </div>

      {/* 近 30 天趋势 */}
      <Card className="mb-6 p-6">
        <h2 className="mb-1 text-[15px] font-semibold text-ink">近 30 天扫码趋势</h2>
        <p className="mb-4 text-[12px] text-ink-3">
          按落地事件(qr_scan)统计,空白天不出现。
        </p>
        {trend.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-ink-3">暂无扫码事件</p>
        ) : (
          <div className="overflow-x-auto">
            <div className="flex items-end gap-1.5" style={{ height: "140px" }}>
              {trend.map((p) => {
                const pct = maxTrend > 0 ? (p.count / maxTrend) * 100 : 0;
                return (
                  <div
                    key={p.day}
                    className="group flex h-full w-[16px] shrink-0 flex-col items-center justify-end"
                    title={`${p.day}: ${p.count}`}
                  >
                    <svg
                      className="w-full"
                      style={{ height: "112px" }}
                      viewBox="0 0 10 100"
                      preserveAspectRatio="none"
                      aria-hidden
                    >
                      <rect
                        x="0"
                        y={100 - pct}
                        width="10"
                        height={pct}
                        rx="1"
                        className="fill-brand transition-opacity group-hover:opacity-80"
                      />
                    </svg>
                    <span className="mt-1 w-full text-center text-[9px] leading-tight text-ink-3">
                      {p.day.slice(8)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>

      {/* 按批次 */}
      <Card className="mb-6">
        <div className="border-b border-line px-6 py-4">
          <h2 className="text-[15px] font-semibold text-ink">按批次</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-bg-soft text-ink-3">
              <tr>
                <Th>批次标签</Th>
                <Th className="text-right">码数</Th>
                <Th className="text-right">扫码总数</Th>
                <Th className="text-right">独立访客</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {byBatch.map((b) => (
                <tr key={b.label}>
                  <Td className="text-ink-2">{b.label}</Td>
                  <Td className="text-right text-ink-3">{b.codes}</Td>
                  <Td className="text-right text-ink">{b.totalScans}</Td>
                  <Td className="text-right text-ink-3">{b.uniqueVisitors}</Td>
                </tr>
              ))}
              {byBatch.length === 0 ? (
                <tr>
                  <Td colSpan={4} className="py-8 text-center text-ink-3">
                    暂无数据
                  </Td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 每码 */}
      <Card>
        <div className="border-b border-line px-6 py-4">
          <h2 className="text-[15px] font-semibold text-ink">每码明细</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-bg-soft text-ink-3">
              <tr>
                <Th>Code</Th>
                <Th>批次</Th>
                <Th className="text-right">扫码</Th>
                <Th className="text-right">独立访客</Th>
                <Th>最后扫码</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {byCode.map((c) => (
                <tr key={c.code}>
                  <Td className="font-mono text-ink">{c.code}</Td>
                  <Td className="text-ink-2">{c.label}</Td>
                  <Td className="text-right text-ink">{c.totalScans}</Td>
                  <Td className="text-right text-ink-3">{c.uniqueVisitors}</Td>
                  <Td className="whitespace-nowrap text-ink-3">
                    {c.lastScanAt ? fmtDateTime(c.lastScanAt) : "—"}
                  </Td>
                </tr>
              ))}
              {byCode.length === 0 ? (
                <tr>
                  <Td colSpan={5} className="py-8 text-center text-ink-3">
                    暂无 code
                  </Td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <Card className="flex items-center gap-3 p-5">
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft text-brand">
        {icon}
      </span>
      <span>
        <span className="block text-[12px] text-ink-3">{label}</span>
        <span className="block text-[22px] font-semibold leading-tight text-ink">
          {value}
        </span>
      </span>
    </Card>
  );
}
