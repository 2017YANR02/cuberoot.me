import Link from "next/link";
import { QrCode, CreditCard, Copy } from "lucide-react";
import { list, isProtectedQr } from "@/lib/db/qr";
import { Tooltip } from "@/components/Tooltip";
import { Card, GhostLink, PageHeader, PrimaryLink, Th, Td } from "../../_components/Shell";
import { Field, FormActions, Input, Submit } from "../../_components/Form";
import { DeleteButton } from "../../_components/DeleteButton";
import { createQrBatch, toggleQrDisabled, deleteQr, duplicateQr } from "./actions";
import { loadErrorNotice } from "@/lib/search-params";
import type { SearchParams } from "nuqs/server";

export const dynamic = "force-dynamic";

function fmtDate(ts: number): string {
  const d = new Date(ts * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default async function AdminQrPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const [rows, sp] = await Promise.all([list(), loadErrorNotice(searchParams)]);
  const totalScans = rows.reduce((s, r) => s + r.scans, 0);

  return (
    <div>
      <PageHeader
        title="二维码 / 落地码"
        subtitle={`共 ${rows.length} 个 code,累计扫码 ${totalScans} 次。落地路径 /qr/[code]`}
        actions={
          <>
            {rows.length > 0 ? (
              <PrimaryLink href="/admin/qr/cards">卡片打印(全部)</PrimaryLink>
            ) : null}
            <GhostLink href="/admin/qr/stats">数据看板</GhostLink>
          </>
        }
      />

      <Card className="p-6 mb-6">
        <h2 className="text-[15px] font-semibold text-ink mb-4">批量生成</h2>
        {sp.error === "invalid" ? (
          <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-[13px] text-amber-700">
            字段无效,label 必填、数量 ≥ 1。
          </div>
        ) : null}
        <form action={createQrBatch} className="grid gap-4 md:grid-cols-2">
          <Field label="前缀(可选)" hint="自动追加随机后缀">
            <Input name="prefix" placeholder="pkg / sz-2026q3" />
          </Field>
          <Field label="数量">
            <Input name="count" type="number" min={1} max={500} placeholder="单次最大 500" required />
          </Field>
          <Field label="批次标签">
            <Input name="label" required placeholder="深圳包裹卡 batch-2026-q3" />
          </Field>
          <Field label="目标 URL" hint="默认 /,可填 /login?invite=XX 等">
            <Input name="target" defaultValue="/" placeholder="/" />
          </Field>
          <FormActions>
            <Submit>批量生成</Submit>
          </FormActions>
        </form>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-bg-soft text-ink-3">
              <tr>
                <Th>Code</Th>
                <Th>类型</Th>
                <Th>批次标签</Th>
                <Th>目标 / 落地</Th>
                <Th className="text-right">扫码次数</Th>
                <Th>创建时间</Th>
                <Th className="text-right">操作</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.code}>
                  <Td className="font-mono text-ink">
                    <Link
                      href={`/admin/qr/${r.code}`}
                      className={
                        "hover:text-brand hover:underline " +
                        (r.disabled ? "text-ink-3 line-through" : "")
                      }
                    >
                      {r.code}
                    </Link>
                    {r.disabled ? (
                      <span className="ml-2 rounded-full bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-700">
                        已停用
                      </span>
                    ) : null}
                  </Td>
                  <Td>
                    <Tooltip
                      content={
                        r.type === "landing"
                          ? "聚合码:扫码停在落地页 /qr/[code],展示标题 + 多个链接按钮,一张卡承载多个去处(名片场景)"
                          : "跳转码:扫码直接打开「目标路径」那一个页面,不停留(目标留空 / 时退化为落地页)"
                      }
                    >
                      <span
                        className={
                          "inline-block cursor-help rounded-full px-2 py-0.5 text-[12px] " +
                          (r.type === "landing"
                            ? "bg-brand-soft text-brand"
                            : "bg-bg-soft text-ink-3")
                        }
                      >
                        {r.type === "landing" ? "聚合码" : "跳转码"}
                      </span>
                    </Tooltip>
                  </Td>
                  <Td className="text-ink-2">{r.label}</Td>
                  <Td className="text-ink-3 break-all">
                    {r.type === "landing"
                      ? `聚合页 · ${r.links?.length ?? 0} 链接`
                      : r.target}
                  </Td>
                  <Td className="text-right text-ink">{r.scans}</Td>
                  <Td className="text-ink-3 whitespace-nowrap">{fmtDate(r.createdAt)}</Td>
                  <Td>
                    <div className="flex items-center justify-end gap-3">
                      <a
                        href={`/api/qr/${r.code}/svg`}
                        download={`qr-${r.code}.svg`}
                        title="下载二维码 SVG(仅码)"
                        className="text-ink-3 hover:text-brand transition"
                      >
                        <QrCode size={15} />
                      </a>
                      <a
                        href={`/api/qr/${r.code}/card`}
                        download={`card-${r.code}.svg`}
                        title="下载折叠卡 SVG(印刷母版:照片正面+矢量背面,含出血+裁切线)"
                        className="text-ink-3 hover:text-brand transition"
                      >
                        <CreditCard size={15} />
                      </a>
                      <form action={duplicateQr} className="flex">
                        <input type="hidden" name="id" value={r.code} />
                        <button
                          type="submit"
                          title="复制为新码(拷贝卡面配置;code 是新的,二维码图案自动不同,扫码数归零)"
                          className="text-ink-3 hover:text-brand transition"
                        >
                          <Copy size={15} />
                        </button>
                      </form>
                      <span className="mx-1 h-4 w-px bg-line" aria-hidden />
                      <form action={toggleQrDisabled} className="flex">
                        <input type="hidden" name="id" value={r.code} />
                        <input
                          type="hidden"
                          name="disabled"
                          value={r.disabled ? "0" : "1"}
                        />
                        <button
                          type="submit"
                          className={
                            "text-[13px] hover:underline " +
                            (r.disabled ? "text-emerald-700" : "text-amber-700")
                          }
                        >
                          {r.disabled ? "恢复" : "停用"}
                        </button>
                      </form>
                      <span className="flex w-12 justify-end">
                        {isProtectedQr(r.code) ? (
                          <span title="演示码,不可删除" className="text-[13px] text-ink-3">
                            演示码
                          </span>
                        ) : (
                          <DeleteButton
                            id={r.code}
                            action={deleteQr}
                            confirm={`确定彻底删除 ${r.code}?数据、链接、扫码统计全部清空且不可恢复。印过的码建议改用「停用」。`}
                          />
                        )}
                      </span>
                    </div>
                  </Td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <Td colSpan={7} className="text-center text-ink-3 py-8">
                    暂无 code,在上方批量生成
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
