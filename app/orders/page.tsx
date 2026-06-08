import Link from "next/link";
import { requireUser } from "@/lib/auth-user";
import { list as listOrders } from "@/lib/db/orders";
import { Section } from "@/components/Section";
import { Badge } from "@/components/Badge";
import type { OrderStatus, OrderType } from "@/db/schema";

export const metadata = {
  title: "我的订单 — 魔方开放社群",
  robots: { index: false, follow: false },
};

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

const TYPE_LABEL: Record<OrderType, string> = {
  course: "课程",
  product: "商品",
  event: "赛事",
  membership: "会员",
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

export default async function OrdersPage() {
  const user = await requireUser("/orders");
  const orders = await listOrders({ userId: user.id });

  return (
    <Section
      eyebrow="账户中心"
      title="我的订单"
      subtitle={`共 ${orders.length} 笔订单`}
    >
      {orders.length === 0 ? (
        <div className="rounded-[14px] border border-line bg-white p-10 text-center">
          <p className="text-[14px] text-ink-3">还没有订单。</p>
          <div className="mt-4 flex justify-center gap-3 text-[13px]">
            <Link href="/courses" className="text-brand hover:underline">浏览课程</Link>
            <Link href="/shop" className="text-brand hover:underline">前往商城</Link>
            <Link href="/events" className="text-brand hover:underline">查看赛事</Link>
          </div>
        </div>
      ) : (
        <div className="rounded-[14px] border border-line bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="bg-bg-soft text-ink-3">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">订单号</th>
                  <th className="px-4 py-3 text-left font-medium">类型</th>
                  <th className="px-4 py-3 text-left font-medium">商品</th>
                  <th className="px-4 py-3 text-right font-medium">金额</th>
                  <th className="px-4 py-3 text-left font-medium">状态</th>
                  <th className="px-4 py-3 text-left font-medium">下单时间</th>
                  <th className="px-4 py-3 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-bg-soft/60 transition">
                    <td className="px-4 py-3 font-mono text-ink-3">{o.id}</td>
                    <td className="px-4 py-3">{TYPE_LABEL[o.type]}</td>
                    <td className="px-4 py-3 text-ink">{o.refTitle}</td>
                    <td className="px-4 py-3 text-right text-ink">¥{o.amount}</td>
                    <td className="px-4 py-3">
                      <Badge tone={STATUS_TONE[o.status]}>{STATUS_LABEL[o.status]}</Badge>
                    </td>
                    <td className="px-4 py-3 text-ink-3">{fmtDate(o.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/orders/${o.id}`}
                        className="text-brand hover:underline"
                      >
                        查看
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Section>
  );
}
