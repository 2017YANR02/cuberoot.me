import Link from "next/link";
import { LogoutButton } from "../_components/LogoutButton";

const RESOURCES = [
  { key: "courses", label: "课程" },
  { key: "products", label: "商品" },
  { key: "events", label: "赛事" },
  { key: "news", label: "资讯" },
  { key: "instructors", label: "讲师" },
  { key: "posts", label: "帖子" },
  { key: "orders", label: "订单" },
  { key: "reconcile", label: "对账与流水" },
  { key: "applications", label: "讲师申请" },
  { key: "coupons", label: "优惠券" },
  { key: "invites", label: "邀请码" },
  { key: "qr", label: "二维码" },
  { key: "events-track", label: "埋点" },
  { key: "logs", label: "日志" },
];

export default function AuthedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid md:grid-cols-[220px_1fr] min-h-[80vh]">
      <aside className="border-b md:border-b-0 md:border-r border-line bg-white md:flex md:flex-col">
        <div className="p-5">
          <Link href="/admin" className="block text-[15px] font-semibold text-ink">
            管理后台
          </Link>
          <div className="mt-1 text-[12px] text-ink-3">魔方开放社群</div>
        </div>
        <nav className="px-3 pb-4 flex md:flex-col gap-1 overflow-x-auto">
          <NavLink href="/admin" label="概览" />
          {RESOURCES.map((r) => (
            <NavLink key={r.key} href={`/admin/${r.key}`} label={r.label} />
          ))}
        </nav>
        <div className="px-3 pb-4 md:mt-auto">
          <LogoutButton />
        </div>
      </aside>
      <main className="px-5 md:px-8 py-8 bg-bg-soft">{children}</main>
    </div>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-md px-3 py-2 text-[13px] text-ink-2 hover:text-ink hover:bg-bg-soft transition whitespace-nowrap"
    >
      {label}
    </Link>
  );
}
