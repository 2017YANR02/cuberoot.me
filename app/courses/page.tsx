import Link from "next/link";
import { Clock, Users, Star, ArrowRight } from "lucide-react";
import { listPaged } from "@/lib/db/courses";
import { Section } from "@/components/Section";
import { Badge } from "@/components/Badge";
import { Pagination } from "@/components/Pagination";
import { ListSearch } from "@/components/ListSearch";
import { loadListSearchParams } from "@/lib/search-params";
import type { SearchParams } from "nuqs/server";

export const metadata = { title: "课程 — 魔方开放社群" };
export const dynamic = "force-dynamic";

export default async function CoursesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { q, page } = await loadListSearchParams(searchParams);
  const result = await listPaged({ q, page, pageSize: 12 });

  return (
    <Section
      eyebrow="教培板块"
      title="覆盖入门到竞速全阶段的魔方课程"
      subtitle="从层先法启蒙到 CFOP / 盲拧 / ZBLL 高阶训练,既有体系化录播,也有直播与一对一私教。"
    >
      <ListSearch placeholder="搜索课程、讲师、标签..." />

      {q && (
        <div className="mb-6 text-[13px] text-ink-3">
          “{q}” 共找到 <span className="text-ink-2">{result.total}</span> 门课程
        </div>
      )}

      {result.items.length === 0 ? (
        <div className="rounded-[14px] border border-line bg-white p-10 text-center text-[14px] text-ink-3">
          {q ? `没有找到与 “${q}” 相关的课程` : "暂无课程"}
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {result.items.map((c) => (
            <Link
              key={c.id}
              href={`/courses/${c.id}`}
              className="group block rounded-[14px] border border-line bg-white p-6 transition hover:border-brand/40 hover:shadow-[0_8px_28px_-12px_rgba(42,93,244,0.18)]"
            >
              <div className="flex items-center gap-2 mb-3">
                <Badge tone="brand">{c.level}</Badge>
                <Badge tone="muted">{c.format}</Badge>
              </div>
              <h3 className="text-[17px] font-semibold text-ink mb-2 group-hover:text-brand transition">
                {c.title}
              </h3>
              <p className="text-[13px] leading-6 text-ink-3 mb-5 line-clamp-2">{c.subtitle}</p>
              <div className="flex items-center gap-4 text-[12px] text-ink-3 mb-5">
                <span className="inline-flex items-center gap-1"><Clock size={13} />{c.durationHours}h</span>
                <span className="inline-flex items-center gap-1"><Users size={13} />{c.studentsEnrolled}</span>
                <span className="inline-flex items-center gap-1"><Star size={13} className="text-amber-500" />{c.rating}</span>
              </div>
              <div className="flex items-center justify-between border-t border-line pt-4">
                <div>
                  <span className="text-[20px] font-semibold text-brand">¥{c.price}</span>
                  <span className="text-[12px] text-ink-3 ml-1">/{c.format === "一对一私教" ? "节" : "套"}</span>
                </div>
                <span className="text-[13px] text-brand inline-flex items-center gap-1 group-hover:gap-2 transition-all">
                  了解详情 <ArrowRight size={14} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        basePath="/courses"
        params={{ q }}
      />
    </Section>
  );
}
