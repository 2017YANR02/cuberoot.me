"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Menu, X, ChevronDown } from "lucide-react";
import { HeaderSearch } from "./HeaderSearch";
import { NotificationBell } from "./NotificationBell";

// lg = 仅大屏(lg+)显示,中屏(md)收起,避免导航项过多在窄桌面挤压
type NavItem = { href: string; label: string; lg?: boolean };
const NAV: NavItem[] = [
  { href: "/courses", label: "课程" },
  { href: "/membership", label: "会员" },
  { href: "/shop", label: "商城" },
  { href: "/events", label: "赛事" },
  { href: "/community", label: "社群" },
  { href: "/timer", label: "计时器" },
  { href: "/news", label: "资讯", lg: true },
  { href: "/instructors", label: "讲师", lg: true },
  { href: "/about", label: "关于", lg: true },
];

// 魔方工具/玩法收进「工具」下拉,避免主导航过长
const TOOLS: { href: string; label: string }[] = [
  { href: "/algorithms", label: "算法库" },
  { href: "/paths", label: "学习路径" },
  { href: "/leaderboard", label: "排行榜" },
];

export type HeaderUser = {
  id: string;
  nickname: string;
  role: "user" | "instructor" | "admin";
};

export function SiteHeader({
  user,
  notifCount = 0,
}: {
  user: HeaderUser | null;
  notifCount?: number;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/85 backdrop-blur">
      <div className="container-page flex h-16 items-center gap-8">
        <Link href="/" className="flex items-center gap-2 font-semibold text-ink" onClick={() => setOpen(false)}>
          <Logo />
          <span className="text-[15px]">魔方开放社群</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1 text-[14px]">
          {NAV.map((n) => {
            const active = pathname === n.href || pathname.startsWith(n.href + "/");
            return (
              <Link
                key={n.href}
                href={n.href}
                className={
                  "rounded-md px-3 py-1.5 transition " +
                  (n.lg ? "hidden lg:inline-flex " : "") +
                  (active
                    ? "bg-brand-soft text-brand-dark"
                    : "text-ink-2 hover:text-ink hover:bg-bg-soft")
                }
              >
                {n.label}
              </Link>
            );
          })}
          <ToolsMenu pathname={pathname} />
        </nav>

        <div className="ml-auto hidden md:flex items-center gap-2">
          <HeaderSearch variant="desktop" />
          <Link
            href="/instructors/apply"
            className="rounded-md px-3 py-1.5 text-[14px] text-ink-2 hover:text-ink"
          >
            讲师入驻
          </Link>
          {user ? (
            <>
              <NotificationBell count={notifCount} />
              <UserMenu user={user} />
            </>
          ) : (
            <>
              <Link
                href={`/login?next=${encodeURIComponent(pathname || "/")}`}
                className="rounded-md px-3 py-1.5 text-[14px] text-ink-2 hover:text-ink"
              >
                登录
              </Link>
              <Link
                href="/courses"
                className="rounded-md bg-brand px-4 py-1.5 text-[14px] text-white hover:bg-brand-dark transition"
              >
                开始学习
              </Link>
            </>
          )}
        </div>

        <button
          aria-label={open ? "关闭菜单" : "打开菜单"}
          className="ml-auto md:hidden rounded-md p-2 text-ink-2 hover:bg-bg-soft"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-line bg-white">
          <div className="container-page py-3 flex flex-col">
            {NAV.map((n) => {
              const active = pathname === n.href || pathname.startsWith(n.href + "/");
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  onClick={() => setOpen(false)}
                  className={
                    "rounded-md px-3 py-2 text-[15px] " +
                    (active ? "text-brand-dark" : "text-ink-2")
                  }
                >
                  {n.label}
                </Link>
              );
            })}
            <div className="mt-1 px-3 pt-2 text-[12px] text-ink-3">工具</div>
            {TOOLS.map((t) => {
              const active = pathname === t.href || pathname.startsWith(t.href + "/");
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  onClick={() => setOpen(false)}
                  className={
                    "rounded-md px-3 py-2 text-[15px] " +
                    (active ? "text-brand-dark" : "text-ink-2")
                  }
                >
                  {t.label}
                </Link>
              );
            })}
            <div className="mt-2 flex gap-2">
              <Link
                href="/instructors/apply"
                onClick={() => setOpen(false)}
                className="flex-1 rounded-md border border-line px-3 py-2 text-center text-[14px] text-ink-2"
              >
                讲师入驻
              </Link>
              {user ? (
                <Link
                  href="/orders"
                  onClick={() => setOpen(false)}
                  className="flex-1 rounded-md bg-brand px-3 py-2 text-center text-[14px] text-white"
                >
                  我的订单
                </Link>
              ) : (
                <Link
                  href={`/login?next=${encodeURIComponent(pathname || "/")}`}
                  onClick={() => setOpen(false)}
                  className="flex-1 rounded-md bg-brand px-3 py-2 text-center text-[14px] text-white"
                >
                  登录
                </Link>
              )}
            </div>
            {user ? (
              <Link
                href="/notifications"
                onClick={() => setOpen(false)}
                className="mt-2 flex items-center justify-between rounded-md border border-line px-3 py-2 text-[14px] text-ink-2"
              >
                <span>通知</span>
                {notifCount > 0 ? (
                  <span className="inline-flex min-w-[18px] items-center justify-center rounded-full bg-brand px-1 text-[11px] font-semibold leading-[18px] text-white">
                    {notifCount > 99 ? "99+" : notifCount}
                  </span>
                ) : null}
              </Link>
            ) : null}
            {user ? (
              <div className="mt-2 flex items-center justify-between rounded-md border border-line px-3 py-2 text-[13px] text-ink-2">
                <span>{user.nickname}</span>
                <MobileLogout onDone={() => setOpen(false)} />
              </div>
            ) : null}
            <HeaderSearch variant="mobile" onSubmit={() => setOpen(false)} />
          </div>
        </div>
      )}
    </header>
  );
}

