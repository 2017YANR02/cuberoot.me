import { requireInstructor } from "@/lib/auth/instructor";
import {
  earningsByMonth,
  INSTRUCTOR_REVENUE_SHARE,
} from "@/lib/db/instructor-stats";
import { listByInstructor } from "@/lib/db/instructor-payouts";

export const dynamic = "force-dynamic";

const PAYOUT_METHOD_LABEL: Record<string, string> = {
  bank: "银行卡",
  wechat: "微信",
  alipay: "支付宝",
  manual: "其它",
};

function fmtPayoutDate(ts: number): string {
  const d = new Date(ts * 1000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default async function InstructorEarningsPage() {
  const { instructor } = await requireInstructor();
  const months = await earningsByMonth(instructor.id);
  const payouts = await listByInstructor(instructor.id);

  const totals = months.reduce(
    (s, m) => ({
      orders: s.orders + m.orders,
      gross: s.gross + m.gross,
      discount: s.discount + m.discount,
      net: s.net + m.net,
      share: s.share + m.share,
    }),
    { orders: 0, gross: 0, discount: 0, net: 0, share: 0 },
  );

  const sharePct = Math.round(INSTRUCTOR_REVENUE_SHARE * 100);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[22px] font-semibold text-ink">分成报表</h1>
        <p className="mt-1 text-[13px] text-ink-3">
          按月汇总付费订单,分成比例 {sharePct}%。结算由平台统一打款,可在下方查看到账状态
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <Stat label="累计订单" value={String(totals.orders)} />
        <Stat label="累计原价" value={`¥${totals.gross}`} hint="amount + discount" />
        <Stat label="累计实付" value={`¥${totals.net}`} hint="amount" />
        <Stat
          label={`应得分成 (${sharePct}%)`}
          value={`¥${totals.share}`}
          hint="尚未结算"
        />
      </div>

      <div className="rounded-[14px] border border-line bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-bg-soft text-ink-3">
              <tr>
                <Th>月份</Th>
                <Th className="text-right">订单数</Th>
                <Th className="text-right">原价</Th>
                <Th className="text-right">优惠</Th>
                <Th className="text-right">实付 (net)</Th>
                <Th className="text-right">分成 ({sharePct}%)</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {months.map((m) => (
                <tr key={m.month}>
                  <Td className="font-mono text-ink">{m.month}</Td>
                  <Td className="text-right">{m.orders}</Td>
                  <Td className="text-right text-ink-3">¥{m.gross}</Td>
                  <Td className="text-right text-ink-3">¥{m.discount}</Td>
                  <Td className="text-right text-ink">¥{m.net}</Td>
                  <Td className="text-right text-brand font-medium">¥{m.share}</Td>
                </tr>
              ))}
              {months.length === 0 ? (
                <tr>
                  <Td colSpan={6} className="text-center text-ink-3 py-8">
                    暂无收入数据
                  </Td>
                </tr>
              ) : null}
            </tbody>
            {months.length > 0 ? (
              <tfoot className="bg-bg-soft/60 text-ink-2">
                <tr>
                  <Td className="font-medium">合计</Td>
                  <Td className="text-right font-medium">{totals.orders}</Td>
                  <Td className="text-right">¥{totals.gross}</Td>
                  <Td className="text-right">¥{totals.discount}</Td>
                  <Td className="text-right font-medium">¥{totals.net}</Td>
                  <Td className="text-right font-medium text-brand">¥{totals.share}</Td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </div>

      <p className="mt-4 text-[12px] text-ink-3">
        说明:实付 = 订单 amount(已扣优惠);分成 = 实付 × {sharePct}%。退款订单不计入。
      </p>

      <div className="mt-10 mb-4">
        <h2 className="text-[18px] font-semibold text-ink">结算记录</h2>
        <p className="mt-1 text-[13px] text-ink-3">
          平台按月统一打款,这里查看每月的到账状态与凭证。
        </p>
      </div>

      <div className="rounded-[14px] border border-line bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-bg-soft text-ink-3">
              <tr>
                <Th>月份</Th>
                <Th className="text-right">应结分成</Th>
                <Th>状态</Th>
                <Th>打款时间</Th>
                <Th>凭证</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {payouts.map((p) => (
                <tr key={p.id}>
                  <Td className="font-mono text-ink">{p.period}</Td>
                  <Td className="text-right text-brand font-medium">
                    ¥{p.shareAmount}
                  </Td>
                  <Td>
                    {p.status === "paid" ? (
                      <span className="text-emerald-700">已打款</span>
                    ) : (
                      <span className="text-amber-700">待打款</span>
                    )}
                  </Td>
                  <Td className="text-ink-3">
                    {p.status === "paid" && p.paidAt
                      ? fmtPayoutDate(p.paidAt)
                      : "—"}
                    {p.status === "paid" && p.method
                      ? ` · ${PAYOUT_METHOD_LABEL[p.method] ?? p.method}`
                      : ""}
                  </Td>
                  <Td className="text-ink-3">{p.reference || "—"}</Td>
                </tr>
              ))}
              {payouts.length === 0 ? (
                <tr>
                  <Td colSpan={5} className="text-center text-ink-3 py-8">
                    暂无结算记录
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

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-[14px] border border-line bg-white p-5">
      <div className="text-[13px] text-ink-3">{label}</div>
      <div className="mt-1 text-[24px] font-semibold text-ink">{value}</div>
      {hint ? <div className="mt-2 text-[12px] text-ink-3">{hint}</div> : null}
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
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
