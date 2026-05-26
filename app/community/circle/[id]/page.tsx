import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Heart, MessageCircle, PenLine, Plus, Users } from "lucide-react";
import { CIRCLE_META, isCircleId, listPosts } from "@/lib/db/posts";
import { Badge } from "@/components/Badge";
import type { CircleId } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isCircleId(id)) return { title: "圈子" };
  return { title: `${CIRCLE_META[id].name} — 社群` };
}

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

export default async function CirclePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isCircleId(id)) notFound();
  const circleId = id as CircleId;
  const meta = CIRCLE_META[circleId];
  const posts = await listPosts({ circleId });

  return (
    <>
      <section className="bg-brand-tint border-b border-line">
        <div className="container-page py-12 md:py-14">
          <Link
            href="/community"
            className="inline-flex items-center gap-1 text-[13px] text-ink-3 hover:text-ink"
          >
            <ArrowLeft size={13} />
            返回社群
          </Link>
          <div className="mt-6 flex flex-wrap items-start justify-between gap-6">
            <div>
              <h1 className="text-[28px] md:text-[34px] font-semibold text-ink leading-tight">
                {meta.name}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-[13px] text-ink-3">
                <span className="inline-flex items-center gap-1">
                  <Users size={13} />
                  {meta.members.toLocaleString()} 成员
                </span>
                <span>活跃度 {meta.activity}</span>
              </div>
              <p className="mt-3 max-w-2xl text-[14px] leading-7 text-ink-2">
                {meta.desc}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-md border border-brand bg-white px-4 py-2 text-[13px] font-medium text-brand hover:bg-brand-soft transition"
              >
                <Plus size={14} />
                加入圈子
              </button>
              <Link
                href={`/community/posts/new?circle=${circleId}`}
                className="inline-flex items-center gap-1.5 rounded-md bg-brand text-white px-4 py-2 text-[13px] font-medium hover:bg-brand-dark transition"
              >
                <PenLine size={14} />
                发帖
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="container-page py-10">
        {posts.length === 0 ? (
          <div className="rounded-[14px] border border-line bg-white p-10 text-center text-[14px] text-ink-3">
            这个圈子还没有帖子,来发第一条。
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
      </section>
    </>
  );
}
