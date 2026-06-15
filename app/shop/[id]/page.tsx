import Link from "next/link";
import { notFound } from "next/navigation";
import { Star, CheckCircle2, ArrowRight, PackageCheck, PackageX } from "lucide-react";
import { list as listProducts, findById as findProduct } from "@/lib/db/products";
import type { Product } from "@/lib/db/products";
import { getCurrentUser } from "@/lib/auth-user";
import { Badge } from "@/components/Badge";
import { ogImageUrl } from "@/lib/site";
import { BuyPanel } from "./_BuyPanel";

export async function generateStaticParams() {
  const all = await listProducts();
  return all.map((p) => ({ id: p.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await findProduct(id);
  if (!p) return { title: "商品详情" };
  const desc = p.description.length > 140 ? p.description.slice(0, 138) + "…" : p.description;
  const img = ogImageUrl(p.name);
  return {
    title: p.name,
    description: desc,
    openGraph: {
      title: p.name,
      description: desc,
      images: [{ url: img, width: 1200, height: 630, alt: p.name }],
    },
    twitter: {
      card: "summary_large_image" as const,
      title: p.name,
      description: desc,
      images: [img],
    },
  };
}

export default async function ProductDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [p, user, all] = await Promise.all([findProduct(id), getCurrentUser(), listProducts()]);
  if (!p) notFound();

  const discountPercent =
    p.originalPrice && p.originalPrice > p.price
      ? Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100)
      : 0;

  // 相关推荐:同分类其它商品,取前 4
  const related = all.filter((x) => x.id !== p.id && x.category === p.category).slice(0, 4);

  return (
    <section className="container-page py-12">
      <Link href="/shop" className="text-[13px] text-ink-3 hover:text-ink">← 返回商城</Link>

      <div className="mt-6 grid gap-10 md:grid-cols-[1fr_1fr] items-start">
        <ProductArt name={p.name} />

        <div>
          <div className="flex items-center gap-2 mb-3">
            <Badge tone="brand">{p.category}</Badge>
            <span className="text-[13px] text-ink-3">{p.brand}</span>
          </div>
          <h1 className="text-[26px] md:text-[32px] font-semibold text-ink leading-tight">{p.name}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-ink-3">
            <span className="inline-flex items-center gap-1">
              <Star size={14} className="text-amber-500" />
              {p.rating}
            </span>
            <span>{p.reviews} 条用户评价</span>
            {p.inStock ? (
              <span className="inline-flex items-center gap-1 text-emerald-600">
                <PackageCheck size={14} />
                现货,下单后发货
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-amber-600">
                <PackageX size={14} />
                暂时缺货,补货中
              </span>
            )}
          </div>

          <p className="mt-6 text-[15px] leading-7 text-ink-2">{p.description}</p>

          {p.features.length > 0 ? (
            <ul className="mt-6 space-y-2">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-[14px] text-ink-2">
                  <CheckCircle2 size={16} className="text-brand mt-0.5 shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-8 rounded-[14px] border border-line bg-white p-5">
            <div className="flex items-center gap-3">
              <span className="text-[32px] font-semibold text-brand leading-none">¥{p.price}</span>
              {p.originalPrice && p.originalPrice > p.price ? (
                <>
                  <span className="text-[14px] text-ink-3 line-through">¥{p.originalPrice}</span>
                  {discountPercent > 0 ? <Badge tone="danger">省 {discountPercent}%</Badge> : null}
                </>
              ) : null}
            </div>

            <div className="mt-5 border-t border-line pt-5">
              <BuyPanel
                refId={p.id}
                price={p.price}
                originalPrice={p.originalPrice ?? null}
                inStock={p.inStock}
                loggedIn={!!user}
              />
            </div>
          </div>
        </div>
      </div>

      {related.length > 0 ? (
        <div className="mt-16 border-t border-line pt-12">
          <h2 className="text-[20px] font-semibold text-ink mb-6">同类推荐</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((r) => (
              <RelatedCard key={r.id} product={r} />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function RelatedCard({ product }: { product: Product }) {
  return (
    <Link
      href={`/shop/${product.id}`}
      className="group block rounded-[14px] border border-line bg-white overflow-hidden transition hover:border-brand/40 hover:shadow-[0_8px_28px_-12px_rgba(42,93,244,0.18)]"
    >
      <ProductThumb name={product.name} />
      <div className="p-4">
        <h3 className="text-[14px] font-semibold text-ink mb-1 group-hover:text-brand transition line-clamp-2 min-h-[40px]">
          {product.name}
        </h3>
        <div className="flex items-end justify-between">
          <div>
            <span className="text-[16px] font-semibold text-brand">¥{product.price}</span>
            {product.originalPrice && product.originalPrice > product.price ? (
              <span className="text-[12px] text-ink-3 line-through ml-2">¥{product.originalPrice}</span>
            ) : null}
          </div>
          <span className="text-[12px] text-brand inline-flex items-center gap-1 group-hover:gap-2 transition-all">
            查看 <ArrowRight size={12} />
          </span>
        </div>
      </div>
    </Link>
  );
}

function hashHue(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 360;
}

function CubeGlyph({ hue }: { hue: number }) {
  return (
    <svg viewBox="0 0 100 100" className="w-1/2 h-1/2 max-w-[120px]" aria-hidden>
      <g transform="translate(50 50)">
        <polygon points="0,-28 24,-14 24,14 0,28 -24,14 -24,-14" fill={`hsl(${hue} 70% 55%)`} opacity="0.18" />
        <polygon points="0,-28 24,-14 0,0 -24,-14" fill={`hsl(${hue} 70% 55%)`} />
        <polygon points="24,-14 24,14 0,28 0,0" fill={`hsl(${hue} 70% 45%)`} />
        <polygon points="-24,-14 0,0 0,28 -24,14" fill={`hsl(${hue} 75% 36%)`} />
      </g>
    </svg>
  );
}

function ProductArt({ name }: { name: string }) {
  const hue = hashHue(name);
  return (
    <div
      className="rounded-[20px] aspect-square grid place-items-center"
      style={{
        background: `linear-gradient(135deg, hsl(${hue} 70% 96%), hsl(${(hue + 30) % 360} 75% 90%))`,
      }}
    >
      <CubeGlyph hue={hue} />
    </div>
  );
}

function ProductThumb({ name }: { name: string }) {
  const hue = hashHue(name);
  return (
    <div
      className="aspect-[4/3] grid place-items-center"
      style={{
        background: `linear-gradient(135deg, hsl(${hue} 70% 96%), hsl(${(hue + 30) % 360} 75% 92%))`,
      }}
    >
      <CubeGlyph hue={hue} />
    </div>
  );
}
