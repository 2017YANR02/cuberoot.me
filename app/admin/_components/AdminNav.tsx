"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { LogoutButton } from "./LogoutButton";

const NAV = [
  { href: "/admin", label: "概览" },
  { href: "/admin/courses", label: "课程" },
  { href: "/admin/products", label: "商品" },
  { href: "/admin/events", label: "赛事" },
  { href: "/admin/news", label: "资讯" },
  { href: "/admin/instructors", label: "讲师" },
  { href: "/admin/posts", label: "帖子" },
  { href: "/admin/orders", label: "订单" },
  { href: "/admin/reconcile", label: "对账与流水" },
  { href: "/admin/instructor-payouts", label: "讲师结算" },
  { href: "/admin/applications", label: "讲师申请" },
  { href: "/admin/coupons", label: "优惠券" },
  { href: "/admin/invites", label: "邀请码" },
  { href: "/admin/qr", label: "二维码" },
  { href: "/admin/events-track", label: "埋点" },
  { href: "/admin/logs", label: "日志" },
];

export function AdminNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/admin"
      ? pathname === "/admin"
      : pathname === href || pathname.startsWith(href + "/");

  return (
    <>
      <div className="flex items-center justify-between gap-3 p-5 md:pb-3">
        <Link href="/admin" onClick={() => setOpen(false)} className="min-w-0">
          <span className="block text-[15px] font-semibold text-ink">管理后台</span>
          <span className="mt-1 block text-[12px] text-ink-3">魔方开放社群</span>
        </Link>
        <button
          type="button"
          aria-label={open ? "收起菜单" : "展开菜单"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="md:hidden inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-line text-ink-2 hover:text-ink hover:border-brand/40 transition"
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      <nav
        className={
          (open ? "grid grid-cols-2 " : "hidden ") +
          "gap-1 px-3 pb-2 md:flex md:flex-col md:gap-1 md:pb-4"
        }
      >
        {NAV.map((n) => {
          const active = isActive(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              onClick={() => setOpen(false)}
              aria-current={active ? "page" : undefined}
              className={
                "rounded-md px-3 py-2 text-[13px] transition whitespace-nowrap " +
                (active
                  ? "bg-brand-soft text-brand-dark font-medium"
                  : "text-ink-2 hover:text-ink hover:bg-bg-soft")
              }
            >
              {n.label}
            </Link>
          );
        })}
      </nav>

      <div className={(open ? "block " : "hidden ") + "px-3 pb-4 md:block md:mt-auto"}>
        <LogoutButton />
      </div>
    </>
  );
}
