import { notFound } from "next/navigation";
import { Download, Scissors } from "lucide-react";
import { findByCode, isProtectedQr } from "@/lib/db/qr";
import { absoluteUrl } from "@/lib/site";
import { qrSvg } from "@/lib/qr/svg";
import { CardEditor } from "./_CardEditor";
import { LinksEditor } from "./_LinksEditor";
import { TypeSectionToggle } from "./_TypeSectionToggle";
import { Card, PageHeader, GhostLink } from "../../../_components/Shell";
import { Field, Input, Select } from "../../../_components/Form";
import { DeleteButton } from "../../../_components/DeleteButton";
import { saveQr, toggleQrDisabled, deleteQr } from "../actions";
import { loadSavedNotice } from "@/lib/search-params";
import type { SearchParams } from "nuqs/server";

export const dynamic = "force-dynamic";

export default async function AdminQrEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const [{ code: rawCode }, sp] = await Promise.all([
    params,
    loadSavedNotice(searchParams),
  ]);
  const code = String(rawCode ?? "").trim().toLowerCase();
  const entry = await findByCode(code);
  if (!entry) notFound();

  const landingUrl = absoluteUrl(`/qr/${entry.code}`);
  const svg = qrSvg(landingUrl);

  return (
    <div>
      <PageHeader
        title={`编辑 ${entry.code}`}
        subtitle={`累计扫码 ${entry.scans} 次,落地 /qr/${entry.code}`}
        actions={
          <div className="flex items-center gap-2">
            {/* 全页唯一保存:跨 DOM 提交右侧设置表单(含卡片编辑器的隐藏字段) */}
            <button
              type="submit"
              form="qr-edit-form"
              className="inline-flex items-center justify-center rounded-md bg-brand px-4 py-2 text-[13px] font-medium text-white hover:bg-brand-dark transition"
            >
              保存
            </button>
            <GhostLink href="/admin/qr">返回列表</GhostLink>
          </div>
        }
      />

      {sp.saved === "1" ? (
        <div className="mb-6 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-700">
          已保存。
          {sp.codeErr ? (
            <span className="ml-2 text-amber-700">
              但 code 未改:
              {sp.codeErr === "exists"
                ? "该 code 已被占用,换一个。"
                : sp.codeErr === "protected"
                  ? "演示码的 code 不可改。"
                  : "code 非法(仅小写字母 / 数字 / 连字符)。"}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px] items-start">
        <Card className="p-6">
          <h2 className="text-[15px] font-semibold text-ink mb-4">卡片编辑</h2>
          <CardEditor
            entry={entry}
            svg={svg}
            formId="qr-edit-form"
            landingUrl={landingUrl}
          />
          <div className="mx-auto mt-3 grid w-full max-w-[560px] grid-cols-2 gap-2">
            <a
              href={`/api/qr/${entry.code}/card`}
              download={`card-${entry.code}.svg`}
              title="整张 2×4cm 折叠卡印刷母版:正面图 + 背面码,含 3mm 出血 + 四角裁切线,直接交印厂"
              className="flex items-center justify-center gap-1.5 rounded-md border border-line bg-white px-4 py-2 text-[13px] text-ink-2 hover:border-brand/40 hover:text-brand transition"
            >
              <Scissors size={14} /> 下载折叠卡(带裁切线)
            </a>
            <a
              href={`/api/qr/${entry.code}/card?crop=0`}
              download={`card-${entry.code}-nocrop.svg`}
              title="无四角裁切线的干净版,适合截图 / 预览 / 嵌入展示;送印请用左边带裁切线的"
              className="flex items-center justify-center gap-1.5 rounded-md border border-line bg-white px-4 py-2 text-[13px] text-ink-2 hover:border-brand/40 hover:text-brand transition"
            >
              <Download size={14} /> 不带裁切线
            </a>
          </div>
        </Card>

        <div className="grid gap-6">
          <Card className="p-5">
          <h2 className="text-[15px] font-semibold text-ink mb-3">设置</h2>
          <form action={saveQr} id="qr-edit-form" className="grid gap-4">
            <input type="hidden" name="code" value={entry.code} />
            <TypeSectionToggle />
            {isProtectedQr(entry.code) ? (
              <Field label="Code" hint="演示码,固定不可改">
                <Input defaultValue={entry.code} disabled />
              </Field>
            ) : (
              <Field
                label="Code"
                hint="二维码身份。改它二维码图案会变,已印出去的旧码会失效;仅小写字母 / 数字 / 连字符"
              >
                <Input
                  name="newCode"
                  defaultValue={entry.code}
                  pattern="[a-z0-9-]+"
                  placeholder={entry.code}
                />
              </Field>
            )}
            <Field label="批次标签" hint="内部备注,不展示给用户">
              <Input name="label" defaultValue={entry.label} required />
            </Field>
            <Field label="类型" hint="跳转码=扫码直达;聚合码=展示多链接落地页">
              <Select name="type" defaultValue={entry.type}>
                <option value="redirect">跳转码 redirect</option>
                <option value="landing">聚合码 landing</option>
              </Select>
            </Field>

            <div id="qr-sec-redirect" className="rounded-md border border-line-soft bg-bg-soft p-4">
              <div className="mb-3 text-[13px] font-medium text-ink-2">
                跳转码 · 仅 redirect 生效
              </div>
              <Field
                label="目标路径"
                hint="站内 /courses 或外链 https://…;默认 / 显示落地页。改这里即时生效,印出去的码不用重印"
              >
                <Input name="target" defaultValue={entry.target} placeholder="/courses 或 https://…" />
              </Field>
            </div>

            <div id="qr-sec-landing" className="rounded-md border border-line-soft bg-bg-soft p-4 grid gap-4">
              <div className="text-[13px] font-medium text-ink-2">
                聚合码 · 仅 landing 生效
              </div>
              <Field label="链接列表">
                <LinksEditor name="links" defaultLinks={entry.links ?? []} />
              </Field>
            </div>

            {/* 保存按钮统一用左侧卡片编辑器底部那个全宽「保存」(form={qr-edit-form}),
                它在下载按钮之上,符合「先存再下载」流程;此处不再重复放 */}
            <p className="text-[12px] text-ink-3">
              这里的设置和左侧卡片改动,一起点右上角的「保存」生效。
            </p>
          </form>
          <div className="mt-4 border-t border-line-soft pt-4">
            {entry.disabled ? (
              <form action={toggleQrDisabled}>
                <input type="hidden" name="id" value={entry.code} />
                <input type="hidden" name="disabled" value="0" />
                <button
                  type="submit"
                  className="text-[13px] font-medium text-emerald-700 hover:underline"
                >
                  恢复启用
                </button>
                <span className="ml-2 text-[12px] text-ink-3">
                  当前已停用,扫码看到的是停用提示页。
                </span>
              </form>
            ) : (
              <form action={toggleQrDisabled}>
                <input type="hidden" name="id" value={entry.code} />
                <input type="hidden" name="disabled" value="1" />
                <button
                  type="submit"
                  className="text-[13px] font-medium text-amber-700 hover:underline"
                >
                  停用此码(作废)
                </button>
                <span className="ml-2 text-[12px] text-ink-3">
                  保留数据与统计,扫码改显示停用提示,可随时恢复。
                </span>
              </form>
            )}
            {isProtectedQr(entry.code) ? (
              <p className="mt-3 text-[12px] text-ink-3">
                演示码:站点演示用,永久保留,不可删除(可停用)。
              </p>
            ) : (
              <div className="mt-3 border-t border-line-soft pt-3">
                <DeleteButton
                  id={entry.code}
                  action={deleteQr}
                  label="彻底删除(不可恢复)"
                  confirm={`确定彻底删除 ${entry.code}?数据、链接、扫码统计全部清空且不可恢复。印过的码建议改用「停用」。`}
                />
              </div>
            )}
          </div>
        </Card>

        </div>
      </div>
    </div>
  );
}
