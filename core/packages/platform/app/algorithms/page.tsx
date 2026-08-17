import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { SearchParams } from "nuqs/server";
import { Section } from "@/components/Section";
import { Badge } from "@/components/Badge";
import { ListSearch } from "@/components/ListSearch";
import { AlgorithmCategories } from "@/components/AlgorithmCategories";
import { listAlgorithms, algorithmCategories } from "@/lib/db/algorithms";
import { AlgBoard } from "@/lib/cube/face-svg";
import { loadAlgorithmListParams } from "@/lib/search-params";

export const metadata = {
  title: "算法字典 — 魔方开放社群",
  description:
    "完整的三阶还原算法库:全套 21 个 PLL、常见 OLL 与 F2L 公式,标准记法可一键复制,配俯视示意图与记忆提示。",
};
export const dynamic = "force-dynamic";

export default async function AlgorithmsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { category, q } = await loadAlgorithmListParams(searchParams);
  const [items, categories] = await Promise.all([
    listAlgorithms({ category: category ?? undefined, q }),
    algorithmCategories(),
  ]);

  return (
    <Section
      eyebrow="还原算法"
      title="算法字典 · 三阶公式速查"
      subtitle="PLL / OLL / F2L 标准记法,配俯视示意盘与记忆提示。点开任意公式可复制等宽记法,直接照着练。"
    >
      <ListSearch placeholder="搜索公式名 / 记法 / 形态..." />

      <AlgorithmCategories categories={categories} />

      {q ? (
        <div className="mb-6 text-[13px] text-ink-3">
          “{q}” 共找到 <span className="text-ink-2">{items.length}</span> 条公式
        </div>
      ) : null}

      {items.length === 0 ? (
        <div className="rounded-[14px] border border-line bg-white p-10 text-center text-[14px] text-ink-3">
          {q ? `没有找到与 “${q}” 相关的公式` : "暂无公式"}
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((a) => (
            <Link
              key={a.id}
              href={`/algorithms/${a.id}`}
              className="group block rounded-[14px] border border-line bg-white p-5 transition hover:border-brand/40 hover:shadow-[0_8px_28px_-12px_rgba(42,93,244,0.18)]"
            >
              <div className="flex items-start gap-4">
                <div className="shrink-0">
                  <AlgBoard category={a.category} size={72} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge tone="brand">{a.category}</Badge>
                    {a.caseGroup ? (
                      <span className="text-[12px] text-ink-3">{a.caseGroup}</span>
                    ) : null}
                  </div>
                  <h3 className="mb-2 text-[15px] font-semibold text-ink group-hover:text-brand transition">
                    {a.name}
                  </h3>
                  <p className="font-alg text-[13px] leading-relaxed tracking-wide text-ink-2 break-words">
                    {a.notation}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-end text-[12px] text-brand">
                <span className="inline-flex items-center gap-1 group-hover:gap-2 transition-all">
                  详解 <ArrowRight size={12} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </Section>
  );
}
