import { listCollections, listItems } from "@/lib/db/collections";
import { list as listCourses } from "@/lib/db/courses";
import { Card, PageHeader, Th, Td } from "../../_components/Shell";
import { Field, FormActions, Input, TextArea, Submit } from "../../_components/Form";
import { DeleteButton } from "../../_components/DeleteButton";
import {
  createCollectionFromForm,
  updateCollectionFromForm,
  deleteCollectionFromForm,
  addItemFromForm,
  removeItemFromForm,
  moveItemFromForm,
} from "./actions";
import { loadErrorNotice } from "@/lib/search-params";
import type { SearchParams } from "nuqs/server";
import { ChevronUp, ChevronDown } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminPathsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const [collections, courses, sp] = await Promise.all([
    listCollections(),
    listCourses(),
    loadErrorNotice(searchParams),
  ]);

  // 每条路径的已收课程项(按 idx)
  const itemsByCollection = await Promise.all(
    collections.map((c) => listItems(c.id)),
  );

  return (
    <div>
      <PageHeader
        title="学习路径"
        subtitle={`共 ${collections.length} 条系列合集,把课程打包成有序进阶路线`}
      />

      <Card className="p-6 mb-6">
        <h2 className="text-[15px] font-semibold text-ink mb-4">新建学习路径</h2>
        {sp.error === "missing" ? (
          <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-[13px] text-amber-700">
            标题不能为空。
          </div>
        ) : null}
        <form action={createCollectionFromForm} className="grid gap-4 md:grid-cols-2">
          <Field label="标题">
            <Input name="title" required placeholder="从零到 sub-30 入门路线" />
          </Field>
          <Field label="副标题" hint="列表卡片上的一句话简介">
            <Input name="subtitle" placeholder="零基础到 30 秒以内的完整进阶路径" />
          </Field>
          <Field label="排序" hint="数字越小越靠前,默认 0">
            <Input name="sortOrder" type="number" defaultValue={0} />
          </Field>
          <Field label="封面图 URL" hint="可留空">
            <Input name="coverUrl" placeholder="/uploads/..." />
          </Field>
          <div className="md:col-span-2">
            <Field label="详细说明" hint="路径详情页顶部的整体介绍">
              <TextArea name="description" placeholder="面向刚接触三阶魔方的新手..." />
            </Field>
          </div>
          <FormActions>
            <Submit>创建路径</Submit>
          </FormActions>
        </form>
      </Card>

      {collections.length === 0 ? (
        <Card className="p-10 text-center text-[14px] text-ink-3">
          暂无学习路径
        </Card>
      ) : (
        <div className="grid gap-6">
          {collections.map((c, ci) => {
            const items = itemsByCollection[ci];
            const usedCourseIds = new Set(items.map((it) => it.courseId));
            const available = courses.filter((co) => !usedCourseIds.has(co.id));
            return (
              <Card key={c.id} className="p-6">
                <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
                  <div>
                    <h3 className="text-[16px] font-semibold text-ink">{c.title}</h3>
                    <p className="mt-1 text-[12px] text-ink-3 font-mono">{c.id}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <a
                      href={`/paths/${c.id}`}
                      className="text-[13px] text-brand hover:underline"
                    >
                      查看
                    </a>
                    <DeleteButton
                      id={c.id}
                      action={deleteCollectionFromForm}
                      confirm="删除这条路径?其下课程关联也会一并清除(不影响课程本身)。"
                    />
                  </div>
                </div>

                {/* 编辑元信息 */}
                <form
                  action={updateCollectionFromForm}
                  className="grid gap-4 md:grid-cols-2 border-t border-line pt-4"
                >
                  <input type="hidden" name="id" value={c.id} />
                  <Field label="标题">
                    <Input name="title" defaultValue={c.title} required />
                  </Field>
                  <Field label="副标题">
                    <Input name="subtitle" defaultValue={c.subtitle ?? ""} />
                  </Field>
                  <Field label="排序">
                    <Input name="sortOrder" type="number" defaultValue={c.sortOrder} />
                  </Field>
                  <Field label="封面图 URL">
                    <Input name="coverUrl" defaultValue={c.coverUrl ?? ""} />
                  </Field>
                  <div className="md:col-span-2">
                    <Field label="详细说明">
                      <TextArea name="description" defaultValue={c.description ?? ""} />
                    </Field>
                  </div>
                  <FormActions>
                    <Submit>保存改动</Submit>
                  </FormActions>
                </form>

                {/* 课程项管理 */}
                <div className="mt-6 border-t border-line pt-4">
                  <h4 className="text-[14px] font-semibold text-ink mb-3">
                    路线课程({items.length})
                  </h4>
                  {items.length === 0 ? (
                    <p className="text-[13px] text-ink-3 mb-3">还没有课程,从下方添加。</p>
                  ) : (
                    <table className="w-full text-[13px] mb-4">
                      <thead className="bg-bg-soft text-ink-3">
                        <tr>
                          <Th>#</Th>
                          <Th>课程</Th>
                          <Th className="text-right">排序</Th>
                          <Th className="text-right">操作</Th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {items.map((it, idx) => (
                          <tr key={it.itemId}>
                            <Td className="text-ink-3 w-8">{idx + 1}</Td>
                            <Td className="text-ink">
                              {it.title}
                              <span className="ml-2 font-mono text-[11px] text-ink-3">
                                {it.courseId}
                              </span>
                            </Td>
                            <Td className="text-right">
                              <div className="inline-flex items-center gap-1">
                                <form action={moveItemFromForm} className="inline">
                                  <input type="hidden" name="itemId" value={it.itemId} />
                                  <input type="hidden" name="collectionId" value={c.id} />
                                  <input type="hidden" name="direction" value="up" />
                                  <button
                                    type="submit"
                                    disabled={idx === 0}
                                    className="inline-flex items-center justify-center rounded border border-line p-1 text-ink-2 hover:text-brand hover:border-brand/40 disabled:opacity-30 disabled:cursor-not-allowed transition"
                                    aria-label="上移"
                                  >
                                    <ChevronUp size={14} />
                                  </button>
                                </form>
                                <form action={moveItemFromForm} className="inline">
                                  <input type="hidden" name="itemId" value={it.itemId} />
                                  <input type="hidden" name="collectionId" value={c.id} />
                                  <input type="hidden" name="direction" value="down" />
                                  <button
                                    type="submit"
                                    disabled={idx === items.length - 1}
                                    className="inline-flex items-center justify-center rounded border border-line p-1 text-ink-2 hover:text-brand hover:border-brand/40 disabled:opacity-30 disabled:cursor-not-allowed transition"
                                    aria-label="下移"
                                  >
                                    <ChevronDown size={14} />
                                  </button>
                                </form>
                              </div>
                            </Td>
                            <Td className="text-right">
                              <form action={removeItemFromForm} className="inline">
                                <input type="hidden" name="itemId" value={it.itemId} />
                                <input type="hidden" name="collectionId" value={c.id} />
                                <button
                                  type="submit"
                                  className="text-[13px] text-red-600 hover:underline"
                                >
                                  移除
                                </button>
                              </form>
                            </Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {available.length > 0 ? (
                    <form
                      action={addItemFromForm}
                      className="flex flex-wrap items-end gap-3"
                    >
                      <input type="hidden" name="collectionId" value={c.id} />
                      <label className="block">
                        <span className="block text-[13px] text-ink-2 mb-1.5">添加课程</span>
                        <select
                          name="courseId"
                          required
                          defaultValue=""
                          className="w-full min-w-[260px] rounded-md border border-line bg-white px-3 py-2 text-[14px] outline-none focus:border-brand transition"
                        >
                          <option value="" disabled>
                            选择一门课程...
                          </option>
                          {available.map((co) => (
                            <option key={co.id} value={co.id}>
                              {co.title}（{co.level}）
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="submit"
                        className="rounded-md bg-brand text-white px-4 py-2 text-[14px] font-medium hover:bg-brand-dark transition"
                      >
                        加入路线
                      </button>
                    </form>
                  ) : (
                    <p className="text-[12px] text-ink-3">已包含全部课程。</p>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
