import Link from "next/link";
import { ArrowRight, Heart } from "lucide-react";
import { requireUser } from "@/lib/auth-user";
import { listByUser } from "@/lib/db/favorites";

export const metadata = {
  title: "我的收藏 — 魔方开放社群",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function MyFavoritesPage() {
  const user = await requireUser("/me/favorites");
  const groups = await listByUser(user.id);
  const total = groups.reduce((sum, g) => sum + g.items.length, 0);
  const nonEmpty = groups.filter((g) => g.items.length > 0);

  return (
    <section className="container-page py-12">
      <h1 className="text-[24px] font-semibold text-ink">我的收藏</h1>
      <p className="mt-1 text-[13px] text-ink-3">共 {total} 项收藏</p>

      {total === 0 ? (
        <div className="mt-10 rounded-[14px] border border-dashed border-line bg-bg-soft px-6 py-12 text-center text-[14px] text-ink-3">
          还没有收藏任何内容。逛逛
          <Link href="/courses" className="text-brand hover:underline mx-1">
            课程
          </Link>
          、
          <Link href="/shop" className="text-brand hover:underline mx-1">
            商城
          </Link>
          或
          <Link href="/community" className="text-brand hover:underline mx-1">
            社群
          </Link>
          ,点心形即可收藏。
        </div>
      ) : (
        <div className="mt-8 space-y-10">
          {nonEmpty.map((g) => (
            <div key={g.type}>
              <h2 className="mb-4 flex items-baseline gap-2 text-[16px] font-semibold text-ink">
                {g.label}
                <span className="text-[13px] font-normal text-ink-3">
                  {g.items.length}
                </span>
              </h2>
              <ul className="grid gap-3">
                {g.items.map((item) => (
                  <li key={item.favoriteId}>
                    <Link
                      href={item.href}
                      className="group flex items-center gap-3 rounded-[14px] border border-line bg-white px-4 py-3 transition hover:border-brand/40 hover:shadow-[0_8px_28px_-12px_rgba(42,93,244,0.18)]"
                    >
                      <Heart
                        size={15}
                        className="shrink-0 fill-current text-brand"
                      />
                      <span className="flex-1 text-[14px] text-ink line-clamp-1 transition group-hover:text-brand">
                        {item.title}
                      </span>
                      <ArrowRight
                        size={14}
                        className="shrink-0 text-ink-3 transition group-hover:text-brand"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
