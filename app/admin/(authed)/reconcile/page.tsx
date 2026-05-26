import { db, schema } from "@/db";
import { sql } from "drizzle-orm";
import { recent } from "@/lib/db/payment-logs";
import { PageHeader, Card } from "../../_components/Shell";
import { Badge } from "@/components/Badge";
import type { PaymentMethod, PaymentLogKind } from "@/db/schema";

export const dynamic = "force-dynamic";

const PAY_LABEL: Record<PaymentMethod, string> = {
  mock_wechat: "微信(模拟)",
  mock_alipay: "支付宝(模拟)",
  stripe: "Stripe",
  wechat: "微信支付",
  alipay: "支付宝",
};

const KIND_LABEL: Record<PaymentLogKind, string> = {
  callback: "回调",
  refund: "退款",
  manual_paid: "手动标记已支付",
  manual_cancel: "手动取消",
};

const KIND_TONE: Record<
  PaymentLogKind,
  "success" | "warning" | "muted" | "danger" | "brand"
> = {
  callback: "success",
  refund: "danger",
  manual_paid: "warning",
  manual_cancel: "muted",
};

type Row = {
  method: PaymentMethod | null;
  paidCount: number;
  paidTotal: number;
  refundCount: number;
  refundTotal: number;
};

async function loadSummary(): Promise<Row[]> {
  const rows = db
    .select({
      method: schema.orders.paymentMethod,
      status: schema.orders.status,
      count: sql<number>`count(*)`,
      amountSum: sql<number>`coalesce(sum(${schema.orders.amount}), 0)`,
      refundSum: sql<number>`coalesce(sum(${schema.orders.refundAmount}), 0)`,
    })
    .from(schema.orders)
    .where(
      sql`${schema.orders.status} in ('paid', 'refunded') and ${schema.orders.paymentMethod} is not null`,
    )
    .groupBy(schema.orders.paymentMethod, schema.orders.status)
    .all();

  const byMethod = new Map<string, Row>();
  for (const r of rows) {
    const key = r.method ?? "unknown";
    const cur =
      byMethod.get(key) ??
      ({
        method: r.method,
        paidCount: 0,
        paidTotal: 0,
        refundCount: 0,
        refundTotal: 0,
      } as Row);
    if (r.status === "paid") {
      cur.paidCount += Number(r.count) || 0;
      cur.paidTotal += Number(r.amountSum) || 0;
    } else if (r.status === "refunded") {
      cur.refundCount += Number(r.count) || 0;
      cur.refundTotal += Number(r.refundSum) || 0;
    }
    byMethod.set(key, cur);
  }
  return Array.from(byMethod.values()).sort((a, b) =>
    String(a.method ?? "").localeCompare(String(b.method ?? "")),
  );
}

function fmtDate(ts: number): string {
  const d = new Date(ts * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function shortJson(v: unknown): string {
  if (v == null) return "—";
  try {
    const s = JSON.stringify(v);
    return s.length > 240 ? s.slice(0, 240) + "…" : s;
  } catch {
    return String(v);
  }
}

export default async function AdminReconcilePage() {
  const summary = await loadSummary();
  const logs = await recent(50);

  const totalPaid = summary.reduce((s, r) => s + r.paidTotal, 0);
  const totalRefund = summary.reduce((s, r) => s + r.refundTotal, 0);
  const net = totalPaid - totalRefund;

  return (
    <div>
      <PageHeader
        title="对账与流水"
        subtitle={`已支付合计 ¥${totalPaid} 已退款合计 ¥${totalRefund} 净额 ¥${net}`}
      />

      <Card className="mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-bg-soft text-ink-3">
              <tr>
                <Th>支付方式</Th>
                <Th className="text-right">已支付笔数</Th>
                <Th className="text-right">已支付金额</Th>
                <Th className="text-right">已退款笔数</Th>
                <Th className="text-right">已退款金额</Th>
                <Th className="text-right">净额</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {summary.map((r) => {
                const label = r.method ? PAY_LABEL[r.method] : "未知";
                const net = r.paidTotal - r.refundTotal;
                return (
                  <tr key={r.method ?? "unknown"}>
                    <Td className="text-ink">{label}</Td>
                    <Td className="text-right">{r.paidCount}</Td>
                    <Td className="text-right">¥{r.paidTotal}</Td>
                    <Td className="text-right text-red-600">{r.refundCount}</Td>
                    <Td className="text-right text-red-600">¥{r.refundTotal}</Td>
                    <Td className="text-right font-medium">¥{net}</Td>
                  </tr>
                );
              })}
              {summary.length === 0 ? (
                <tr>
                  <Td colSpan={6} className="text-center text-ink-3 py-8">
                    暂无已支付或已退款订单
                  </Td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      <h2 className="mb-3 text-[15px] font-semibold text-ink">最近 50 条流水</h2>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-bg-soft text-ink-3">
              <tr>
                <Th>时间</Th>
                <Th>订单号</Th>
                <Th>通道</Th>
                <Th>类型</Th>
                <Th>payload</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {logs.map((l) => (
                <tr key={l.id} className="align-top">
                  <Td className="text-ink-3 whitespace-nowrap">{fmtDate(l.createdAt)}</Td>
                  <Td className="font-mono text-ink-3">{l.orderId}</Td>
                  <Td className="text-ink-2">{l.providerId}</Td>
                  <Td>
                    <Badge tone={KIND_TONE[l.kind]}>{KIND_LABEL[l.kind]}</Badge>
                  </Td>
                  <Td className="text-ink-2 max-w-[420px]">
                    <pre className="whitespace-pre-wrap break-all text-[12px] leading-5">
                      {shortJson(l.payload)}
                    </pre>
                  </Td>
                </tr>
              ))}
              {logs.length === 0 ? (
                <tr>
                  <Td colSpan={5} className="text-center text-ink-3 py-8">
                    暂无流水
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

function Th({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <th className={"px-4 py-3 text-left font-medium " + className}>{children}</th>;
}

function Td({
  children,
  className = "",
  colSpan,
}: {
  children: React.ReactNode;
  className?: string;
  colSpan?: number;
}) {
  return (
    <td className={"px-4 py-3 align-middle " + className} colSpan={colSpan}>
      {children}
    </td>
  );
}
