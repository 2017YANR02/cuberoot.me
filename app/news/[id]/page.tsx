import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { list as listNews, findById as findNews } from "@/lib/db/news";
import { Badge } from "@/components/Badge";
import { Markdown } from "@/components/Markdown";
import { ogImageUrl } from "@/lib/site";

const TONE: Record<string, "brand" | "neutral" | "success" | "warning"> = {
  公告: "brand",
  赛事: "success",
  教学: "warning",
  行业: "neutral",
};

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
          <span className="text-[12px] text-ink-3">{item.date}</span>
        </div>
        <h1 className="text-[26px] md:text-[32px] font-semibold text-ink leading-tight">
          {item.title}
        </h1>
        <p className="mt-3 text-[15px] leading-7 text-ink-3">{item.excerpt}</p>
      </header>

      {item.body ? (
        <Markdown source={item.body} />
      ) : (
        <p className="text-[14px] text-ink-3">正文整理中。</p>
      )}
    </article>
  );
}
