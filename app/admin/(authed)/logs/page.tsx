import Link from "next/link";
import {
  countErrors,
  countSlowRequests,
  listErrors,
  listSlowRequests,
} from "@/lib/db/logs";
import {
  loadLogsParams,
  serializeLogsParams,
  type LogTab,
} from "@/lib/search-params";
import type { SearchParams } from "nuqs/server";
import { PageHeader } from "../../_components/Shell";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

function formatTime(ts: number): string {
  const d = new Date(ts * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export default async function AdminLogs({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { tab, page } = await loadLogsParams(searchParams);
  const offset = (page - 1) * PAGE_SIZE;

  const [errorRows, errorTotal, slowRows, slowTotal] = await Promise.all([
    tab === "errors" ? listErrors(PAGE_SIZE, offset) : Promise.resolve([]),
    countErrors(),
    tab === "slow" ? listSlowRequests(PAGE_SIZE, offset) : Promise.resolve([]),
    countSlowRequests(),
  ]);

  const total = tab === "errors" ? errorTotal : slowTotal;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <PageHeader
        title="日志"
        subtitle="错误日志 + 慢请求(>500ms),自建可观测性,无第三方"
      />

      <div className="mb-4 flex gap-1 text-[13px]">
        <TabLink
          active={tab === "errors"}
          href={serializeLogsParams("/admin/logs", { tab: "errors", page: 1 })}
        >
          错误日志 <span className="ml-1 text-ink-3">({errorTotal})</span>
        </TabLink>
        <TabLink
          active={tab === "slow"}
          href={serializeLogsParams("/admin/logs", { tab: "slow", page: 1 })}
        >
          慢请求 <span className="ml-1 text-ink-3">({slowTotal})</span>
        </TabLink>
      </div>

      {tab === "errors" ? (
        <ErrorsTable rows={errorRows} />
      ) : (
        <SlowTable rows={slowRows} />
      )}

      <Pagination tab={tab} page={page} totalPages={totalPages} />
    </div>
  );
}

function TabLink({
  active,
  href,
  children,
}: {
  active: boolean;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={
        "rounded-md px-3 py-1.5 transition " +
        (active
          ? "bg-brand-soft text-brand"
          : "text-ink-2 hover:text-ink hover:bg-bg-soft")
      }
    >
      {children}
    </Link>
  );
}

function ErrorsTable({
  rows,
}: {
  rows: Awaited<ReturnType<typeof listErrors>>;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-[14px] border border-line bg-white p-10 text-center text-[14px] text-ink-3">
        暂无错误日志。
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-[14px] border border-line bg-white">
      <table className="min-w-full text-[13px]">
        <thead className="bg-bg-soft text-ink-3 text-left">
          <tr>
            <th className="px-3 py-2 font-medium whitespace-nowrap">时间</th>
            <th className="px-3 py-2 font-medium">级别</th>
            <th className="px-3 py-2 font-medium">消息</th>
            <th className="px-3 py-2 font-medium">路径</th>
            <th className="px-3 py-2 font-medium">用户</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => (
            <tr key={r.id} className="align-top">
              <td className="px-3 py-2 text-ink-3 whitespace-nowrap">
                {formatTime(r.ts)}
              </td>
              <td className="px-3 py-2">
                <span
                  className={
                    "inline-block rounded px-1.5 py-0.5 text-[11px] " +
                    (r.level === "warn"
                      ? "bg-brand-tint text-brand-dark"
                      : "bg-brand-soft text-brand")
                  }
                >
                  {r.level}
                </span>
              </td>
              <td className="px-3 py-2 text-ink max-w-[440px]">
                <div className="break-all font-medium">{r.message}</div>
                {r.stack ? (
                  <pre className="mt-1 whitespace-pre-wrap break-all text-[11px] leading-4 text-ink-3 max-h-32 overflow-auto">
                    {r.stack}
                  </pre>
                ) : null}
              </td>
              <td className="px-3 py-2 text-ink-2 break-all max-w-[220px]">
                {r.path ?? "—"}
              </td>
              <td className="px-3 py-2 text-ink-3 whitespace-nowrap">
                {r.userId ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SlowTable({
  rows,
}: {
  rows: Awaited<ReturnType<typeof listSlowRequests>>;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-[14px] border border-line bg-white p-10 text-center text-[14px] text-ink-3">
        暂无慢请求。
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-[14px] border border-line bg-white">
      <table className="min-w-full text-[13px]">
        <thead className="bg-bg-soft text-ink-3 text-left">
          <tr>
            <th className="px-3 py-2 font-medium whitespace-nowrap">时间</th>
            <th className="px-3 py-2 font-medium">方法</th>
            <th className="px-3 py-2 font-medium">路径</th>
            <th className="px-3 py-2 font-medium">状态</th>
            <th className="px-3 py-2 font-medium">耗时</th>
            <th className="px-3 py-2 font-medium">用户</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="px-3 py-2 text-ink-3 whitespace-nowrap">
                {formatTime(r.ts)}
              </td>
              <td className="px-3 py-2 text-ink-2">{r.method}</td>
              <td className="px-3 py-2 text-ink break-all max-w-[320px]">
                {r.path}
              </td>
              <td className="px-3 py-2 text-ink-2">{r.status}</td>
              <td className="px-3 py-2 text-ink font-medium whitespace-nowrap">
                {r.durationMs} ms
              </td>
              <td className="px-3 py-2 text-ink-3 whitespace-nowrap">
                {r.userId ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Pagination({
  tab,
  page,
  totalPages,
}: {
  tab: LogTab;
  page: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;
  const prev = Math.max(1, page - 1);
  const next = Math.min(totalPages, page + 1);
  return (
    <div className="mt-4 flex items-center justify-end gap-2 text-[13px]">
      <Link
        href={serializeLogsParams("/admin/logs", { tab, page: prev })}
        aria-disabled={page <= 1}
        className={
          "rounded-md border border-line px-3 py-1.5 " +
          (page <= 1
            ? "pointer-events-none opacity-50 text-ink-3"
            : "text-ink-2 hover:text-ink hover:border-brand/40")
        }
      >
        上一页
      </Link>
      <span className="text-ink-3">
        第 {page} / {totalPages} 页
      </span>
      <Link
        href={serializeLogsParams("/admin/logs", { tab, page: next })}
        aria-disabled={page >= totalPages}
        className={
          "rounded-md border border-line px-3 py-1.5 " +
          (page >= totalPages
            ? "pointer-events-none opacity-50 text-ink-3"
            : "text-ink-2 hover:text-ink hover:border-brand/40")
        }
      >
        下一页
      </Link>
    </div>
  );
}
