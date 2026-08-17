import Link from "next/link";
import { ArrowRight, PackageCheck, PackageX, Crown, Trash2 } from "lucide-react";
import { requireUser } from "@/lib/auth-user";
import { listByUser } from "@/lib/db/favorites";
import { list as listProducts, type Product } from "@/lib/db/products";
import { toggleFavoriteAction } from "@/app/actions/favorites";
import { Badge } from "@/components/Badge";

export const metadata = {
  title: "我的愿望单 — 魔方开放社群",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const NEXT_PATH = "/me/wishlist";

export default async function MyWishlistPage() {
  const user = await requireUser(NEXT_PATH);

  // 愿望单复用通用收藏:取 targetType='product' 那一组(已按 createdAt desc 排序)。
  const groups = await listByUser(user.id);
  const productGroup = groups.find((g) => g.type === "product");
  const favIds = productGroup ? productGroup.items.map((i) => i.targetId) : [];

  // listByUser 只给标题/链接,商品卡需要价格/库存/会员标等完整字段,
  // 这里一次性拿全部商品建索引,按收藏顺序映射(原对象已删的自动跳过)。
  const byId = new Map<string, Product>();
  if (favIds.length > 0) {
    for (const p of await listProducts()) byId.set(p.id, p);
  }
  const wished: Product[] = favIds
    .map((id) => byId.get(id))
    .filter((p): p is Product => p != null);

  return (
    <section className="container-page py-12">
      <h1 className="text-[24px] font-semibold text-ink">我的愿望单</h1>
      <p className="mt-1 text-[13px] text-ink-3">收藏的商品 {wished.length} 件,降价或补货时回来看看</p>

      {wished.length === 0 ? (
        <div className="mt-10 rounded-[14px] border border-dashed border-line bg-bg-soft px-6 py-12 text-center text-[14px] text-ink-3">
          愿望单还是空的。逛逛
          <Link href="/shop" className="mx-1 text-brand hover:underline">
            官方商城
          </Link>
          ,在商品页点心形收藏,心仪好物就会出现在这里。
        </div>
      ) : (
        <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {wished.map((p) => (
            <WishlistCard key={p.id} product={p} />
          ))}
        </ul>
      )}
    </section>
  );
}

function WishlistCard({ product: p }: { product: Product }) {
  const hasDiscount = p.originalPrice != null && p.originalPrice > p.price;
  const discountPercent = hasDiscount
    ? Math.round(((p.originalPrice! - p.price) / p.originalPrice!) * 100)
    : 0;
  const memberSaves = p.memberPrice != null && p.memberPrice < p.price;

  return (
    <li className="group relative flex flex-col rounded-[14px] border border-line bg-white overflow-hidden transition hover:border-brand/40 hover:shadow-[0_8px_28px_-12px_rgba(42,93,244,0.18)]">
      <Link href={`/shop/${p.id}`} className="block">
        <ProductThumb name={p.name}>
          {hasDiscount && discountPercent > 0 ? (
            <span className="absolute left-3 top-3 rounded-full bg-red-600 px-2 py-0.5 text-[12px] font-semibold text-white shadow-sm">
              省 {discountPercent}%
            </span>
          ) : null}
        </ProductThumb>
      </Link>

      <div className="flex flex-1 flex-col p-5">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge tone="brand">{p.category}</Badge>
          <span className="text-[12px] text-ink-3">{p.brand}</span>
          {p.memberOnly ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[12px] font-medium text-amber-700">
              <Crown size={12} />
              会员专享
            </span>
          ) : null}
        </div>

        <Link href={`/shop/${p.id}`} className="block">
          <h3 className="mb-2 line-clamp-2 min-h-[44px] text-[15px] font-semibold text-ink transition group-hover:text-brand">
            {p.name}
          </h3>
        </Link>

        <div className="mb-3 flex items-end gap-2">
          <span className="text-[20px] font-semibold text-brand leading-none">¥{p.price}</span>
          {hasDiscount ? (
            <span className="text-[12px] text-ink-3 line-through">¥{p.originalPrice}</span>
          ) : null}
        </div>

        {memberSaves ? (
          <div className="mb-3 inline-flex w-fit items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[12px] text-amber-700">
            <Crown size={12} />
            会员价 ¥{p.memberPrice}
          </div>
        ) : null}

        <div className="mb-4 text-[12px]">
          {p.inStock ? (
            <span className="inline-flex items-center gap-1 text-emerald-600">
              <PackageCheck size={13} />
              现货,下单即发
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-amber-600">
              <PackageX size={13} />
              暂时缺货,补货中
            </span>
          )}
        </div>

        <div className="mt-auto flex items-center gap-2">
          <Link
            href={`/shop/${p.id}`}
            className="inline-flex flex-1 items-center justify-center gap-1 rounded-md bg-brand px-3 py-2 text-[13px] font-medium text-white transition hover:bg-brand-dark"
          >
            去看看 <ArrowRight size={14} />
          </Link>
          {/* 移除复用通用收藏 toggle:当前已收藏,提交即取消 */}
          <form action={toggleFavoriteAction}>
            <input type="hidden" name="targetType" value="product" />
            <input type="hidden" name="targetId" value={p.id} />
            <input type="hidden" name="next" value={NEXT_PATH} />
            <button
              type="submit"
              title="从愿望单移除"
              aria-label="从愿望单移除"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-line bg-white text-ink-3 transition hover:border-red-300 hover:text-red-600"
            >
              <Trash2 size={15} />
            </button>
          </form>
        </div>
      </div>
    </li>
  );
}

function hashHue(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 360;
}

function ProductThumb({
  name,
  children,
}: {
  name: string;
  children?: React.ReactNode;
}) {
  const hue = hashHue(name);
  return (
    <div
      className="relative aspect-[4/3] grid place-items-center"
      style={{
        background: `linear-gradient(135deg, hsl(${hue} 70% 96%), hsl(${(hue + 30) % 360} 75% 92%))`,
      }}
    >
      <svg viewBox="0 0 100 100" className="h-20 w-20" aria-hidden>
        <g transform="translate(50 50)">
          <polygon points="0,-28 24,-14 24,14 0,28 -24,14 -24,-14" fill={`hsl(${hue} 70% 55%)`} opacity="0.18" />
          <polygon points="0,-28 24,-14 0,0 -24,-14" fill={`hsl(${hue} 70% 55%)`} />
          <polygon points="24,-14 24,14 0,28 0,0" fill={`hsl(${hue} 70% 45%)`} />
          <polygon points="-24,-14 0,0 0,28 -24,14" fill={`hsl(${hue} 75% 36%)`} />
        </g>
      </svg>
      {children}
    </div>
  );
}
