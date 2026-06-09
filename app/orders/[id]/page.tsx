import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth-user";
import { findByIdForUser, readPendingCodeUrl } from "@/lib/db/orders";
import { Badge } from "@/components/Badge";
import { TrackOnce } from "@/components/TrackOnce";
import { QrCodeModal } from "@/components/QrCodeModal";
import { cancelOrderFromForm, startPaymentFromForm } from "@/app/actions/order";
import { enabledProviders, getProvider } from "@/lib/payments/registry";
import type { ProviderId } from "@/lib/payments/types";
import type { OrderStatus, OrderType, PaymentMethod } from "@/db/schema";
import { loadOrderFlowParams } from "@/lib/search-params";
import type { SearchParams } from "nuqs/server";

export const metadata = {
  title: "订单详情 — 魔方开放社群",
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

const PAY_LABEL: Record<PaymentMethod, string> = {
  mock_wechat: "微信支付（模拟）",
  mock_alipay: "支付宝（模拟）",
  stripe: "Stripe（信用卡）",
  wechat: "微信支付",
  alipay: "支付宝",
};

const PROVIDER_BUTTON_CLASS: Record<ProviderId, string> = {
  mock_wechat: "bg-emerald-600 hover:bg-emerald-700 text-white",
  mock_alipay: "bg-sky-600 hover:bg-sky-700 text-white",
  stripe: "bg-purple-600 hover:bg-purple-700 text-white",
  wechat: "bg-emerald-600 hover:bg-emerald-700 text-white",
  alipay: "bg-sky-600 hover:bg-sky-700 text-white",
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

function resourcePath(type: OrderType, refId: string): string {
  if (type === "course") return `/courses/${refId}`;
  if (type === "product") return `/shop/${refId}`;
  if (type === "event") return `/events/${refId}`;
  return "/membership";
}

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<SearchParams>;
}) {
  const { id } = await params;
  const sp = searchParams ? await loadOrderFlowParams(searchParams) : null;
  const stripeSessionId = sp?.stripe_session_id;
  const user = await requireUser(`/orders/${id}`);
  const order = await findByIdForUser(id, user.id);
  if (!order) notFound();
  const providers = enabledProviders();
  const pendingCodeUrl =
    sp?.pay === "qrcode" && order.status === "pending"
      ? readPendingCodeUrl(order)
      : null;
  const pendingProvider =
    pendingCodeUrl && sp?.provider ? getProvider(sp.provider) : null;

  return (
    <section className="container-page py-12">
      <TrackOnce
        name="order_placed"
        dedupeKey={order.id}
        payload={{ orderId: order.id, type: order.type, amount: order.amount, discount: order.discount }}
      />
      <Link href="/orders" className="text-[13px] text-ink-3 hover:text-ink">← 返回订单列表</Link>

      <div className="mt-6 grid gap-8 md:grid-cols-[1.4fr_1fr] items-start">
        <div className="rounded-[14px] border border-line bg-white p-6">
          <div className="flex items-center gap-3">
            <h1 className="text-[22px] font-semibold text-ink">{order.refTitle}</h1>
            <Badge tone={STATUS_TONE[order.status]}>{STATUS_LABEL[order.status]}</Badge>
          </div>
          <div className="mt-1 text-[13px] text-ink-3">
            订单号 <span className="font-mono">{order.id}</span>
          </div>

          <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 text-[13px]">
            <Row label="类型" value={TYPE_LABEL[order.type]} />
            <Row label="数量" value={String(order.qty)} />
            <Row
              label="单价"
              value={`¥${Math.round(((order.amount + order.discount) || 0) / Math.max(1, order.qty))}`}
            />
            {order.discount > 0 ? (
              <Row
                label="优惠"
                value={
                  <span className="text-emerald-700">
                    -¥{order.discount}
                    {order.couponCode ? <span className="ml-1 text-ink-3 text-[12px]">({order.couponCode})</span> : null}
                  </span>
                }
              />
            ) : null}
            <Row label="合计" value={<span className="text-brand font-semibold">¥{order.amount}</span>} />
            <Row label="下单时间" value={fmtDate(order.createdAt)} />
            <Row label="支付时间" value={fmtDate(order.paidAt)} />
            <Row
              label="支付方式"
              value={order.paymentMethod ? PAY_LABEL[order.paymentMethod] : "—"}
            />
          </dl>
        </div>

        <aside className="rounded-[14px] border border-line bg-white p-6">
          {order.status === "pending" ? (
            <>
              <div className="text-[13px] text-ink-3">应付金额</div>
              <div className="mt-1 text-[32px] font-semibold text-brand leading-none">¥{order.amount}</div>
              <div className="mt-1 text-[12px] text-ink-3">选择支付方式完成订单</div>

              {stripeSessionId ? (
                <div className="mt-4 rounded-md bg-brand-soft border border-brand/30 px-3 py-2 text-[12px] text-brand">
                  支付处理中,稍候自动刷新
                </div>
              ) : null}

              {providers.map((p, idx) => (
                <form
                  key={p.id}
                  action={startPaymentFromForm}
                  className={idx === 0 ? "mt-5" : "mt-2"}
                >
                  <input type="hidden" name="orderId" value={order.id} />
                  <input type="hidden" name="providerId" value={p.id} />
                  <button
                    type="submit"
                    className={`w-full rounded-md py-2.5 text-[14px] font-medium transition ${PROVIDER_BUTTON_CLASS[p.id]}`}
                  >
                    {p.label}
                  </button>
                </form>
              ))}

              <form action={cancelOrderFromForm} className="mt-2">
                <input type="hidden" name="orderId" value={order.id} />
                <button
                  type="submit"
                  className="w-full rounded-md border border-line bg-white py-2.5 text-[13px] text-ink-3 hover:text-ink hover:border-brand/40 transition"
                >
                  取消订单
                </button>
              </form>
            </>
          ) : order.status === "paid" ? (
            <>
              <div className="text-[13px] text-ink-3">订单状态</div>
              <div className="mt-1 text-[20px] font-semibold text-emerald-700">已支付</div>
              <div className="mt-1 text-[12px] text-ink-3">
                通过 {order.paymentMethod ? PAY_LABEL[order.paymentMethod] : "—"} 完成
              </div>
              <Link
                href={resourcePath(order.type, order.refId)}
                className="mt-5 block w-full rounded-md bg-brand text-white py-2.5 text-center text-[14px] font-medium hover:bg-brand-dark transition"
              >
                前往{TYPE_LABEL[order.type]}
              </Link>
            </>
          ) : (
            <>
              <div className="text-[13px] text-ink-3">订单状态</div>
              <div className="mt-1 text-[20px] font-semibold text-ink-3">已取消</div>
              <Link
                href="/orders"
                className="mt-5 block w-full rounded-md border border-line bg-white py-2.5 text-center text-[13px] text-ink-2 hover:border-brand/40 transition"
              >
                返回订单列表
              </Link>
            </>
          )}
        </aside>
      </div>

      {pendingCodeUrl && pendingProvider ? (
        <QrCodeModal
          orderId={order.id}
          codeUrl={pendingCodeUrl}
          providerLabel={pendingProvider.label}
          closeHref={`/orders/${order.id}`}
        />
      ) : null}
    </section>
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
