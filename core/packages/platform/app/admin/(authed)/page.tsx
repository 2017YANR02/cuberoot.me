import Link from "next/link";
import {
  Users,
  ShoppingCart,
  CheckCircle2,
  Wallet,
  BookOpen,
  Package,
  Trophy,
  MessageSquare,
  Crown,
  ArrowRight,
} from "lucide-react";
import type { ReactNode } from "react";
import { getAdminOverview, type TrendPoint } from "@/lib/db/admin-stats";

export const dynamic = "force-dynamic";

// 订单类型 → 展示标签
const ORDER_TYPE_LABEL: Record<string, string> = {
  course: "课程",
  product: "商品",
  event: "赛事",
  membership: "会员",
};

const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: "待支付",
  paid: "已支付",
  cancelled: "已取消",
  refunded: "已退款",
};

const CIRCLE_LABEL: Record<string, string> = {
  newbie: "新手村",
  speed: "竞速圈",
  blind: "盲拧圈",
  campus: "校园圈",
};

const ROLE_LABEL: Record<string, string> = {
  user: "用户",
  instructor: "讲师",
  admin: "管理员",
};

// unix 秒 → 本地「MM-DD HH:mm」,禁用 new Date("YYYY-MM-DD")(此处是数值时间戳,安全)
function fmtTime(unixSec: number): string {
  const d = new Date(unixSec * 1000);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${mm}-${dd} ${hh}:${mi}`;
}

// 日期 key「YYYY-MM-DD」→「M/D」轴标签(字符串 split,不 new Date)
function axisLabel(day: string): string {
  const parts = day.split("-");
  return parts.length === 3 ? `${Number(parts[1])}/${Number(parts[2])}` : day;
}

export default async function AdminDashboard() {
  const { kpis, trend, recentOrders, recentUsers, recentPosts } = await getAdminOverview();

  const newUsers7d = trend.reduce((s, p) => s + p.users, 0);
  const newOrders7d = trend.reduce((s, p) => s + p.orders, 0);

  const cards: KpiCardProps[] = [
    { label: "总用户", value: kpis.users, icon: <Users size={18} />, href: "/admin/orders", sub: `近 7 天 +${newUsers7d}` },
    { label: "总订单", value: kpis.orders, icon: <ShoppingCart size={18} />, href: "/admin/orders", sub: `近 7 天 +${newOrders7d}` },
    { label: "已支付订单", value: kpis.paidOrders, icon: <CheckCircle2 size={18} />, href: "/admin/orders" },
    { label: "已支付 GMV", value: `¥${kpis.gmv.toLocaleString("zh-CN")}`, icon: <Wallet size={18} />, href: "/admin/reconcile", accent: true },
    { label: "有效会员", value: kpis.members, icon: <Crown size={18} />, href: "/admin/orders" },
    { label: "课程", value: kpis.courses, icon: <BookOpen size={18} />, href: "/admin/courses" },
    { label: "商品", value: kpis.products, icon: <Package size={18} />, href: "/admin/products" },
    { label: "赛事", value: kpis.events, icon: <Trophy size={18} />, href: "/admin/events" },
    { label: "帖子", value: kpis.posts, icon: <MessageSquare size={18} />, href: "/admin/posts" },
  ];

  const quickLinks = [
    { href: "/admin/courses/new", label: "新建课程" },
    { href: "/admin/products/new", label: "新建商品" },
    { href: "/admin/events/new", label: "新建赛事" },
    { href: "/admin/news/new", label: "新建资讯" },
    { href: "/admin/applications", label: "讲师申请" },
    { href: "/admin/instructor-payouts", label: "讲师结算" },
    { href: "/admin/coupons", label: "优惠券" },
    { href: "/admin/reconcile", label: "对账与流水" },
  ];

  return (
    <div>
      <h1 className="text-[22px] font-semibold text-ink">运营数据概览</h1>
      <p className="mt-1 text-[13px] text-ink-3">站点核心指标与最近动态,点卡片进入对应管理模块。</p>

      {/* KPI 卡片网格 */}
      <div className="mt-6 grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        {cards.map((c) => (
          <KpiCard key={c.label} {...c} />
        ))}
      </div>

      {/* 近 7 天趋势 */}
      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <TrendCard title="近 7 天新增用户" color="var(--color-brand)" points={trend} pick="users" total={newUsers7d} />
        <TrendCard title="近 7 天新增订单" color="#10B981" points={trend} pick="orders" total={newOrders7d} />
      </div>

      {/* 最近活动 */}
      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <ActivityCard title="最新订单" href="/admin/orders" empty="暂无订单">
          {recentOrders.map((o) => (
            <li key={o.id} className="flex items-start justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <div className="truncate text-[13px] text-ink">{o.refTitle}</div>
                <div className="mt-0.5 text-[12px] text-ink-3">
                  {ORDER_TYPE_LABEL[o.type] ?? o.type} · {o.userNickname} · {fmtTime(o.createdAt)}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[13px] font-medium text-ink">¥{Math.max(0, o.amount - o.discount)}</div>
                <div className="mt-0.5 text-[12px] text-ink-3">{ORDER_STATUS_LABEL[o.status] ?? o.status}</div>
              </div>
            </li>
          ))}
        </ActivityCard>

        <ActivityCard title="最新注册" href="/admin/orders" empty="暂无注册">
          {recentUsers.map((u) => (
            <li key={u.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <div className="truncate text-[13px] text-ink">{u.nickname}</div>
                <div className="mt-0.5 text-[12px] text-ink-3">
                  {u.phone} · {ROLE_LABEL[u.role] ?? u.role}
                </div>
              </div>
              <div className="shrink-0 text-[12px] text-ink-3">{fmtTime(u.createdAt)}</div>
            </li>
          ))}
        </ActivityCard>

        <ActivityCard title="最新帖子" href="/admin/posts" empty="暂无帖子">
          {recentPosts.map((p) => (
            <li key={p.id} className="flex items-start justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <div className="truncate text-[13px] text-ink">{p.title}</div>
                <div className="mt-0.5 text-[12px] text-ink-3">
                  {CIRCLE_LABEL[p.circleId] ?? p.circleId} · {p.authorNickname}
                </div>
              </div>
              <div className="shrink-0 text-[12px] text-ink-3">{fmtTime(p.createdAt)}</div>
            </li>
          ))}
        </ActivityCard>
      </div>

      {/* 快捷入口 */}
      <div className="mt-8">
        <h2 className="text-[15px] font-semibold text-ink">快捷入口</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {quickLinks.map((q) => (
            <Link
              key={q.href}
              href={q.href}
              className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-3 py-2 text-[13px] text-ink-2 transition hover:text-ink hover:border-brand/40"
            >
              {q.label}
              <ArrowRight size={14} className="text-ink-3" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

type KpiCardProps = {
  label: string;
  value: number | string;
  icon: ReactNode;
  href: string;
  sub?: string;
  accent?: boolean;
};

function KpiCard({ label, value, icon, href, sub, accent }: KpiCardProps) {
  return (
    <Link
      href={href}
      className="block rounded-[14px] border border-line bg-white p-4 transition hover:border-brand/40 hover:shadow-[0_4px_16px_rgba(42,93,244,0.08)]"
    >
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-ink-3">{label}</span>
        <span
          className={
            "inline-flex h-7 w-7 items-center justify-center rounded-md " +
            (accent ? "bg-brand text-white" : "bg-brand-soft text-brand")
          }
        >
          {icon}
        </span>
      </div>
      <div className="mt-2 text-[24px] font-semibold leading-tight text-ink">{value}</div>
      {sub ? <div className="mt-1 text-[12px] text-ink-3">{sub}</div> : null}
    </Link>
  );
}

// 纯 SVG 自绘的折线 + 柱状趋势(无图表库依赖)
function TrendCard({
  title,
  color,
  points,
  pick,
  total,
}: {
  title: string;
  color: string;
  points: TrendPoint[];
  pick: "users" | "orders";
  total: number;
}) {
  const W = 320;
  const H = 96;
  const padX = 6;
  const padTop = 8;
  const padBottom = 18;
  const vals = points.map((p) => p[pick]);
  const max = Math.max(1, ...vals);
  const n = points.length;
  const innerW = W - padX * 2;
  const step = n > 1 ? innerW / (n - 1) : 0;
  const y = (v: number) => padTop + (H - padTop - padBottom) * (1 - v / max);
  const x = (i: number) => padX + step * i;

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p[pick]).toFixed(1)}`)
    .join(" ");
  const areaPath =
    n > 0
      ? `M${x(0).toFixed(1)},${(H - padBottom).toFixed(1)} ` +
        points.map((p, i) => `L${x(i).toFixed(1)},${y(p[pick]).toFixed(1)}`).join(" ") +
        ` L${x(n - 1).toFixed(1)},${(H - padBottom).toFixed(1)} Z`
      : "";

  return (
    <div className="rounded-[14px] border border-line bg-white p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[14px] font-medium text-ink">{title}</h2>
        <span className="text-[13px] font-semibold text-ink">合计 {total}</span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`${title},合计 ${total}`}
        preserveAspectRatio="none"
      >
        <path d={areaPath} fill={color} opacity={0.08} />
        <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <g key={p.day}>
            <circle cx={x(i)} cy={y(p[pick])} r={2.5} fill={color} />
            <text x={x(i)} y={H - 5} textAnchor="middle" className="fill-ink-3" fontSize={9}>
              {axisLabel(p.day)}
            </text>
            {p[pick] > 0 ? (
              <text x={x(i)} y={y(p[pick]) - 5} textAnchor="middle" className="fill-ink-2" fontSize={9}>
                {p[pick]}
              </text>
            ) : null}
          </g>
        ))}
      </svg>
    </div>
  );
}

function ActivityCard({
  title,
  href,
  empty,
  children,
}: {
  title: string;
  href: string;
  empty: string;
  children: ReactNode;
}) {
  const items = Array.isArray(children) ? children : [children];
  const isEmpty = items.flat().filter(Boolean).length === 0;
  return (
    <div className="rounded-[14px] border border-line bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-[14px] font-medium text-ink">{title}</h2>
        <Link href={href} className="text-[12px] text-brand hover:underline">
          查看全部
        </Link>
      </div>
      {isEmpty ? (
        <p className="mt-4 text-[13px] text-ink-3">{empty}</p>
      ) : (
        <ul className="mt-2 divide-y divide-line-soft">{children}</ul>
      )}
    </div>
  );
}
