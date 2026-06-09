import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { listPaged } from "@/lib/db/news";
import { Section } from "@/components/Section";
import { Badge } from "@/components/Badge";
import { Pagination } from "@/components/Pagination";
import { ListSearch } from "@/components/ListSearch";

export const metadata = { title: "资讯 — 魔方开放社群" };
export const dynamic = "force-dynamic";

const TONE: Record<string, "brand" | "neutral" | "success" | "warning"> = {
  公告: "brand",
  赛事: "success",
  教学: "warning",
  行业: "neutral",
};

type SP = Promise<{ q?: string; page?: string }>;

export default async function NewsPage({ searchParams }: { searchParams: SP }) {
  const { q, page } = await searchParams;
  const pageNum = Math.max(1, Number(page) || 1);
  const result = await listPaged({ q, page: pageNum, pageSize: 12 });

  return (
    <Section eyebrow="资讯中心" title="最新动态 · 平台 · 赛事 · 教学 · 行业">
      <ListSearch placeholder="搜索资讯标题、正文..." />

      {q && (
        <div className="mb-6 text-[13px] text-ink-3">
          “{q}” 共找到 <span className="text-ink-2">{result.total}</span> 条资讯
        </div>
      )}

      {result.items.length === 0 ? (
        <div className="rounded-[14px] border border-line bg-white p-10 text-center text-[14px] text-ink-3">
          {q ? `没有找到与 “${q}” 相关的资讯` : "暂无资讯"}
        </div>
      ) : (
        <div className="grid gap-4">
          {result.items.map((n) => (
            <Link
              key={n.id}
              href={`/news/${n.id}`}
              className="group block rounded-[14px] border border-line bg-white p-6 transition hover:border-brand/40"
            >
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <Badge tone={TONE[n.category] ?? "neutral"}>{n.category}</Badge>
                <span className="text-[12px] text-ink-3">{n.date}</span>
              </div>
              <h3 className="text-[17px] font-semibold text-ink group-hover:text-brand transition">{n.title}</h3>
              <p className="mt-2 text-[14px] leading-6 text-ink-3">{n.excerpt}</p>
              <div className="mt-3 text-[13px] text-brand inline-flex items-center gap-1 group-hover:gap-2 transition-all">
                阅读全文 <ArrowRight size={13} />
              </div>
            </Link>
          ))}
        </div>
      )}

      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        basePath="/news"
        params={{ q }}
      />
    </Section>
  );
}
