import Link from "next/link";
import { listRecent } from "@/lib/db/track";
import {
  ANALYTICS_RANGES,
  clampRange,
  conversionFunnel,
  dailyTrend,
  gmvTrend,
  overview,
  topEvents,
} from "@/lib/db/analytics";
import { SvgLineChart, ChartLegend, SvgFunnel } from "@/components/SvgLineChart";

export const dynamic = "force-dynamic";

function formatTime(ts: number): string {
  const d = new Date(ts * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const RANGE_LABEL: Record<number, string> = { 7: "近 7 天", 30: "近 30 天", 90: "近 90 天" };

export default async function AdminEventsTrack({
  searchParams,
}: {
  searchParams: Promise<{ range?: string | string[] }>;
}) {
  const sp = await searchParams;
  const rawRange = Array.isArray(sp.range) ? sp.range[0] : sp.range;
  const range = clampRange(rawRange);

  const [ov, trend, funnel, gmv, tops, rows] = await Promise.all([
    overview(range),
    dailyTrend(range),
    conversionFunnel(range),
    gmvTrend(range),
    topEvents(range, 10),
    listRecent(100),
  ]);

  const trendSeries = [
    { name: "页面浏览", values: trend.pageView, color: "#2A5DF4" },
    { name: "注册", values: trend.signup, color: "#10B981" },
    { name: "下单意向", values: trend.orderPlaced, color: "#F59E0B" },
  ];

  const topMax = tops[0]?.count ?? 0;

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[22px] font-semibold text-ink">数据看板</h1>
          <p className="mt-1 text-[13px] text-ink-3">
            埋点趋势 / 转化漏斗 / GMV,基于 events_track + orders + users 聚合。下方保留原始事件流。
          </p>
        </div>
        {/* 时间范围:真链接切换,中键 / Ctrl 可新开 */}
        <div className="inline-flex rounded-[10px] border border-line bg-white p-0.5 text-[13px]">
          {ANALYTICS_RANGES.map((r) => {
            const active = r === range;
            return (
              <Link
                key={r}
                href={`/admin/events-track?range=${r}`}
                className={
                  "rounded-[8px] px-3 py-1.5 font-medium transition-colors " +
                  (active ? "bg-brand text-white" : "text-ink-3 hover:text-ink")
                }
              >
                {RANGE_LABEL[r]}
              </Link>
            );
          })}
        </div>
      </div>

      {/* 概览卡 */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="总事件" value={ov.events.toLocaleString()} />
        <Stat label="页面浏览" value={ov.pageView.toLocaleString()} />
        <Stat label="新增注册" value={ov.signup.toLocaleString()} />
        <Stat label="支付订单" value={ov.paidOrders.toLocaleString()} />
        <Stat label="GMV" value={`¥${ov.gmv.toLocaleString()}`} />
      </div>

      {/* 趋势折线 + 漏斗 */}
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card title="每日趋势" hint={RANGE_LABEL[range]}>
          <div className="mb-3">
            <ChartLegend series={trendSeries} />
          </div>
          <SvgLineChart series={trendSeries} labels={trend.labels} height={240} />
        </Card>

        <Card title="转化漏斗" hint="浏览 → 注册 → 下单意向 → 支付成功">
          <div className="pt-1">
            <SvgFunnel stages={funnel} />
          </div>
          <p className="mt-4 text-[12px] text-ink-3 leading-relaxed">
            环比 = 相对上一层;整体 = 相对页面浏览。注册取 users 真实建号,支付取已付订单。
          </p>
        </Card>
      </div>

      {/* GMV 柱状 + Top 事件 */}
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card
          title="GMV 趋势"
          hint={`合计 ¥${gmv.total.toLocaleString()} · ${gmv.totalOrders} 单`}
        >
          <SvgLineChart
            variant="bar"
            series={[{ name: "GMV", values: gmv.amount, color: "#2A5DF4" }]}
            labels={gmv.labels}
            height={240}
            unit=" 元"
          />
        </Card>

        <Card title="Top 事件" hint={`${RANGE_LABEL[range]}·按次数`}>
          {tops.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-ink-3">暂无事件</p>
          ) : (
            <ul className="flex flex-col gap-2.5 pt-1">
              {tops.map((t) => (
                <li key={t.name}>
                  <div className="flex items-baseline justify-between text-[13px]">
                    <span className="font-mono text-ink truncate pr-2">{t.name}</span>
                    <span className="text-ink-3 tabular-nums">{t.count.toLocaleString()}</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full rounded-full bg-bg-soft overflow-hidden">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{ width: `${topMax > 0 ? Math.max(3, (t.count / topMax) * 100) : 0}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* 原始事件流 */}
      <div className="mt-8 mb-3">
        <h2 className="text-[16px] font-semibold text-ink">原始事件流</h2>
        <p className="mt-1 text-[13px] text-ink-3">最近 100 条客户端事件,从 events_track 表读取。</p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-[14px] border border-line bg-white p-10 text-center text-[14px] text-ink-3">
          暂无埋点数据。
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[14px] border border-line bg-white">
          <table className="min-w-full text-[13px]">
            <thead className="bg-bg-soft text-ink-3 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">时间</th>
                <th className="px-3 py-2 font-medium">事件</th>
                <th className="px-3 py-2 font-medium">URL</th>
                <th className="px-3 py-2 font-medium">用户 / 匿名</th>
                <th className="px-3 py-2 font-medium">payload</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="px-3 py-2 text-ink-3 whitespace-nowrap">{formatTime(r.createdAt)}</td>
                  <td className="px-3 py-2 text-ink font-medium">{r.name}</td>
                  <td className="px-3 py-2 text-ink-2 break-all max-w-[280px]">{r.url ?? "—"}</td>
                  <td className="px-3 py-2 text-ink-3 whitespace-nowrap">
                    {r.userId ? <span className="text-brand">{r.userId}</span> : <span>{r.anonId ?? "—"}</span>}
                  </td>
                  <td className="px-3 py-2 text-ink-2">
                    <pre className="whitespace-pre-wrap break-all text-[12px] leading-5">
                      {r.payload ? JSON.stringify(r.payload) : "—"}
                    </pre>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[14px] border border-line bg-white p-4">
      <div className="text-[12px] text-ink-3">{label}</div>
      <div className="mt-1 text-[20px] font-semibold text-ink tabular-nums">{value}</div>
    </div>
  );
}

function Card({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[14px] border border-line bg-white p-5">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="text-[14px] font-semibold text-ink">{title}</h3>
        {hint ? <span className="text-[12px] text-ink-3 truncate">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}
