import { list } from "@/lib/db/coupons";
import { Card, PageHeader, Th, Td } from "../../_components/Shell";
import { Field, FormActions, Input, Select, Submit } from "../../_components/Form";
import { DeleteButton } from "../../_components/DeleteButton";
import { createCoupon, deleteCoupon } from "./actions";
import { loadErrorNotice } from "@/lib/search-params";
import type { SearchParams } from "nuqs/server";

export const dynamic = "force-dynamic";

function fmtDate(ts: number | null): string {
  if (!ts) return "—";
  const d = new Date(ts * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function AdminCouponsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const [rows, sp] = await Promise.all([list(), loadErrorNotice(searchParams)]);

  return (
    <div>
      <PageHeader title="优惠券" subtitle={`共 ${rows.length} 个优惠码,可用于课程 / 商品 / 赛事订单`} />

      <Card className="p-6 mb-6">
        <h2 className="text-[15px] font-semibold text-ink mb-4">新建优惠码</h2>
        {sp.error === "invalid" ? (
          <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-[13px] text-amber-700">
            字段无效,请检查 code 与折扣值。
          </div>
        ) : null}
        <form action={createCoupon} className="grid gap-4 md:grid-cols-2">
          <Field label="Code(大写)">
            <Input name="code" required placeholder="WELCOME10" />
          </Field>
          <Field label="折扣类型">
            <Select name="discountType" defaultValue="fixed">
              <option value="fixed">固定金额 (¥)</option>
              <option value="percent">百分比 (%)</option>
            </Select>
          </Field>
          <Field label="折扣值" hint="fixed 为 ¥金额, percent 为 0-100 整数">
            <Input name="discountValue" type="number" min={1} required />
          </Field>
          <Field label="适用范围">
            <Select name="appliesTo" defaultValue="any">
              <option value="any">通用</option>
              <option value="course">仅课程</option>
              <option value="product">仅商品</option>
              <option value="event">仅赛事</option>
            </Select>
          </Field>
          <Field label="最低订单金额">
            <Input name="minAmount" type="number" min={0} defaultValue={0} />
          </Field>
          <Field label="最大使用次数" hint="0 = 不限">
            <Input name="maxUses" type="number" min={0} defaultValue={0} />
          </Field>
          <Field label="过期时间" hint="留空 = 不过期">
            <Input name="expiresAt" type="date" />
          </Field>
          <Field label="启用">
            <label className="inline-flex items-center gap-2 text-[13px] text-ink-2 mt-2">
              <input type="checkbox" name="active" defaultChecked />
              立即可用
            </label>
          </Field>
          <FormActions>
            <Submit>创建</Submit>
          </FormActions>
        </form>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-bg-soft text-ink-3">
              <tr>
                <Th>Code</Th>
                <Th>折扣</Th>
                <Th>适用</Th>
                <Th>门槛</Th>
                <Th>使用 / 上限</Th>
                <Th>过期</Th>
                <Th>状态</Th>
                <Th className="text-right">操作</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((c) => (
                <tr key={c.code}>
                  <Td className="font-mono text-ink">{c.code}</Td>
                  <Td className="text-ink">
                    {c.discountType === "fixed" ? `¥${c.discountValue}` : `${c.discountValue}%`}
                  </Td>
                  <Td>{c.appliesTo}</Td>
                  <Td>¥{c.minAmount}</Td>
                  <Td>
                    {c.uses} / {c.maxUses === 0 ? "∞" : c.maxUses}
                  </Td>
                  <Td className="text-ink-3">{fmtDate(c.expiresAt)}</Td>
                  <Td className={c.active ? "text-emerald-700" : "text-ink-3"}>
                    {c.active ? "启用" : "停用"}
                  </Td>
                  <Td className="text-right">
                    <DeleteButton id={c.code} action={deleteCoupon} />
                  </Td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <Td colSpan={8} className="text-center text-ink-3 py-8">
                    暂无优惠码
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
