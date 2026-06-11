import {
  listPromptTemplates,
  listDeletedPromptTemplates,
} from "@/lib/db/prompt-templates";
import { PROMPT_PREAMBLE } from "@/lib/qr/prompt";
import { Card, GhostLink, PageHeader } from "../../../_components/Shell";
import { Field, Input, Submit, TextArea } from "../../../_components/Form";
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

export default async function AdminPromptTemplatesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const [rows, trashed, err, ok] = await Promise.all([
    listPromptTemplates(),
    listDeletedPromptTemplates(),
    loadErrorNotice(searchParams),
    loadSavedNotice(searchParams),
  ]);

  return (
    <div>
      <PageHeader
        title="正面图提示词模板"
        subtitle="卡片正面背景图的生图提示词。改谁的卡就在编辑页选模板一键复制,拿去外部图像 AI 生图再上传"
        actions={<GhostLink href="/admin/qr">返回二维码</GhostLink>}
      />

      {ok.saved === "1" ? (
        <div className="mb-6 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-700">
          已保存。
        </div>
      ) : null}
      {err.error === "invalid" ? (
        <div className="mb-6 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-[13px] text-amber-700">
          名称和提示词正文都必填。
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
            下面每个模板只写「风格描述正文」,复制时系统自动把这段通用头拼在前面,凑成完整提示词。
          </p>
        </details>
      </Card>

      {/* 新增 */}
      <Card className="p-6 mb-6">
        <h2 className="text-[15px] font-semibold text-ink mb-4">新增模板</h2>
        <form action={createPrompt} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <Field label="名称" hint="风格名,如 科技发光感">
                <Input name="name" required placeholder="风格名" />
              </Field>
            </div>
            <Field label="分组(可选)" hint="如 通用 / 大片 / 场景">
              <Input name="category" placeholder="通用" />
            </Field>
          </div>
          <Field label="风格描述正文" hint="只写画面风格,别写文字/语录;通用头会自动加在前面">
            <TextArea
              name="body"
              required
              placeholder="深蓝渐变背景,一个悬浮发光的等距魔方,光粒子环绕,冷调高级…"
            />
          </Field>
          <div>
            <Submit>新增模板</Submit>
          </div>
        </form>
      </Card>

      {/* 列表 + 内联编辑 / 调序 / 删除 */}
      <Card className="p-6">
        <h2 className="text-[15px] font-semibold text-ink mb-1">
          模板列表 <span className="text-[13px] font-normal text-ink-3">共 {rows.length} 个</span>
        </h2>
        <p className="text-[12px] text-ink-3 mb-4">
          顺序决定编辑页选择器里的排列,也是「自动轮换」的轮换顺序。
        </p>
        {rows.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-ink-3">还没有模板,在上方新增。</p>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((t, i) => {
              const prev = rows[i - 1];
              const next = rows[i + 1];
              return (
                <li key={t.id} className="py-3">
                  <div className="flex items-start gap-3">
                    {/* 调序 */}
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
                      <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-ink-3">
                        {t.body}
                      </p>

                      {/* 内联编辑 */}
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
                          <Field label="风格描述正文">
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
                          className="text-[13px] text-ink-3 hover:text-red-600"
                        >
                          移到回收站
                        </button>
                      </form>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* 回收站:软删的模板停在这,可恢复或彻底删除 */}
      {trashed.length > 0 ? (
        <Card className="mt-6 p-6">
          <details>
            <summary className="cursor-pointer select-none text-[15px] font-semibold text-ink">
              回收站 <span className="text-[13px] font-normal text-ink-3">{trashed.length} 个</span>
            </summary>
            <p className="mt-2 text-[12px] text-ink-3">
              移到回收站的模板不出现在编辑器选择器里。可「恢复」放回在用列表,或「彻底删除」永久清掉。
            </p>
            <ul className="mt-3 divide-y divide-line">
              {trashed.map((t) => (
                <li key={t.id} className="flex items-start gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-medium text-ink-2">{t.name}</span>
                      {t.category ? (
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
                      confirm={`确定彻底删除模板「${t.name}」?不可恢复。`}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </details>
        </Card>
      ) : null}
    </div>
  );
}
