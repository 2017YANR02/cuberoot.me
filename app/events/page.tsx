import Link from "next/link";
import { CalendarDays, MapPin, Users, ArrowRight } from "lucide-react";
import { listPaged, type EventStatus } from "@/lib/db/events";
import { Section } from "@/components/Section";
import { Badge } from "@/components/Badge";
import { Pagination } from "@/components/Pagination";
import { ListSearch } from "@/components/ListSearch";

export const metadata = { title: "赛事 — 魔方开放社群" };
export const dynamic = "force-dynamic";

const STATUS_TONE: Record<EventStatus, "success" | "warning" | "muted"> = {
  报名中: "success",
  即将开放: "warning",
  已结束: "muted",
};

type SP = Promise<{ q?: string; page?: string }>;

export default async function EventsPage({ searchParams }: { searchParams: SP }) {
  const { q, page } = await searchParams;
  const pageNum = Math.max(1, Number(page) || 1);
  const result = await listPaged({ q, page: pageNum, pageSize: 12 });

  return (
    <Section
      eyebrow="赛事运营"
      title="发布、承办、运营 · 全国魔方赛事一站式入口"
      subtitle="平台承接 WCA 官方赛、城市开放赛、线上挑战赛、社群交流赛全链路服务,从策划到执行全包。"
    >
      <ListSearch basePath="/events" placeholder="搜索赛事、城市、场馆..." />

      {q && (
        <div className="mb-6 text-[13px] text-ink-3">
          “{q}” 共找到 <span className="text-ink-2">{result.total}</span> 场赛事
        </div>
      )}

      {result.items.length === 0 ? (
        <div className="rounded-[14px] border border-line bg-white p-10 text-center text-[14px] text-ink-3">
          {q ? `没有找到与 “${q}” 相关的赛事` : "暂无赛事"}
        </div>
      ) : (
        <div className="grid gap-5">
          {result.items.map((e) => {
            const ratio = Math.min(1, e.registered / e.capacity);
            return (
              <Link
                key={e.id}
                href={`/events/${e.id}`}
                className="group block rounded-[14px] border border-line bg-white p-6 transition hover:border-brand/40 hover:shadow-[0_8px_28px_-12px_rgba(42,93,244,0.18)]"
              >
                <div className="flex flex-wrap items-start gap-4 md:gap-8">
                  <DateBlock date={e.startDate} />

                  <div className="flex-1 min-w-[200px]">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <Badge tone="brand">{e.type}</Badge>
                      <Badge tone={STATUS_TONE[e.status]}>{e.status}</Badge>
                    </div>
                    <h3 className="text-[17px] font-semibold text-ink group-hover:text-brand transition">{e.title}</h3>
                    <div className="mt-2 flex flex-wrap gap-4 text-[13px] text-ink-3">
                      <span className="inline-flex items-center gap-1"><MapPin size={13} />{e.city} · {e.venue}</span>
                      <span className="inline-flex items-center gap-1"><Users size={13} />{e.registered}/{e.capacity}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {e.events.map((ev) => (
                        <span key={ev} className="text-[11px] rounded-md bg-bg-soft px-2 py-0.5 text-ink-3">{ev}</span>
                      ))}
                    </div>
                  </div>

                  <div className="md:w-48 w-full">
                    <div className="text-[13px] text-ink-3 mb-1.5">报名进度</div>
                    <div className="h-2 rounded-full bg-line-soft overflow-hidden">
                      <div className="h-full bg-brand" style={{ width: `${ratio * 100}%` }} />
                    </div>
                    <div className="mt-3 flex items-baseline justify-between">
                      <span className="text-[13px] text-ink-3">{e.fee === 0 ? "免费参赛" : `¥${e.fee}`}</span>
                      <span className="text-[13px] text-brand inline-flex items-center gap-1 group-hover:gap-2 transition-all">
                        查看 <ArrowRight size={13} />
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        basePath="/events"
        params={{ q }}
      />
    </Section>
  );
}

function DateBlock({ date }: { date: string }) {
  const [year, month, day] = date.split("-");
  return (
    <div className="rounded-md border border-line bg-bg-soft px-4 py-3 text-center w-[72px]">
      <div className="text-[11px] text-ink-3 inline-flex items-center gap-1 justify-center"><CalendarDays size={11} />{year}</div>
      <div className="text-[20px] font-semibold text-brand leading-none mt-1">{month}/{day}</div>
    </div>
  );
}