function ToolsMenu({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const active = TOOLS.some(
    (t) => pathname === t.href || pathname.startsWith(t.href + "/"),
  );

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={
          "inline-flex items-center gap-1 rounded-md px-3 py-1.5 transition " +
          (active
            ? "bg-brand-soft text-brand-dark"
            : "text-ink-2 hover:text-ink hover:bg-bg-soft")
        }
      >
        工具
        <ChevronDown size={14} className="text-ink-3" />
      </button>
      {open ? (
        <div className="absolute left-0 mt-1 w-40 rounded-md border border-line bg-white shadow-card overflow-hidden z-40">
          {TOOLS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-[13px] text-ink-2 hover:bg-bg-soft hover:text-ink"
            >
              {t.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function UserMenu({ user }: { user: HeaderUser }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  async function logout() {
    // allow-button-nav: POST /api/auth/logout 后程序化跳首页(post-mutation 动作),非站内链接跳转
    await fetch("/api/auth/logout", { method: "POST" });
    setOpen(false);
    router.refresh();
    router.push("/");
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[14px] text-ink-2 hover:text-ink hover:bg-bg-soft transition"
      >
        <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-soft text-[11px] font-medium text-brand-dark">
          {user.nickname.slice(0, 1)}
        </span>
        <span className="max-w-[8em] truncate">{user.nickname}</span>
        <ChevronDown size={14} className="text-ink-3" />
      </button>
      {open ? (
        <div className="absolute right-0 mt-1 w-44 rounded-md border border-line bg-white shadow-card overflow-hidden z-40">
          <Link
            href="/me"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-[13px] text-ink-2 hover:bg-bg-soft hover:text-ink"
          >
            个人中心
          </Link>
          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-[13px] text-ink-2 hover:bg-bg-soft hover:text-ink"
          >
            通知
          </Link>
          <Link
            href="/me/courses"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-[13px] text-ink-2 hover:bg-bg-soft hover:text-ink"
          >
            我的课程
          </Link>
          <Link
            href="/me/badges"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-[13px] text-ink-2 hover:bg-bg-soft hover:text-ink"
          >
            我的徽章
          </Link>
          <Link
            href="/me/notes"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-[13px] text-ink-2 hover:bg-bg-soft hover:text-ink"
          >
            我的笔记
          </Link>
          <Link
            href="/me/favorites"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-[13px] text-ink-2 hover:bg-bg-soft hover:text-ink"
          >
            我的收藏
          </Link>
          <Link
            href="/orders"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-[13px] text-ink-2 hover:bg-bg-soft hover:text-ink"
          >
            我的订单
          </Link>
          <Link
            href="/me/membership"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-[13px] text-ink-2 hover:bg-bg-soft hover:text-ink"
          >
            我的会员
          </Link>
          <Link
            href="/me/invite"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-[13px] text-ink-2 hover:bg-bg-soft hover:text-ink"
          >
            我的邀请码
          </Link>
          {user.role === "instructor" ? (
            <Link
              href="/instructor"
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-[13px] text-brand-dark hover:bg-bg-soft"
            >
              讲师后台
            </Link>
          ) : (
            <Link
              href="/instructors/apply"
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-[13px] text-ink-2 hover:bg-bg-soft hover:text-ink"
            >
              申请成为讲师
            </Link>
          )}
          <button
            type="button"
            onClick={logout}
            className="block w-full text-left px-3 py-2 text-[13px] text-ink-2 hover:bg-bg-soft hover:text-ink border-t border-line"
          >
            退出登录
          </button>
        </div>
      ) : null}
    </div>
  );
}

function MobileLogout({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        // allow-button-nav: POST /api/auth/logout 后程序化跳首页(post-mutation 动作),非链接跳转
        await fetch("/api/auth/logout", { method: "POST" });
        onDone();
        router.refresh();
        router.push("/");
      }}
      className="text-ink-3 hover:text-ink"
    >
      退出
    </button>
  );
}

function Logo() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="2" y="2" width="9" height="9" rx="1.5" fill="#2A5DF4" />
      <rect x="13" y="2" width="9" height="9" rx="1.5" fill="#2A5DF4" opacity="0.35" />
      <rect x="2" y="13" width="9" height="9" rx="1.5" fill="#2A5DF4" opacity="0.35" />
      <rect x="13" y="13" width="9" height="9" rx="1.5" fill="#2A5DF4" />
    </svg>
  );
}
