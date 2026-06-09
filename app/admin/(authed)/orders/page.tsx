import { listWithUser } from "@/lib/db/orders";
import { PageHeader, Card, Th, Td } from "../../_components/Shell";
import { Badge } from "@/components/Badge";
import { adminCancelOrder, adminMarkPaid } from "./actions";
import { refundOrderFromForm } from "@/app/actions/refund";
import type { OrderStatus, OrderType, PaymentMethod } from "@/db/schema";
import { loadOrderNotice } from "@/lib/search-params";
import type { SearchParams } from "nuqs/server";

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

const PAY_LABEL: Record<PaymentMethod, string> = {
  mock_wechat: "微信",
  mock_alipay: "支付宝",
  stripe: "Stripe",
  wechat: "微信",
  alipay: "支付宝",
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

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await loadOrderNotice(searchParams);
  const rows = await listWithUser();
  const total = rows.length;
  const paidTotal = rows
    .filter((r) => r.status === "paid")
    .reduce((s, r) => s + r.amount, 0);
  const refundedTotal = rows
    .filter((r) => r.status === "refunded")
    .reduce((s, r) => s + (r.refundAmount ?? r.amount), 0);

  return (
    <div>
      <PageHeader
        title="订单"
        subtitle={`共 ${total} 笔订单 已支付合计 ¥${paidTotal} 已退款合计 ¥${refundedTotal}`}
      />

      {sp.refunded ? (
        <div className="mb-4 rounded-[14px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-800">
          订单 {sp.refunded} 退款成功
        </div>
      ) : null}
      {sp.error ? (
        <div className="mb-4 rounded-[14px] border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">
          {sp.id ? `订单 ${sp.id} ` : ""}退款失败:{sp.error}
        </div>
      ) : null}

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-bg-soft text-ink-3">
              <tr>
                <Th>订单号</Th>
                <Th>用户</Th>
                <Th>类型</Th>
                <Th>商品</Th>
                <Th className="text-right">金额</Th>
                <Th>状态</Th>
                <Th>支付方式</Th>
                <Th>下单时间</Th>
                <Th className="text-right">操作</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((o) => (
                <tr key={o.id}>
                  <Td className="font-mono text-ink-3">{o.id}</Td>
                  <Td>
                    <div className="text-ink">{o.userNickname}</div>
                    <div className="text-[12px] text-ink-3">{o.userPhone}</div>
                  </Td>
                  <Td>{TYPE_LABEL[o.type]}</Td>
                  <Td className="text-ink">{o.refTitle}</Td>
                  <Td className="text-right">¥{o.amount}</Td>
                  <Td>
                    <Badge tone={STATUS_TONE[o.status]}>
                      {STATUS_LABEL[o.status]}
                    </Badge>
                  </Td>
                  <Td className="text-ink-3">
                    {o.paymentMethod ? PAY_LABEL[o.paymentMethod] : "—"}
                  </Td>
                  <Td className="text-ink-3">{fmtDate(o.createdAt)}</Td>
                  <Td className="text-right">
                    <div className="inline-flex items-center gap-3">
                      {o.status === "pending" ? (
                        <>
                          <form action={adminMarkPaid} className="inline">
                            <input type="hidden" name="id" value={o.id} />
                            <input type="hidden" name="method" value="mock_wechat" />
                            <button
                              type="submit"
                              className="text-[13px] text-emerald-700 hover:underline"
                            >
                              标记已支付
                            </button>
                          </form>
                          <form action={adminCancelOrder} className="inline">
                            <input type="hidden" name="id" value={o.id} />
                            <button
                              type="submit"
                              className="text-[13px] text-red-600 hover:underline"
                            >
                              取消
                            </button>
                          </form>
                        </>
                      ) : o.status === "paid" ? (
                        <form action={refundOrderFromForm} className="inline">
                          <input type="hidden" name="orderId" value={o.id} />
                          <button
                            type="submit"
                            className="inline-flex items-center gap-1 rounded-md border border-line px-2.5 py-1 text-[12px] text-ink-2 hover:text-red-600 hover:border-red-300 transition"
                          >
                            退款
                          </button>
                        </form>
                      ) : (
                        <span className="text-[12px] text-ink-3">—</span>
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <Td colSpan={9} className="text-center text-ink-3 py-8">
                    暂无订单
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
