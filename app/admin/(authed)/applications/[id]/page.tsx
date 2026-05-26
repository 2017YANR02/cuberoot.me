import Link from "next/link";
import { notFound } from "next/navigation";
import { findById } from "@/lib/db/applications";
import { Card, PageHeader } from "../../../_components/Shell";
import { Badge } from "@/components/Badge";
import { approveApplication, rejectApplication } from "../actions";
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

function fmtDate(ts: number | null): string {
  if (!ts) return "—";
  const d = new Date(ts * 1000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const app = await findById(id);
  if (!app) notFound();

  return (
    <div>
      <PageHeader
        title={`讲师申请 · ${app.name}`}
        subtitle={`申请编号 ${app.id}`}
      />

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <h2 className="text-[18px] font-semibold text-ink">基本信息</h2>
            <Badge tone={TONE[app.status]}>{LABEL[app.status]}</Badge>
          </div>

          <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 text-[13px]">
            <Row label="姓名" value={app.name} />
            <Row label="手机号" value={app.phone} />
            <Row label="城市" value={app.city} />
            <Row label="WCA ID" value={app.wcaId || "—"} />
            <Row
              label="授课方向"
              value={
                <div className="flex flex-wrap gap-1.5">
                  {app.direction.map((d) => (
                    <Badge key={d} tone="brand">
                      {d}
                    </Badge>
                  ))}
                </div>
              }
            />
            <Row
              label="授课形式"
              value={
                <div className="flex flex-wrap gap-1.5">
                  {app.formats.map((f) => (
                    <Badge key={f} tone="neutral">
                      {f}
                    </Badge>
                  ))}
                </div>
              }
            />
            <Row label="提交时间" value={fmtDate(app.createdAt)} />
            <Row label="审核时间" value={fmtDate(app.reviewedAt)} />
            <Row label="关联用户" value={app.userId ?? "—"} />
            <Row label="审核备注" value={app.reviewNote || "—"} />
          </dl>

          <div className="mt-6 pt-6 border-t border-line">
            <div className="text-[13px] text-ink-3 mb-2">个人简介</div>
            <p className="text-[14px] leading-7 text-ink-2 whitespace-pre-wrap">
              {app.bio}
            </p>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-[18px] font-semibold text-ink">审核操作</h2>
          {app.status !== "pending" ? (
            <p className="mt-3 text-[13px] text-ink-3">
              该申请已审核,如需调整可再次执行。
            </p>
          ) : null}

          <div className="mt-5 space-y-4">
            <Form action={approveApplication} id={app.id} variant="approve" />
            <Form action={rejectApplication} id={app.id} variant="reject" />
          </div>

          <div className="mt-5 border-t border-line pt-4">
            <Link
              href="/admin/applications"
              className="text-[13px] text-ink-3 hover:text-ink"
            >
              ← 返回申请列表
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-ink-3">{label}</dt>
      <dd className="mt-0.5 text-ink">{value}</dd>
    </div>
  );
}

function Form({
  action,
  id,
  variant,
}: {
  action: (f: FormData) => Promise<void>;
  id: string;
  variant: "approve" | "reject";
}) {
  const isApprove = variant === "approve";
  return (
    <form action={action} className="rounded-md border border-line bg-bg-soft/40 p-4">
      <input type="hidden" name="id" value={id} />
      <div className="text-[13px] font-medium text-ink mb-2">
        {isApprove ? "通过申请" : "拒绝申请"}
      </div>
      <textarea
        name="note"
        rows={2}
        placeholder={isApprove ? "审核备注(可空,例如分配区域 / 起聘时间)" : "拒绝理由(可空)"}
        className="w-full rounded-md border border-line bg-white px-3 py-2 text-[13px] outline-none focus:border-brand transition"
      />
      <button
        type="submit"
        className={
          "mt-3 w-full rounded-md py-2 text-[13px] font-medium transition " +
          (isApprove
            ? "bg-emerald-600 text-white hover:bg-emerald-700"
            : "bg-white border border-line text-red-600 hover:border-red-300")
        }
      >
        {isApprove ? "通过并升级用户为讲师" : "拒绝申请"}
      </button>
    </form>
  );
}
