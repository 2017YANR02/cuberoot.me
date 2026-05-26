import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  MessageSquare,
  Newspaper,
  ShoppingBag,
} from "lucide-react";
import { Section } from "@/components/Section";
import { Badge } from "@/components/Badge";
import { searchAll, type SearchType } from "@/lib/db/search";
import { SearchPageForm } from "./SearchForm";
import type { Metadata } from "next";

type SP = Promise<{ q?: string }>;

export const dynamic = "force-dynamic";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SP;
}): Promise<Metadata> {
  const { q } = await searchParams;
  const title = q ? `搜索 “${q}” — 魔方开放社群` : "搜索 — 魔方开放社群";
  return {
    title,
    robots: { index: false, follow: true },
  };
}

const TYPE_META: Record<
  SearchType,
  { label: string; icon: typeof BookOpen; href: string }
> = {
  courses: { label: "课程", icon: BookOpen, href: "/courses" },
  products: { label: "商品", icon: ShoppingBag, href: "/shop" },
  events: { label: "赛事", icon: CalendarDays, href: "/events" },
  news: { label: "资讯", icon: Newspaper, href: "/news" },
  posts: { label: "帖子", icon: MessageSquare, href: "/community" },
};

export default async function SearchPage({ searchParams }: { searchParams: SP }) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  return (
    <Section eyebrow="站内搜索" title="搜索 课程 商品 赛事 资讯 帖子">
      <div className="mb-8 max-w-xl">
        <SearchPageForm defaultValue={query} />
      </div>

      {!query ? (
        <div className="rounded-[14px] border border-line bg-white p-10 text-center text-[14px] text-ink-3">
          输入关键词开始搜索,例如 <span className="text-ink-2">CFOP</span>、<span className="text-ink-2">盲拧</span>、<span className="text-ink-2">竞速</span>
        </div>
      ) : (
        <SearchResults query={query} />
      )}
    </Section>
  );
}

async function SearchResults({ query }: { query: string }) {
  const result = await searchAll(query, 5);
  const groups: { type: SearchType; node: React.ReactNode }[] = [];

  if (result.counts.courses > 0) {
    groups.push({
      type: "courses",
      node: (
        <Group
          type="courses"
          total={result.counts.courses}
          query={query}
        >
          {result.courses.map((c) => (
            <ResultRow
              key={c.id}
              href={`/courses/${c.id}`}
              type="courses"
              title={c.title}
              summary={c.subtitle}
              extra={`${c.level} · ${c.format} · ¥${c.price}`}
            />
          ))}
        </Group>
      ),
    });
  }

  if (result.counts.products > 0) {
    groups.push({
      type: "products",
      node: (
        <Group
          type="products"
          total={result.counts.products}
          query={query}
        >
          {result.products.map((p) => (
            <ResultRow
              key={p.id}
              href={`/shop/${p.id}`}
              type="products"
              title={p.name}
              summary={p.description}
              extra={`${p.category} · ${p.brand} · ¥${p.price}`}
            />
          ))}
        </Group>
      ),
    });
  }

  if (result.counts.events > 0) {
    groups.push({
      type: "events",
      node: (
        <Group type="events" total={result.counts.events} query={query}>
          {result.events.map((e) => (
            <ResultRow
              key={e.id}
              href={`/events/${e.id}`}
              type="events"
              title={e.title}
              summary={e.description}
              extra={`${e.startDate} · ${e.city} · ${e.venue}`}
            />
          ))}
        </Group>
      ),
    });
  }

  if (result.counts.news > 0) {
    groups.push({
      type: "news",
      node: (
        <Group type="news" total={result.counts.news} query={query}>
          {result.news.map((n) => (
            <ResultRow
              key={n.id}
              href={`/news/${n.id}`}
              type="news"
              title={n.title}
              summary={n.excerpt}
              extra={`${n.date} · ${n.category}`}
            />
          ))}
        </Group>
      ),
    });
  }

  if (result.counts.posts > 0) {
    groups.push({
      type: "posts",
      node: (
        <Group type="posts" total={result.counts.posts} query={query}>
          {result.posts.map((p) => (
            <ResultRow
              key={p.id}
              href={`/community/posts/${p.id}`}
              type="posts"
              title={p.title}
              summary={p.body.slice(0, 140)}
              extra={`${p.authorNickname} · ${p.commentCount} 评论 · ${p.likes} 赞`}
            />
          ))}
        </Group>
      ),
    });
  }

  if (groups.length === 0) {
    return (
      <div className="rounded-[14px] border border-line bg-white p-10 text-center text-[14px] text-ink-3">
        没有找到关于 “{query}” 的结果,试试别的关键词。
      </div>
    );
  }

  return <div className="grid gap-8">{groups.map((g) => <div key={g.type}>{g.node}</div>)}</div>;
}

function Group({
  type,
  total,
  query,
  children,
}: {
  type: SearchType;
  total: number;
  query: string;
  children: React.ReactNode;
}) {
  const meta = TYPE_META[type];
  const Icon = meta.icon;
  const seeAllHref =
    type === "posts"
      ? `/community?q=${encodeURIComponent(query)}`
      : `${meta.href}?q=${encodeURIComponent(query)}`;
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="inline-flex items-center gap-2 text-[15px] font-semibold text-ink">
          <Icon size={15} className="text-brand" />
          {meta.label}
          <span className="text-[12px] font-normal text-ink-3">
            {total} 条
          </span>
        </h3>
        {total > 5 && type !== "posts" ? (
          <Link
            href={seeAllHref}
            className="text-[13px] text-brand inline-flex items-center gap-1 hover:gap-1.5 transition-all"
          >
            查看全部 {total} 条 <ArrowRight size={13} />
          </Link>
        ) : null}
      </div>
      <div className="rounded-[14px] border border-line bg-white divide-y divide-line overflow-hidden">
        {children}
      </div>
    </div>
  );
}

function ResultRow({
  href,
  type,
  title,
  summary,
  extra,
}: {
  href: string;
  type: SearchType;
  title: string;
  summary?: string;
  extra?: string;
}) {
  const meta = TYPE_META[type];
  return (
    <Link
      href={href}
      className="group block px-5 py-4 hover:bg-bg-soft transition"
    >
      <div className="mb-1.5 flex items-center gap-2">
        <Badge tone="brand">{meta.label}</Badge>
        {extra ? <span className="text-[12px] text-ink-3">{extra}</span> : null}
      </div>
      <div className="text-[15px] font-medium text-ink group-hover:text-brand transition line-clamp-1">
        {title}
      </div>
      {summary ? (
        <p className="mt-1 text-[13px] leading-6 text-ink-3 line-clamp-2">
          {summary}
        </p>
      ) : null}
    </Link>
  );
}
