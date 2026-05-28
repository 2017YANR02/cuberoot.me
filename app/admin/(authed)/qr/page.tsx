import Link from "next/link";
import { Download } from "lucide-react";
import { list } from "@/lib/db/qr";
import { Tooltip } from "@/components/Tooltip";
import { Card, PageHeader, PrimaryLink } from "../../_components/Shell";
import { Field, FormActions, Input, Submit } from "../../_components/Form";
import { DeleteButton } from "../../_components/DeleteButton";
import { createQrBatch, deleteQr } from "./actions";

export const dynamic = "force-dynamic";

function fmtDate(ts: number): string {
  const d = new Date(ts * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default async function AdminQrPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [rows, sp] = await Promise.all([list(), searchParams]);
  const totalScans = rows.reduce((s, r) => s + r.scans, 0);

  return (
    <div>
      <PageHeader
        title="二维码 / 落地码"
        subtitle={`共 ${rows.length} 个 code,累计扫码 ${totalScans} 次。落地路径 /qr/[code]`}
        actions={
          rows.length > 0 ? (
            <PrimaryLink href="/admin/qr/cards">卡片打印(全部)</PrimaryLink>
          ) : undefined
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
          <Field label="前缀(可选)" hint="如 pkg / sz-2026q3,自动追加随机后缀">
            <Input name="prefix" placeholder="pkg" />
          </Field>
          <Field label="数量" hint="单次最大 500">
            <Input name="count" type="number" min={1} max={500} defaultValue={10} required />
          </Field>
          <Field label="批次标签" hint="如 深圳包裹卡 batch-2026-q3">
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
                      className="hover:text-brand hover:underline"
                    >
                      {r.code}
                    </Link>
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
                  <Td className="text-right whitespace-nowrap">
                    <a
                      href={`/api/qr/${r.code}/svg`}
                      download={`qr-${r.code}.svg`}
                      title="下载二维码 SVG"
                      className="mr-3 inline-flex items-center align-middle text-ink-3 hover:text-brand transition"
                    >
                      <Download size={14} />
                    </a>
                    <DeleteButton id={r.code} action={deleteQr} />
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
