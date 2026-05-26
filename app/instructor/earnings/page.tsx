import { requireInstructor } from "@/lib/auth/instructor";
import {
  earningsByMonth,
  INSTRUCTOR_REVENUE_SHARE,
} from "@/lib/db/instructor-stats";

export const dynamic = "force-dynamic";

export default async function InstructorEarningsPage() {
  const { instructor } = await requireInstructor();
  const months = await earningsByMonth(instructor.id);

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
          按月汇总付费订单 · 分成比例 {sharePct}% · 仅显示展示,不在此处发起结算
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
