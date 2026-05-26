import Link from "next/link";
import { notFound } from "next/navigation";
import { Star, ShoppingCart, CheckCircle2 } from "lucide-react";
import { list as listProducts, findById as findProduct } from "@/lib/db/products";
import { Badge } from "@/components/Badge";
import { CouponBox } from "@/components/CouponBox";
import { ogImageUrl } from "@/lib/site";
import { placeOrderFromForm } from "@/app/actions/order";

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
  const p = await findProduct(id);
  if (!p) notFound();

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
          <div className="mt-3 flex items-center gap-4 text-[13px] text-ink-3">
            <span className="inline-flex items-center gap-1"><Star size={14} className="text-amber-500" />{p.rating}</span>
            <span>{p.reviews} 条用户评价</span>
            {p.inStock ? (
              <span className="text-emerald-600">现货</span>
            ) : (
              <span className="text-amber-600">补货中</span>
            )}
          </div>

          <p className="mt-6 text-[15px] leading-7 text-ink-2">{p.description}</p>

          <ul className="mt-6 space-y-2">
            {p.features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-[14px] text-ink-2">
                <CheckCircle2 size={16} className="text-brand mt-0.5 shrink-0" />
                <span>{f}</span>
              </li>
            ))}
          </ul>

          <div className="mt-8 rounded-[14px] border border-line bg-white p-5">
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-[32px] font-semibold text-brand leading-none">¥{p.price}</span>
                {p.originalPrice && (
                  <span className="text-[13px] text-ink-3 line-through ml-3">¥{p.originalPrice}</span>
                )}
              </div>
            </div>
            <div className="mt-4">
              <CouponBox
                type="product"
                refId={p.id}
                amount={p.price}
                submitLabel={p.inStock ? "立即购买" : "补货中"}
                submitIcon="cart"
                disabled={!p.inStock}
                action={placeOrderFromForm}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ProductArt({ name }: { name: string }) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return (
    <div
      className="rounded-[20px] aspect-square grid place-items-center"
      style={{
        background: `linear-gradient(135deg, hsl(${hue} 70% 96%), hsl(${(hue + 30) % 360} 75% 90%))`,
      }}
    >
      <svg viewBox="0 0 100 100" className="w-1/2 h-1/2" aria-hidden>
        <g transform="translate(50 50)">
          <polygon points="0,-28 24,-14 24,14 0,28 -24,14 -24,-14" fill={`hsl(${hue} 70% 55%)`} opacity="0.18" />
          <polygon points="0,-28 24,-14 0,0 -24,-14" fill={`hsl(${hue} 70% 55%)`} />
          <polygon points="24,-14 24,14 0,28 0,0" fill={`hsl(${hue} 70% 45%)`} />
          <polygon points="-24,-14 0,0 0,28 -24,14" fill={`hsl(${hue} 75% 36%)`} />
        </g>
      </svg>
    </div>
  );
}
