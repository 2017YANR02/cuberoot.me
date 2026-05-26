import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { list as listNews } from "@/lib/db/news";
import { Section } from "@/components/Section";
import { Badge } from "@/components/Badge";

export const metadata = { title: "资讯 — 魔方开放社群" };

const TONE: Record<string, "brand" | "neutral" | "success" | "warning"> = {
  公告: "brand",
  赛事: "success",
  教学: "warning",
  行业: "neutral",
};

export default async function NewsPage() {
  const news = await listNews();
  return (
    <Section eyebrow="资讯中心" title="最新动态 · 平台 · 赛事 · 教学 · 行业">
      <div className="grid gap-4">
        {news.map((n) => (
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
    </Section>
  );
}
