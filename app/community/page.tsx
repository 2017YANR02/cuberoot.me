import Link from "next/link";
import { MessageSquare, Users, Trophy, Sparkles, ArrowRight, Heart, MessageCircle, PenLine } from "lucide-react";
import { Section } from "@/components/Section";
import { Badge } from "@/components/Badge";
import { CIRCLE_META, listPosts } from "@/lib/db/posts";
import type { CircleId } from "@/db/schema";

export const metadata = { title: "社群 — 魔方开放社群" };
export const dynamic = "force-dynamic";

const CIRCLE_ICONS: Record<CircleId, typeof Sparkles> = {
  newbie: Sparkles,
  speed: Trophy,
  blind: MessageSquare,
  campus: Users,
};

const CIRCLE_ORDER: CircleId[] = ["newbie", "speed", "blind", "campus"];

function formatTime(ts: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - ts;
  if (diff < 60) return "刚刚";
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} 天前`;
  const d = new Date(ts * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function CommunityPage() {
  const posts = await listPosts({ limit: 10 });

  return (
    <>
      <Section
        eyebrow="社群板块"
        title="汇聚全国魔方爱好者的开放式社群"
        subtitle="按兴趣、阶段、城市自由加入圈子,在线答疑、社群打卡、月度交流局,让学习不再孤独。"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CIRCLE_ORDER.map((id) => {
            const c = CIRCLE_META[id];
            const Icon = CIRCLE_ICONS[id];
            return (
              <Link
                key={id}
                href={`/community/circle/${id}`}
                className="group block rounded-[14px] border border-line bg-white p-6 transition hover:border-brand/40"
              >
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-md bg-brand-soft text-brand">
                  <Icon size={18} />
                </div>
                <div className="text-[15px] font-semibold text-ink mb-1 group-hover:text-brand transition">
                  {c.name}
                </div>
                <div className="text-[12px] text-ink-3 mb-3">
                  <Users size={11} className="inline -mt-0.5 mr-1" />
                  {c.members.toLocaleString()} 成员 · 活跃度 {c.activity}
                </div>
                <p className="text-[13px] leading-6 text-ink-3">{c.desc}</p>
              </Link>
            );
          })}
        </div>
      </Section>

      <Section tone="soft" eyebrow="社群热帖" title="最新讨论与高活跃话题">
        <div className="mb-5 flex justify-end">
          <Link
            href="/community/posts/new"
            className="inline-flex items-center gap-1.5 rounded-md bg-brand text-white px-4 py-2 text-[13px] font-medium hover:bg-brand-dark transition"
          >
            <PenLine size={14} />
            发帖
          </Link>
        </div>
        {posts.length === 0 ? (
          <div className="rounded-[14px] border border-line bg-white p-10 text-center text-[14px] text-ink-3">
            还没有帖子,来抢沙发。
          </div>
        ) : (
          <div className="rounded-[14px] border border-line bg-white divide-y divide-line overflow-hidden">
            {posts.map((p) => (
              <Link
                key={p.id}
                href={`/community/posts/${p.id}`}
                className="group flex items-center justify-between gap-6 px-6 py-4 hover:bg-bg-soft transition"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] text-ink truncate group-hover:text-brand transition">
                    {p.title}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-ink-3">
                    <Badge tone="muted">{p.authorNickname}</Badge>
                    <span>{CIRCLE_META[p.circleId].name}</span>
                    <span>·</span>
                    <span>{formatTime(p.createdAt)}</span>
                  </div>
                </div>
                <div className="text-[12px] text-ink-3 shrink-0 flex items-center gap-4">
                  <span className="inline-flex items-center gap-1">
                    <MessageCircle size={12} />
                    {p.commentCount}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Heart size={12} />
                    {p.likes}
                  </span>
                  <ArrowRight
                    size={14}
                    className="opacity-0 group-hover:opacity-100 transition"
                  />
                </div>
              </Link>
            ))}
          </div>
        )}
      </Section>
    </>
  );
}
