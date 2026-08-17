import { requireInstructor } from "@/lib/auth/instructor";
import {
  kpi,
  recentOrdersByInstructor,
  INSTRUCTOR_REVENUE_SHARE,
} from "@/lib/db/instructor-stats";
import { Badge } from "@/components/Badge";
import { Th, Td } from "@/components/DataTable";
import type { OrderStatus } from "@/db/schema";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<OrderStatus, "success" | "warning" | "muted" | "danger"> = {
  paid: "success",
  pending: "warning",
  cancelled: "muted",
  refunded: "danger",
};

const STATUS_LABEL: Record<OrderStatus, string> = {
  paid: "已支付",
  pending: "待支付",
  cancelled: "已取消",
  refunded: "已退款",
};

function fmtDate(ts: number): string {
  const d = new Date(ts * 1000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

export default async function InstructorHome() {
  const { instructor } = await requireInstructor();
  const [k, recent] = await Promise.all([
    kpi(instructor.id),
    recentOrdersByInstructor(instructor.id, 10),
  ]);

  const kpis = [
    { label: "我的课程", value: String(k.courseCount), hint: "已发布课程" },
    { label: "累计学员", value: String(k.studentCount), hint: "去重支付用户" },
    { label: "累计销售额", value: `¥${k.totalRevenue}`, hint: "已支付实付总和" },
    {
      label: "应得分成",
      value: `¥${k.pendingPayout}`,
      hint: `分成比例 ${Math.round(INSTRUCTOR_REVENUE_SHARE * 100)}%`,
    },
  ];

  return (
    <div>
      <h1 className="text-[22px] font-semibold text-ink">概览</h1>
      <p className="mt-1 text-[13px] text-ink-3">
        欢迎回来,{instructor.name}。这里展示你课程的核心运营数据。
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((s) => (
          <div
            key={s.label}
            className="rounded-[14px] border border-line bg-white p-5"
          >
            <div className="text-[13px] text-ink-3">{s.label}</div>
            <div className="mt-1 text-[26px] font-semibold text-ink">{s.value}</div>
            <div className="mt-2 text-[12px] text-ink-3">{s.hint}</div>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-[14px] border border-line bg-white">
        <div className="px-5 py-4 flex items-center justify-between gap-3 border-b border-line">
          <div>
            <div className="text-[15px] font-semibold text-ink">最近订单</div>
            <div className="text-[12px] text-ink-3 mt-0.5">来自你课程的最新 10 笔</div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-bg-soft text-ink-3">
              <tr>
                <Th>订单号</Th>
                <Th>学员</Th>
                <Th>课程</Th>
                <Th className="text-right">金额</Th>
                <Th>状态</Th>
                <Th>下单时间</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {recent.map((o) => (
                <tr key={o.id}>
                  <Td className="font-mono text-ink-3">{o.id}</Td>
                  <Td>
                    <div className="text-ink">{o.userNickname}</div>
                    <div className="text-[12px] text-ink-3">{maskPhone(o.userPhone)}</div>
                  </Td>
                  <Td className="text-ink">{o.refTitle}</Td>
                  <Td className="text-right">¥{o.amount}</Td>
                  <Td>
                    <Badge tone={STATUS_TONE[o.status]}>{STATUS_LABEL[o.status]}</Badge>
                  </Td>
                  <Td className="text-ink-3">{fmtDate(o.createdAt)}</Td>
                </tr>
              ))}
              {recent.length === 0 ? (
                <tr>
                  <Td colSpan={6} className="text-center text-ink-3 py-8">
                    暂无订单
                  </Td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function maskPhone(p: string): string {
  if (!p || p.length < 7) return p;
  return p.slice(0, 3) + "****" + p.slice(-4);
}
