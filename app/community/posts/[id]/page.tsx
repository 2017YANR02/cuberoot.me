import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Heart, MessageCircle } from "lucide-react";
import {
  CIRCLE_META,
  findPostById,
  isLikedByUser,
  listComments,
} from "@/lib/db/posts";
import { getCurrentUser } from "@/lib/auth-user";
import { Badge } from "@/components/Badge";
import { Markdown } from "@/components/Markdown";
import { TrackOnce } from "@/components/TrackOnce";
import { ogImageUrl } from "@/lib/site";
import { submitComment, togglePostLike } from "@/app/actions/community";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const p = await findPostById(id);
  if (!p) return { title: "帖子详情" };
  const plain = p.body.replace(/[#>*_`\-]+/g, " ").replace(/\s+/g, " ").trim();
  const desc = plain.length > 140 ? plain.slice(0, 138) + "…" : plain;
  const img = ogImageUrl(p.title);
  return {
    title: p.title,
    description: desc,
    openGraph: {
      type: "article" as const,
      title: p.title,
      description: desc,
      images: [{ url: img, width: 1200, height: 630, alt: p.title }],
    },
    twitter: {
      card: "summary_large_image" as const,
      title: p.title,
      description: desc,
      images: [img],
    },
  };
}

function formatTime(ts: number): string {
  const d = new Date(ts * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default async function PostDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const post = await findPostById(id);
  if (!post) notFound();
  const [comments, currentUser] = await Promise.all([
    listComments(id),
    getCurrentUser(),
  ]);
  const liked = currentUser
    ? await isLikedByUser(id, currentUser.id)
    : false;

  const justCreated = currentUser && currentUser.id === post.authorId
    ? Math.floor(Date.now() / 1000) - post.createdAt < 30
    : false;

  return (
    <article className="container-page py-12 md:py-16 max-w-3xl">
      {justCreated ? (
        <TrackOnce
          name="post_created"
          dedupeKey={post.id}
          payload={{ postId: post.id, circleId: post.circleId }}
        />
      ) : null}
      <Link
        href={`/community/circle/${post.circleId}`}
        className="inline-flex items-center gap-1 text-[13px] text-ink-3 hover:text-ink"
      >
        <ArrowLeft size={13} />
        返回 {CIRCLE_META[post.circleId].name}
      </Link>

      <header className="mt-6 mb-6 border-b border-line pb-6">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <Badge tone="brand">{CIRCLE_META[post.circleId].name}</Badge>
          <span className="text-[12px] text-ink-3">{formatTime(post.createdAt)}</span>
        </div>
        <h1 className="text-[24px] md:text-[30px] font-semibold text-ink leading-tight">
          {post.title}
        </h1>
        <div className="mt-4 flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-brand-soft text-[13px] font-medium text-brand-dark">
            {post.authorNickname.slice(0, 1)}
          </div>
          <div className="text-[13px] text-ink-2">{post.authorNickname}</div>
        </div>
      </header>

      <div className="mb-8">
        <Markdown source={post.body} />
      </div>

      <div className="mb-10 flex items-center gap-3 border-y border-line py-4">
        <form action={togglePostLike}>
          <input type="hidden" name="postId" value={post.id} />
          <button
            type="submit"
            className={
              "inline-flex items-center gap-1.5 rounded-md border px-4 py-2 text-[13px] transition " +
              (liked
                ? "border-brand bg-brand-soft text-brand-dark"
                : "border-line bg-white text-ink-2 hover:border-brand/40 hover:text-brand")
            }
          >
            <Heart size={14} className={liked ? "fill-current" : ""} />
            {liked ? "已点赞" : "点赞"}
            <span className="ml-1 text-ink-3">{post.likes}</span>
          </button>
        </form>
        <div className="text-[13px] text-ink-3 inline-flex items-center gap-1.5">
          <MessageCircle size={14} />
          {comments.length} 条评论
        </div>
      </div>

      <section>
        <h2 className="text-[18px] font-semibold text-ink mb-4">评论</h2>

        {comments.length === 0 ? (
          <div className="rounded-[14px] border border-line bg-white p-8 text-center text-[13px] text-ink-3">
            还没有评论,来第一条。
          </div>
        ) : (
          <ul className="space-y-3">
            {comments.map((c) => (
              <li
                key={c.id}
                className="rounded-[14px] border border-line bg-white p-5"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="grid h-7 w-7 place-items-center rounded-full bg-brand-soft text-[12px] font-medium text-brand-dark">
                    {c.authorNickname.slice(0, 1)}
                  </div>
                  <span className="text-[13px] text-ink">{c.authorNickname}</span>
                  <span className="text-[12px] text-ink-3">
                    {formatTime(c.createdAt)}
                  </span>
                </div>
                <p className="text-[14px] leading-7 text-ink-2 whitespace-pre-wrap">
                  {c.body}
                </p>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6">
          {currentUser ? (
            <form action={submitComment} className="space-y-3">
              <input type="hidden" name="postId" value={post.id} />
              <textarea
                name="body"
                required
                rows={4}
                placeholder="说点什么……"
                className="w-full rounded-md border border-line bg-white px-3 py-2 text-[14px] outline-none focus:border-brand transition"
              />
              <button
                type="submit"
                className="rounded-md bg-brand text-white px-5 py-2 text-[14px] font-medium hover:bg-brand-dark transition"
              >
                发表评论
              </button>
            </form>
          ) : (
            <div className="rounded-[14px] border border-line bg-bg-soft p-5 text-[13px] text-ink-3">
              <Link
                href={`/login?next=${encodeURIComponent(`/community/posts/${post.id}`)}`}
                className="text-brand hover:text-brand-dark underline underline-offset-2"
              >
                登录
              </Link>{" "}
              后参与评论与点赞。
            </div>
          )}
        </div>
      </section>
    </article>
  );
}
