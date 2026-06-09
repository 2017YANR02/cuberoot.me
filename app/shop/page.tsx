import Link from "next/link";
import { Star, ArrowRight } from "lucide-react";
import { listPaged } from "@/lib/db/products";
import { Section } from "@/components/Section";
import { Badge } from "@/components/Badge";
import { Pagination } from "@/components/Pagination";
import { ListSearch } from "@/components/ListSearch";
import { loadListSearchParams } from "@/lib/search-params";
import type { SearchParams } from "nuqs/server";

export const metadata = { title: "商城 — 魔方开放社群" };
export const dynamic = "force-dynamic";

const CATEGORIES: { key: string; label: string }[] = [
  { key: "全部", label: "全部" },
  { key: "竞速魔方", label: "竞速魔方" },
  { key: "异形", label: "异形" },
  { key: "配件", label: "配件" },
  { key: "周边", label: "周边" },
];

export default async function ShopPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { q, page } = await loadListSearchParams(searchParams);
  const result = await listPaged({ q, page, pageSize: 12 });

  return (
    <Section
      eyebrow="器材周边"
      title="官方商城直供 · 精选高品质魔方与周边"
      subtitle="竞速主力、异形挑战、专业配件、限定文创周边,平台直发,所有商品均经过专业玩家筛选。"
    >
      <ListSearch placeholder="搜索商品、品牌..." />

      <div className="flex flex-wrap gap-2 mb-8">
        {CATEGORIES.map((c) => (
          <span
            key={c.key}
            className={
              "rounded-full px-3 py-1.5 text-[13px] border " +
              (c.key === "全部"
                ? "border-brand bg-brand-soft text-brand-dark"
                : "border-line text-ink-2 bg-white")
            }
          >
            {c.label}
          </span>
        ))}
      </div>

      {q && (
        <div className="mb-6 text-[13px] text-ink-3">
          “{q}” 共找到 <span className="text-ink-2">{result.total}</span> 件商品
        </div>
      )}

      {result.items.length === 0 ? (
        <div className="rounded-[14px] border border-line bg-white p-10 text-center text-[14px] text-ink-3">
          {q ? `没有找到与 “${q}” 相关的商品` : "暂无商品"}
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {result.items.map((p) => (
            <Link
              key={p.id}
              href={`/shop/${p.id}`}
              className="group block rounded-[14px] border border-line bg-white overflow-hidden transition hover:border-brand/40 hover:shadow-[0_8px_28px_-12px_rgba(42,93,244,0.18)]"
            >
              <ProductArt name={p.name} category={p.category} />
              <div className="p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Badge tone="brand">{p.category}</Badge>
                  <span className="text-[12px] text-ink-3">{p.brand}</span>
                </div>
                <h3 className="text-[15px] font-semibold text-ink mb-1 group-hover:text-brand transition line-clamp-2 min-h-[44px]">
                  {p.name}
                </h3>
                <div className="flex items-center gap-3 text-[12px] text-ink-3 mb-3">
                  <span className="inline-flex items-center gap-1"><Star size={12} className="text-amber-500" />{p.rating}</span>
                  <span>{p.reviews} 评价</span>
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <span className="text-[20px] font-semibold text-brand">¥{p.price}</span>
                    {p.originalPrice && (
                      <span className="text-[12px] text-ink-3 line-through ml-2">¥{p.originalPrice}</span>
                    )}
                  </div>
                  <span className="text-[12px] text-brand inline-flex items-center gap-1 group-hover:gap-2 transition-all">
                    详情 <ArrowRight size={12} />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        basePath="/shop"
        params={{ q }}
      />
    </Section>
  );
}

function ProductArt({ name, category }: { name: string; category: string }) {
  const hue = hashHue(name);
  return (
    <div
      className="aspect-[4/3] grid place-items-center"
      style={{
        background: `linear-gradient(135deg, hsl(${hue} 70% 96%), hsl(${(hue + 30) % 360} 75% 92%))`,
      }}
    >
      <svg viewBox="0 0 100 100" className="w-24 h-24" aria-hidden>
        <g transform="translate(50 50)">
          <polygon points="0,-28 24,-14 24,14 0,28 -24,14 -24,-14" fill={`hsl(${hue} 70% 55%)`} opacity="0.18" />
          <polygon points="0,-28 24,-14 0,0 -24,-14" fill={`hsl(${hue} 70% 55%)`} />
          <polygon points="24,-14 24,14 0,28 0,0" fill={`hsl(${hue} 70% 45%)`} />
          <polygon points="-24,-14 0,0 0,28 -24,14" fill={`hsl(${hue} 75% 36%)`} />
        </g>
      </svg>
      <span className="sr-only">{category}</span>
    </div>
  );
}

function hashHue(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 360;
}
