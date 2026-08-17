import { list } from "@/lib/db/applications";
import { PageHeader, Card, GhostLink, Th, Td } from "../../_components/Shell";
import { Badge } from "@/components/Badge";
import type { ApplicationStatus } from "@/db/schema";

export const dynamic = "force-dynamic";

const TONE: Record<ApplicationStatus, "success" | "warning" | "muted"> = {
  approved: "success",
  pending: "warning",
  rejected: "muted",
};

const LABEL: Record<ApplicationStatus, string> = {
  approved: "已通过",
  pending: "待审核",
  rejected: "已拒绝",
};

function fmtDate(ts: number): string {
  const d = new Date(ts * 1000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default async function ApplicationsAdminPage() {
  const rows = await list();
  const pending = rows.filter((r) => r.status === "pending").length;

  return (
    <div>
      <PageHeader
        title="讲师申请"
        subtitle={`共 ${rows.length} 份 · 待审核 ${pending}`}
      />

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-bg-soft text-ink-3">
              <tr>
                <Th>申请编号</Th>
                <Th>姓名</Th>
                <Th>手机号</Th>
                <Th>城市</Th>
                <Th>方向</Th>
                <Th>状态</Th>
                <Th>提交时间</Th>
                <Th className="text-right">操作</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id}>
                  <Td className="font-mono text-ink-3">{r.id}</Td>
                  <Td className="text-ink">{r.name}</Td>
                  <Td>{r.phone}</Td>
                  <Td>{r.city}</Td>
                  <Td className="text-ink-3">{r.direction.join(" · ")}</Td>
                  <Td>
                    <Badge tone={TONE[r.status]}>{LABEL[r.status]}</Badge>
                  </Td>
                  <Td className="text-ink-3">{fmtDate(r.createdAt)}</Td>
                  <Td className="text-right">
                    <GhostLink href={`/admin/applications/${r.id}`}>查看</GhostLink>
                  </Td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <Td colSpan={8} className="text-center text-ink-3 py-8">
                    暂无申请
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
