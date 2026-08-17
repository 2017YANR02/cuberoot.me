import { listAllAlgorithms } from "@/lib/db/algorithms";
import type { Algorithm } from "@/db/schema";
import { PageHeader, PrimaryLink, Card, GhostLink, Th, Td } from "../../_components/Shell";
import { DeleteButton } from "../../_components/DeleteButton";
import { removeAlgorithm, reorderAlgorithm } from "./actions";

export const dynamic = "force-dynamic";

export default async function AlgorithmsAdminPage() {
  const rows = await listAllAlgorithms();

  // 按 category 分组,上 / 下移在同组内交换相邻项的 sortOrder
  const groups = new Map<string, Algorithm[]>();
  for (const a of rows) {
    const g = groups.get(a.category) ?? [];
    g.push(a);
    groups.set(a.category, g);
  }

  return (
    <div>
      <PageHeader
        title="算法字典"
        subtitle={`共 ${rows.length} 条公式,${groups.size} 个类目`}
        actions={<PrimaryLink href="/admin/algorithms/new">新建公式</PrimaryLink>}
      />

      <div className="grid gap-6">
        {[...groups.entries()].map(([category, list]) => (
          <Card key={category}>
            <div className="border-b border-line px-4 py-3 text-[14px] font-medium text-ink">
              {category}
              <span className="ml-2 text-[12px] text-ink-3">{list.length} 条</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead className="bg-bg-soft text-ink-3">
                  <tr>
                    <Th>调序</Th>
                    <Th>名称</Th>
                    <Th>记法</Th>
                    <Th>形态</Th>
                    <Th className="text-right">操作</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {list.map((a, i) => {
                    const prev = list[i - 1];
                    const next = list[i + 1];
                    return (
                      <tr key={a.id}>
                        <Td>
                          <div className="flex flex-col items-center gap-0.5">
                            {prev ? (
                              <form action={reorderAlgorithm}>
                                <input type="hidden" name="a" value={a.id} />
                                <input type="hidden" name="b" value={prev.id} />
                                <button
                                  type="submit"
                                  title="上移"
                                  className="text-ink-3 hover:text-brand text-[12px] leading-none"
                                >
                                  ▲
                                </button>
                              </form>
                            ) : (
                              <span className="text-line text-[12px] leading-none">▲</span>
                            )}
                            {next ? (
                              <form action={reorderAlgorithm}>
                                <input type="hidden" name="a" value={a.id} />
                                <input type="hidden" name="b" value={next.id} />
                                <button
                                  type="submit"
                                  title="下移"
                                  className="text-ink-3 hover:text-brand text-[12px] leading-none"
                                >
                                  ▼
                                </button>
                              </form>
                            ) : (
                              <span className="text-line text-[12px] leading-none">▼</span>
                            )}
                          </div>
                        </Td>
                        <Td className="text-ink">{a.name}</Td>
                        <Td className="font-mono text-ink-2">
                          <span className="block max-w-[280px] truncate" title={a.notation}>
                            {a.notation}
                          </span>
                        </Td>
                        <Td className="text-ink-3">{a.caseGroup ?? "—"}</Td>
                        <Td className="text-right">
                          <div className="inline-flex items-center gap-3">
                            <GhostLink href={`/admin/algorithms/${a.id}`}>编辑</GhostLink>
                            <DeleteButton id={a.id} action={removeAlgorithm} />
                          </div>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        ))}

        {rows.length === 0 ? (
          <Card>
            <div className="px-4 py-8 text-center text-ink-3">暂无公式</div>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
