import {
  listPromptTemplates,
  listPromptBlocks,
  listDeletedPromptTemplates,
  type PromptTemplate,
} from "@/lib/db/prompt-templates";
import { PROMPT_PREAMBLE, PROMPT_DIMENSIONS } from "@/lib/qr/prompt";
import { Card, GhostLink, PageHeader } from "../../../_components/Shell";
import { Field, Input, Select, Submit, TextArea } from "../../../_components/Form";
import { DeleteButton } from "../../../_components/DeleteButton";
import {
  createPrompt,
  updatePrompt,
  reorderPrompt,
  deletePrompt,
  restorePrompt,
  purgePrompt,
} from "./actions";
import { loadErrorNotice, loadSavedNotice } from "@/lib/search-params";
import type { SearchParams } from "nuqs/server";

export const dynamic = "force-dynamic";

// 一行模板 / 积木:调序 + 名称 + 正文预览 + 内联编辑 + 移到回收站
function TemplateRow({
  item: t,
  prev,
  next,
}: {
  item: PromptTemplate;
  prev?: PromptTemplate;
  next?: PromptTemplate;
}) {
  return (
    <li className="py-3">
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center gap-0.5 pt-0.5">
          {prev ? (
            <form action={reorderPrompt}>
              <input type="hidden" name="a" value={t.id} />
              <input type="hidden" name="b" value={prev.id} />
              <button type="submit" title="上移" className="text-ink-3 hover:text-brand text-[12px] leading-none">
                ▲
              </button>
            </form>
          ) : (
            <span className="text-line text-[12px] leading-none">▲</span>
          )}
          {next ? (
            <form action={reorderPrompt}>
              <input type="hidden" name="a" value={t.id} />
              <input type="hidden" name="b" value={next.id} />
              <button type="submit" title="下移" className="text-ink-3 hover:text-brand text-[12px] leading-none">
                ▼
              </button>
            </form>
          ) : (
            <span className="text-line text-[12px] leading-none">▼</span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-medium text-ink">{t.name}</span>
            {t.category ? (
              <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] text-brand">
                {t.category}
              </span>
            ) : null}
          </div>
          <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-ink-3">{t.body}</p>

          <details className="mt-2">
            <summary className="cursor-pointer text-[12px] text-brand select-none hover:underline">
              编辑
            </summary>
            <form action={updatePrompt} className="mt-3 grid gap-3">
              <input type="hidden" name="id" value={t.id} />
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <Field label="名称">
                    <Input name="name" defaultValue={t.name} required />
                  </Field>
                </div>
                <Field label="分组">
                  <Input name="category" defaultValue={t.category ?? ""} />
                </Field>
              </div>
              <Field label="描述正文">
                <TextArea name="body" defaultValue={t.body} required />
              </Field>
              <div>
                <Submit>保存修改</Submit>
              </div>
            </form>
          </details>
        </div>

        <div className="pt-0.5">
          {/* 移到回收站,可恢复,不弹确认 */}
          <form action={deletePrompt}>
            <input type="hidden" name="id" value={t.id} />
            <button
              type="submit"
              title="移到回收站(可恢复)"
              className="whitespace-nowrap text-[13px] text-ink-3 hover:text-red-600"
            >
              移到回收站
            </button>
          </form>
        </div>
      </div>
    </li>
  );
}

export default async function AdminPromptTemplatesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const [rows, blocks, trashed, err, ok] = await Promise.all([
    listPromptTemplates(),
    listPromptBlocks(),
    listDeletedPromptTemplates(),
    loadErrorNotice(searchParams),
    loadSavedNotice(searchParams),
  ]);

  return (
    <div>
      <PageHeader
        title="正面图提示词"
        subtitle="整套模板 + 维度积木。编辑页里按维度组合或选整套,一键复制拿去外部图像 AI 生图再上传"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* 同页锚点滚到底部回收站,真 a 支持中键新开 */}
            <a
              href="#recycle-bin"
              className="inline-flex items-center justify-center rounded-md border border-line bg-white px-3 py-1.5 text-[13px] text-ink-2 transition hover:border-brand/40 hover:text-ink"
            >
              回收站{trashed.length ? `(${trashed.length})` : ""}
            </a>
            <GhostLink href="/admin/qr">返回二维码</GhostLink>
          </div>
        }
      />

      {ok.saved === "1" ? (
        <div className="mb-6 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-700">
          已保存。
        </div>
      ) : null}
      {err.error === "invalid" ? (
        <div className="mb-6 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-[13px] text-amber-700">
          名称和描述正文都必填。
        </div>
      ) : null}

      {/* 通用头:每条提示词都自动加在最前,只读展示,要改在代码 lib/qr/prompt.ts */}
      <Card className="p-5 mb-6">
        <details>
          <summary className="cursor-pointer text-[14px] font-medium text-ink select-none">
            通用头(每条自动加在最前,点开查看)
          </summary>
          <pre className="mt-3 whitespace-pre-wrap rounded-md bg-bg-soft p-3 text-[12px] leading-relaxed text-ink-2">
            {PROMPT_PREAMBLE}
          </pre>
          <p className="mt-2 text-[12px] text-ink-3">
            复制时系统自动把这段通用头拼在前面。整套模板=一套完整风格;维度积木=按风格/主体/主题/构图/光影各拼一块。
          </p>
        </details>
      </Card>

      {/* 新增 */}
      <Card className="p-6 mb-6">
        <h2 className="text-[15px] font-semibold text-ink mb-4">新增</h2>
        <form action={createPrompt} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="名称" hint="如 科技发光 / 春节">
              <Input name="name" required placeholder="名称" />
            </Field>
            <Field label="维度" hint="整套预设=完整一套;选某维度=该维度的一块积木">
              <Select name="dimension" defaultValue="">
                <option value="">整套预设模板</option>
                {PROMPT_DIMENSIONS.map((d) => (
                  <option key={d.key} value={d.key}>
                    {d.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="分组(可选)" hint="仅整套模板用,如 大片 / 插画">
              <Input name="category" placeholder="通用" />
            </Field>
          </div>
          <Field label="描述正文" hint="只写画面描述,别写文字/语录;通用头自动加前面。积木写短句,整套写完整风格">
            <TextArea
              name="body"
              required
              placeholder="深蓝渐变背景,一颗悬浮发光的等距魔方,光粒子环绕,冷调高级…"
            />
          </Field>
          <div>
            <Submit>新增</Submit>
          </div>
        </form>
      </Card>

      {/* 整套模板 */}
      <Card className="p-6 mb-6">
        <h2 className="text-[15px] font-semibold text-ink mb-1">
          整套模板 <span className="text-[13px] font-normal text-ink-3">共 {rows.length} 个</span>
        </h2>
        <p className="text-[12px] text-ink-3 mb-4">
          一套完整风格,编辑页「整套现成模板」里一键填入;顺序也是「自动轮换」的轮换序。
        </p>
        {rows.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-ink-3">还没有,在上方新增(维度选「整套预设」)。</p>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((t, i) => (
              <TemplateRow key={t.id} item={t} prev={rows[i - 1]} next={rows[i + 1]} />
            ))}
          </ul>
        )}
      </Card>

      {/* 维度组合积木 */}
      <Card className="p-6">
        <h2 className="text-[15px] font-semibold text-ink mb-1">
          组合积木 <span className="text-[13px] font-normal text-ink-3">共 {blocks.length} 块</span>
        </h2>
        <p className="text-[12px] text-ink-3 mb-4">
          编辑页「按维度组合」用:每个维度各挑一块,叠成完整提示词。
        </p>
        <div className="grid gap-5">
          {PROMPT_DIMENSIONS.map((d) => {
            const items = blocks.filter((b) => b.dimension === d.key);
            return (
              <div key={d.key}>
                <h3 className="text-[13px] font-medium text-ink-2">
                  {d.label}
                  <span className="ml-2 text-[12px] font-normal text-ink-3">
                    {d.hint} · {items.length} 块
                  </span>
                </h3>
                {items.length === 0 ? (
                  <p className="py-3 text-[12px] text-ink-3">该维度还没有积木,上方新增时维度选「{d.label}」。</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {items.map((t, i) => (
                      <TemplateRow key={t.id} item={t} prev={items[i - 1]} next={items[i + 1]} />
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* 回收站:软删的模板停在这,可恢复或彻底删除。常驻显示(空也在),顶部锚点跳来 */}
      <div id="recycle-bin" className="scroll-mt-6">
        <Card className="mt-6 p-6">
          <details open={trashed.length > 0}>
            <summary className="cursor-pointer select-none text-[15px] font-semibold text-ink">
              回收站 <span className="text-[13px] font-normal text-ink-3">{trashed.length} 个</span>
            </summary>
            {trashed.length === 0 ? (
              <p className="mt-2 text-[12px] text-ink-3">
                空。把模板「移到回收站」后会停在这,可恢复或彻底删除。
              </p>
            ) : (
              <>
                <p className="mt-2 text-[12px] text-ink-3">
                  回收站里的不出现在编辑器里。可「恢复」放回,或「彻底删除」永久清掉。
                </p>
                <ul className="mt-3 divide-y divide-line">
                  {trashed.map((t) => (
                    <li key={t.id} className="flex items-start gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[14px] font-medium text-ink-2">{t.name}</span>
                          {t.dimension ? (
                            <span className="rounded-full bg-bg-soft px-2 py-0.5 text-[11px] text-ink-3">
                              {t.dimension}
                            </span>
                          ) : t.category ? (
                            <span className="rounded-full bg-bg-soft px-2 py-0.5 text-[11px] text-ink-3">
                              {t.category}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-ink-3">
                          {t.body}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3 pt-0.5">
                        <form action={restorePrompt}>
                          <input type="hidden" name="id" value={t.id} />
                          <button
                            type="submit"
                            className="text-[13px] font-medium text-emerald-700 hover:underline"
                          >
                            恢复
                          </button>
                        </form>
                        <DeleteButton
                          id={String(t.id)}
                          action={purgePrompt}
                          label="彻底删除"
                          confirm={`确定彻底删除「${t.name}」?不可恢复。`}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </details>
        </Card>
      </div>
    </div>
  );
}
