import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, MapPin, Users, Trophy, Wallet } from "lucide-react";
import { list as listEvents, findById as findEvent, type EventStatus } from "@/lib/db/events";
import { Badge } from "@/components/Badge";
import { CouponBox } from "@/components/CouponBox";
import { ogImageUrl } from "@/lib/site";
import { placeOrderFromForm } from "@/app/actions/order";

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
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const e = await findEvent(id);
  if (!e) notFound();

  const dateText = e.endDate
    ? `${e.startDate} ~ ${e.endDate}`
    : e.startDate;
  const soldOut = e.registered >= e.capacity;
  const errorMsg = error ? ORDER_ERROR_MSG[error] : null;

  return (
    <section className="container-page py-12">
      <Link href="/events" className="text-[13px] text-ink-3 hover:text-ink">← 返回赛事列表</Link>

      {errorMsg ? (
        <div className="mt-4 rounded-[14px] border border-brand/40 bg-brand-soft px-4 py-3 text-[13px] text-brand-dark">
          {errorMsg}
        </div>
      ) : null}

      <div className="mt-6 grid gap-10 md:grid-cols-[1.4fr_1fr] items-start">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Badge tone="brand">{e.type}</Badge>
            <Badge tone={STATUS_TONE[e.status]}>{e.status}</Badge>
          </div>
          <h1 className="text-[28px] md:text-[36px] font-semibold text-ink leading-tight">{e.title}</h1>
          <p className="mt-4 text-[15px] leading-7 text-ink-2">{e.description}</p>

          <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Info icon={CalendarDays} label="时间" value={dateText} />
            <Info icon={MapPin} label="地点" value={`${e.city} · ${e.venue}`} />
            <Info icon={Users} label="报名" value={`${e.registered}/${e.capacity}${soldOut ? " · 已满" : ""}`} />
            <Info icon={Wallet} label="费用" value={e.fee === 0 ? "免费" : `¥${e.fee}`} />
          </div>

          <h2 className="mt-12 mb-4 text-[20px] font-semibold text-ink">比赛项目</h2>
          <div className="flex flex-wrap gap-2">
            {e.events.map((ev) => (
              <span key={ev} className="inline-flex items-center gap-1 rounded-md border border-line bg-white px-3 py-1.5 text-[13px] text-ink-2">
                <Trophy size={13} className="text-brand" />{ev}
              </span>
            ))}
          </div>
        </div>

        <aside className="rounded-[14px] border border-line bg-white p-6">
          <div className="text-[13px] text-ink-3">报名费</div>
          <div className="mt-1 text-[36px] font-semibold text-brand leading-none">
            {e.fee === 0 ? "免费" : `¥${e.fee}`}
          </div>
          <div className="text-[12px] text-ink-3 mt-1">含赛事胸卡 · 现场补给 · 数据成绩册</div>
          {e.status === "报名中" && !soldOut ? (
            <div className="mt-5">
              <CouponBox
                type="event"
                refId={e.id}
                amount={e.fee}
                submitLabel="立即报名"
                action={placeOrderFromForm}
              />
            </div>
          ) : (
            <button
              type="button"
              disabled
              className="mt-5 w-full rounded-md py-2.5 text-[14px] font-medium transition bg-line-soft text-ink-3 cursor-not-allowed"
            >
              {e.status === "已结束"
                ? "已结束"
                : e.status === "即将开放"
                  ? "提醒我开放"
                  : "名额已报满"}
            </button>
          )}
          <div className="mt-5 border-t border-line pt-4 text-[12px] text-ink-3 leading-6">
            报名后可加入赛事专属社群,赛前训练赛与赛事直播全部包含。
          </div>
        </aside>
      </div>
    </section>
  );
}

function Info({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-bg-soft p-3">
      <div className="text-[12px] text-ink-3 inline-flex items-center gap-1"><Icon size={12} />{label}</div>
      <div className="mt-1 text-[14px] text-ink font-medium">{value}</div>
    </div>
  );
}
