import { notFound } from "next/navigation";
import { findByCode, isProtectedQr } from "@/lib/db/qr";
import { listPromptTemplates, listPromptBlocks } from "@/lib/db/prompt-templates";
import { absoluteUrl } from "@/lib/site";
import { qrSvg } from "@/lib/qr/svg";
import { CardEditor } from "./_CardEditor";
import { PromptComposer } from "./_PromptComposer";
import { HeaderDownloads } from "./_HeaderDownloads";
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
  const [{ code: rawCode }, sp, templates, blocks] = await Promise.all([
    params,
    loadSavedNotice(searchParams),
    listPromptTemplates(),
    listPromptBlocks(),
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
          <div className="flex flex-wrap items-center gap-2">
            {/* 全页唯一保存:跨 DOM 提交右侧设置表单(含卡片编辑器的隐藏字段) */}
            <button
              type="submit"
              form="qr-edit-form"
              className="inline-flex items-center justify-center rounded-md bg-brand px-4 py-2 text-[13px] font-medium text-white hover:bg-brand-dark transition"
            >
              保存
            </button>
            {/* 下载前先自动保存,再下已存版本(组件内处理) */}
            <HeaderDownloads code={entry.code} formId="qr-edit-form" />
            <GhostLink href="/admin/qr">返回</GhostLink>
          </div>
        }
      />

      {/* 成功提示多余已删;仅在 code 改不动时保留警告反馈 */}
      {sp.saved === "1" && sp.codeErr ? (
        <div className="mb-6 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-[13px] text-amber-700">
          已保存,但 code 未改:
          {sp.codeErr === "exists"
            ? "该 code 已被占用,换一个。"
            : sp.codeErr === "protected"
              ? "演示码的 code 不可改。"
              : "code 非法(仅小写字母 / 数字 / 连字符)。"}
        </div>
      ) : null}

      <div className="grid gap-6">
        <Card className="p-6">
          <h2 className="text-[15px] font-semibold text-ink mb-4">卡片编辑</h2>
          <CardEditor
            entry={entry}
            svg={svg}
            formId="qr-edit-form"
            landingUrl={landingUrl}
          />
        </Card>

        {/* 提示词组合器:常驻,挪到卡片编辑下方占整条宽 */}
        <Card className="p-6">
          <PromptComposer
            templates={templates}
            blocks={blocks}
            formId="qr-edit-form"
            defaultPrompt={entry.frontArtPrompt ?? ""}
          />
        </Card>

        <div className="grid gap-6">
          <Card className="p-5">
          <h2 className="text-[15px] font-semibold text-ink mb-3">设置</h2>
          <form action={saveQr} id="qr-edit-form" className="grid gap-4">
            <input type="hidden" name="code" value={entry.code} />
            <TypeSectionToggle />
            <div className="grid gap-4 sm:grid-cols-3">
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
            </div>

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
              这里的设置和上方卡片改动,一起点右上角的「保存」生效。
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
