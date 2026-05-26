import { listRecent } from "@/lib/db/track";

export const dynamic = "force-dynamic";

function formatTime(ts: number): string {
  const d = new Date(ts * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export default async function AdminEventsTrack() {
  const rows = await listRecent(100);
  return (
    <div>
      <h1 className="text-[22px] font-semibold text-ink">埋点事件</h1>
      <p className="mt-1 text-[13px] text-ink-3">最近 100 条客户端事件,从 events_track 表读取。</p>

      {rows.length === 0 ? (
        <div className="mt-6 rounded-[14px] border border-line bg-white p-10 text-center text-[14px] text-ink-3">
          暂无埋点数据。
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-[14px] border border-line bg-white">
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
