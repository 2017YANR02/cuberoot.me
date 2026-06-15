import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, MapPin, Users, Trophy, Wallet } from "lucide-react";
import { list as listEvents, findById as findEvent, type EventStatus } from "@/lib/db/events";
import { getCurrentUser } from "@/lib/auth-user";
import { isFavorited } from "@/lib/db/favorites";
import { Badge } from "@/components/Badge";
import { FavoriteButton } from "@/components/FavoriteButton";
import { ogImageUrl } from "@/lib/site";
import { loadErrorNotice } from "@/lib/search-params";
import type { SearchParams } from "nuqs/server";
import { RegisterPanel } from "./_RegisterPanel";

const STATUS_TONE: Record<EventStatus, "success" | "warning" | "muted"> = {
  报名中: "success",
  即将开放: "warning",
  已结束: "muted",
};

export async function generateStaticParams() {
  const all = await listEvents();
  return all.map((e) => ({ id: e.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const e = await findEvent(id);
  if (!e) return { title: "赛事详情" };
  const desc = e.description.length > 140 ? e.description.slice(0, 138) + "…" : e.description;
  const img = ogImageUrl(e.title);
  return {
    title: e.title,
    description: desc,
    openGraph: {
      title: e.title,
      description: desc,
      images: [{ url: img, width: 1200, height: 630, alt: e.title }],
    },
    twitter: {
      card: "summary_large_image" as const,
      title: e.title,
      description: desc,
      images: [img],
    },
  };
}

const ORDER_ERROR_MSG: Record<string, string> = {
  event_sold_out: "名额已报满,暂时无法报名。",
  event_closed: "该赛事报名已结束。",
  event_not_found: "赛事不存在或已下架。",
};

export default async function EventDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { id } = await params;
  const [{ error }, e, user] = await Promise.all([
    loadErrorNotice(searchParams),
    findEvent(id),
    getCurrentUser(),
  ]);
  if (!e) notFound();

  const favorited = user ? await isFavorited(user.id, "event", e.id) : false;

  // 日期用字符串展示,禁 new Date("YYYY-MM-DD")(SSR 时区偏一天)
  const dateText = e.endDate ? `${e.startDate} ~ ${e.endDate}` : e.startDate;
  const soldOut = e.registered >= e.capacity;
  const errorMsg = error ? ORDER_ERROR_MSG[error] : null;

  return (
    <section className="container-page py-12">
      <Link href="/events" className="text-[13px] text-ink-3 hover:text-ink">
        ← 返回赛事列表
      </Link>

      {errorMsg ? (
        <div className="mt-4 rounded-[14px] border border-brand/40 bg-brand-soft px-4 py-3 text-[13px] text-brand-dark">
          {errorMsg}
        </div>
      ) : null}

      <div className="mt-6 grid items-start gap-10 md:grid-cols-[1.4fr_1fr]">
        <div>
          <div className="mb-4 flex items-center gap-2">
            <Badge tone="brand">{e.type}</Badge>
            <Badge tone={STATUS_TONE[e.status]}>{e.status}</Badge>
          </div>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h1 className="text-[28px] font-semibold leading-tight text-ink md:text-[36px]">{e.title}</h1>
            <FavoriteButton
              targetType="event"
              targetId={e.id}
              initial={favorited}
              loggedIn={!!user}
              next={`/events/${e.id}`}
            />
          </div>
          <p className="mt-4 text-[15px] leading-7 text-ink-2">{e.description}</p>

          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Info icon={CalendarDays} label="时间" value={dateText} />
            <Info icon={MapPin} label="地点" value={`${e.city} · ${e.venue}`} />
            <Info
              icon={Users}
              label="报名"
              value={`${e.registered}/${e.capacity}${soldOut ? " 已满" : ""}`}
            />
            <Info icon={Wallet} label="费用" value={e.fee === 0 ? "免费" : `¥${e.fee}`} />
          </div>

          <h2 className="mt-12 mb-4 text-[20px] font-semibold text-ink">比赛项目</h2>
          <div className="flex flex-wrap gap-2">
            {e.events.map((ev) => (
              <span
                key={ev}
                className="inline-flex items-center gap-1 rounded-md border border-line bg-white px-3 py-1.5 text-[13px] text-ink-2"
              >
                <Trophy size={13} className="text-brand" />
                {ev}
              </span>
            ))}
          </div>
        </div>

        <RegisterPanel
          eventId={e.id}
          fee={e.fee}
          registered={e.registered}
          capacity={e.capacity}
          open={e.status === "报名中"}
          ended={e.status === "已结束"}
          isLoggedIn={!!user}
          loginNext={`/events/${e.id}`}
        />
      </div>
    </section>
  );
}

function Info({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-bg-soft p-3">
      <div className="inline-flex items-center gap-1 text-[12px] text-ink-3">
        <Icon size={12} />
        {label}
      </div>
      <div className="mt-1 text-[14px] font-medium text-ink">{value}</div>
    </div>
  );
}
