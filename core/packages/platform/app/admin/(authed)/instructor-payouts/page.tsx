import { PageHeader, Card, Th, Td } from "../../_components/Shell";
import { Badge } from "@/components/Badge";
import { listPayouts, payoutSummary } from "@/lib/db/instructor-payouts";
import { generatePayoutsFromForm, markPaidFromForm } from "./actions";

export const dynamic = "force-dynamic";

const METHOD_LABEL: Record<string, string> = {
  bank: "银行卡",
  wechat: "微信",
  alipay: "支付宝",
  manual: "其它",
};

function currentMonth(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function fmtDate(ts: number): string {
  const d = new Date(ts * 1000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

export default async function AdminInstructorPayoutsPage() {
  const [rows, summary] = await Promise.all([listPayouts(), payoutSummary()]);
  const defaultPeriod = currentMonth();

  return (
    <div>
      <PageHeader
        title="讲师结算"
        subtitle="先选月份生成结算单,确认给老师转账后点「标记已打款」并填凭证号留底"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <Stat label="待结笔数" value={String(summary.pendingCount)} />
        <Stat label="待结金额" value={`¥${summary.pendingAmount}`} />
        <Stat label="已结笔数" value={String(summary.paidCount)} />
        <Stat label="已结金额" value={`¥${summary.paidAmount}`} />
      </div>

      <Card className="p-5 mb-6">
        <form
          action={generatePayoutsFromForm}
          className="flex flex-wrap items-end gap-3"
        >
          <label className="flex flex-col gap-1">
            <span className="text-[12px] text-ink-3">结算月份</span>
            <input
              type="month"
              name="period"
              defaultValue={defaultPeriod}
              className="rounded-md border border-line bg-white px-3 py-2 text-[13px] text-ink"
            />
          </label>
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-md bg-brand text-white px-4 py-2 text-[13px] font-medium hover:bg-brand-dark transition"
          >
            生成 / 刷新本月结算单
          </button>
          <p className="basis-full text-[12px] text-ink-3">
            按所选月份汇总每位讲师的付费订单,生成应打款金额。已标记打款的结算单不会被覆盖。
          </p>
        </form>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-bg-soft text-ink-3">
              <tr>
                <Th>讲师</Th>
                <Th>月份</Th>
                <Th className="text-right">订单数</Th>
                <Th className="text-right">实收</Th>
                <Th className="text-right">分成</Th>
                <Th>状态</Th>
                <Th>操作 / 凭证</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((p) => (
                <tr key={p.id}>
                  <Td className="text-ink">{p.instructorName}</Td>
                  <Td className="font-mono text-ink-3">{p.period}</Td>
                  <Td className="text-right">{p.orderCount}</Td>
                  <Td className="text-right text-ink">¥{p.grossAmount}</Td>
                  <Td className="text-right text-brand font-medium">
                    ¥{p.shareAmount}
                  </Td>
                  <Td>
                    {p.status === "paid" ? (
                      <Badge tone="success">已打款</Badge>
                    ) : (
                      <Badge tone="warning">待打款</Badge>
                    )}
                  </Td>
                  <Td>
                    {p.status === "pending" ? (
                      <form
                        action={markPaidFromForm}
                        className="flex flex-wrap items-center gap-2"
                      >
                        <input type="hidden" name="id" value={p.id} />
                        <select
                          name="method"
                          defaultValue="bank"
                          className="rounded-md border border-line bg-white px-2 py-1.5 text-[12px] text-ink"
                        >
                          <option value="bank">银行卡</option>
                          <option value="wechat">微信</option>
                          <option value="alipay">支付宝</option>
                          <option value="manual">其它</option>
                        </select>
                        <input
                          type="text"
                          name="reference"
                          placeholder="凭证号"
                          className="w-28 rounded-md border border-line bg-white px-2 py-1.5 text-[12px] text-ink placeholder:text-ink-3"
                        />
                        <input
                          type="text"
                          name="note"
                          placeholder="备注(可选)"
                          className="w-28 rounded-md border border-line bg-white px-2 py-1.5 text-[12px] text-ink placeholder:text-ink-3"
                        />
                        <button
                          type="submit"
                          className="inline-flex items-center justify-center rounded-md border border-line px-2.5 py-1.5 text-[12px] text-emerald-700 hover:border-emerald-300 transition"
                        >
                          标记已打款
                        </button>
                      </form>
                    ) : (
                      <div className="text-[12px] text-ink-3">
                        <div>
                          {p.paidAt ? fmtDate(p.paidAt) : "—"}
                          {p.method ? ` · ${METHOD_LABEL[p.method] ?? p.method}` : ""}
                        </div>
                        {p.reference ? (
                          <div className="text-ink-2">凭证:{p.reference}</div>
                        ) : null}
                        {p.note ? (
                          <div className="text-ink-3">{p.note}</div>
                        ) : null}
                      </div>
                    )}
                  </Td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <Td colSpan={7} className="text-center text-ink-3 py-8">
                    暂无结算单,先在上方选择月份生成
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[14px] border border-line bg-white p-5">
      <div className="text-[13px] text-ink-3">{label}</div>
      <div className="mt-1 text-[24px] font-semibold text-ink">{value}</div>
    </div>
  );
}
