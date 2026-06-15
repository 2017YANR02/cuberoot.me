import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, CalendarDays } from "lucide-react";
import {
  list as listNews,
  findById as findNews,
  findAdjacent,
  listRelated,
} from "@/lib/db/news";
import type { NewsItem } from "@/lib/db/news";
import { getCurrentUser } from "@/lib/auth-user";
import { isFavorited } from "@/lib/db/favorites";
import { Badge } from "@/components/Badge";
import { FavoriteButton } from "@/components/FavoriteButton";
import { Markdown } from "@/components/Markdown";
import { ogImageUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

const TONE: Record<string, "brand" | "neutral" | "success" | "warning"> = {
  公告: "brand",
  赛事: "success",
  教学: "warning",
  行业: "neutral",
};

// date 是 "YYYY-MM-DD" 文本,split 显示避免 new Date 的 SSR 时区偏移
function formatDate(date: string): string {
  const [y, m, d] = date.split("-");
  if (!y || !m || !d) return date;
  return `${y} 年 ${Number(m)} 月 ${Number(d)} 日`;
}

export async function generateStaticParams() {
  const all = await listNews();
  return all.map((n) => ({ id: n.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = await findNews(id);
  if (!item) return { title: "资讯详情" };
  const desc = item.excerpt;
  const img = ogImageUrl(item.title);
  return {
    title: item.title,
    description: desc,
    openGraph: {
      type: "article" as const,
      title: item.title,
      description: desc,
      images: [{ url: img, width: 1200, height: 630, alt: item.title }],
      publishedTime: item.date,
    },
    twitter: {
      card: "summary_large_image" as const,
      title: item.title,
      description: desc,
      images: [img],
    },
  };
}

export default async function NewsDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = await findNews(id);
  if (!item) notFound();

  const [{ prev, next }, related, user] = await Promise.all([
    findAdjacent(item),
    listRelated(item, 3),
    getCurrentUser(),
  ]);
  const favorited = user ? await isFavorited(user.id, "news", item.id) : false;

  return (
    <article className="container-page py-12 md:py-16 max-w-3xl">
      <Link
        href="/news"
        className="inline-flex items-center gap-1 text-[13px] text-ink-3 hover:text-ink"
      >
        <ArrowLeft size={13} />
        返回资讯列表
      </Link>

      <header className="mt-6 mb-8 border-b border-line pb-6">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <Badge tone={TONE[item.category] ?? "neutral"}>{item.category}</Badge>
          <span className="inline-flex items-center gap-1 text-[12px] text-ink-3">
            <CalendarDays size={13} />
            {formatDate(item.date)}
          </span>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-[26px] md:text-[32px] font-semibold text-ink leading-tight">
            {item.title}
          </h1>
          <FavoriteButton
            targetType="news"
            targetId={item.id}
            initial={favorited}
            loggedIn={!!user}
            next={`/news/${item.id}`}
          />
        </div>
        <p className="mt-3 text-[15px] leading-7 text-ink-3">{item.excerpt}</p>
      </header>

      {item.body ? (
        <Markdown source={item.body} />
      ) : (
        <p className="text-[15px] leading-7 text-ink-2">{item.excerpt}</p>
      )}

      {/* 上一篇 / 下一篇 */}
      {prev || next ? (
        <nav className="mt-12 grid gap-3 border-t border-line pt-8 sm:grid-cols-2">
          {prev ? (
            <Link
              href={`/news/${prev.id}`}
              className="group block rounded-[14px] border border-line bg-white p-4 transition hover:border-brand/40"
            >
              <div className="inline-flex items-center gap-1 text-[12px] text-ink-3">
                <ArrowLeft size={12} />
                上一篇
              </div>
              <div className="mt-1 text-[14px] font-medium text-ink line-clamp-2 group-hover:text-brand transition">
                {prev.title}
              </div>
            </Link>
          ) : (
            <span className="hidden sm:block" />
          )}
          {next ? (
            <Link
              href={`/news/${next.id}`}
              className="group block rounded-[14px] border border-line bg-white p-4 text-right transition hover:border-brand/40"
            >
              <div className="inline-flex items-center gap-1 text-[12px] text-ink-3">
                下一篇
                <ArrowRight size={12} />
              </div>
              <div className="mt-1 text-[14px] font-medium text-ink line-clamp-2 group-hover:text-brand transition">
                {next.title}
              </div>
            </Link>
          ) : null}
        </nav>
      ) : null}

      {/* 同分类相关资讯 */}
      {related.length > 0 ? (
        <section className="mt-12 border-t border-line pt-8">
          <h2 className="text-[16px] font-semibold text-ink mb-4">
            更多「{item.category}」资讯
          </h2>
          <ul className="grid gap-3">
            {related.map((r: NewsItem) => (
              <li key={r.id}>
                <Link
                  href={`/news/${r.id}`}
                  className="group flex items-baseline gap-3 rounded-[14px] border border-line bg-white px-4 py-3 transition hover:border-brand/40"
                >
                  <span className="shrink-0 text-[12px] text-ink-3 tabular-nums">
                    {r.date}
                  </span>
                  <span className="flex-1 text-[14px] text-ink line-clamp-1 group-hover:text-brand transition">
                    {r.title}
                  </span>
                  <ArrowRight
                    size={14}
                    className="shrink-0 text-ink-3 group-hover:text-brand transition"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
