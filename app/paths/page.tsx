import Link from "next/link";
import { Route, BookOpen, ArrowRight } from "lucide-react";
import { listCollections } from "@/lib/db/collections";
import { Section } from "@/components/Section";

export const metadata = {
  title: "学习路径 — 魔方开放社群",
  description: "把零散的魔方课程打包成有序的进阶路线,跟着路线图一步步从入门走到竞速。",
};
export const dynamic = "force-dynamic";

export default async function PathsPage() {
  const collections = await listCollections();

  return (
    <Section
      eyebrow="系列合集"
      title="跟着学习路径,从入门走到竞速"
      subtitle="每条路径把相关课程按顺序串成一条进阶路线,不用纠结先学哪门后学哪门,照着走就行。"
    >
      {collections.length === 0 ? (
        <div className="rounded-[14px] border border-line bg-white p-10 text-center text-[14px] text-ink-3">
          暂无学习路径
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {collections.map((c) => (
            <Link
              key={c.id}
              href={`/paths/${c.id}`}
              className="group block rounded-[14px] border border-line bg-white p-6 transition hover:border-brand/40 hover:shadow-[0_8px_28px_-12px_rgba(42,93,244,0.18)]"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-[12px] bg-brand-soft text-brand">
                <Route size={20} />
              </div>
              <h3 className="text-[17px] font-semibold text-ink mb-2 group-hover:text-brand transition">
                {c.title}
              </h3>
              {c.subtitle ? (
                <p className="text-[13px] leading-6 text-ink-3 mb-5 line-clamp-2">
                  {c.subtitle}
                </p>
              ) : (
                <div className="mb-5" />
              )}
              <div className="flex items-center justify-between border-t border-line pt-4">
                <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-3">
                  <BookOpen size={13} />
                  {c.courseCount} 门课程
                </span>
                <span className="text-[13px] text-brand inline-flex items-center gap-1 group-hover:gap-2 transition-all">
                  查看路线 <ArrowRight size={14} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </Section>
  );
}
