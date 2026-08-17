import Link from "next/link";
import { getCurrentUser } from "@/lib/auth-user";
import { canAccessCourse, findById as findCourse } from "@/lib/db/courses";
import {
  listByCourse,
  ratingSummary,
  userReview,
  countByCourse,
} from "@/lib/db/course-reviews";
import { StarRating } from "@/components/StarRating";
import { ReviewForm } from "@/components/ReviewForm";
import { InstructorAvatar } from "@/components/InstructorAvatar";

function formatDate(ts: number): string {
  const d = new Date(ts * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  // 用本地时间各字段拼,避免 new Date("YYYY-MM-DD") 时区偏移
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// 课程详情底部评价区块:评分汇总 + 分布条 + 评论列表 + 我的评价表单。
// 全部 server 读取,表单交互部分委托给 client 的 ReviewForm。
export async function CourseReviews({ courseId }: { courseId: string }) {
  const [summary, reviews, total, course, user] = await Promise.all([
    ratingSummary(courseId),
    listByCourse(courseId, { limit: 20 }),
    countByCourse(courseId),
    findCourse(courseId),
    getCurrentUser(),
  ]);

  if (!course) return null;

  const access = await canAccessCourse(user, course);
  const mine = user ? await userReview(user.id, courseId) : undefined;
  const canReview = access.allowed;

  return (
    <section id="reviews" className="mt-14 border-t border-line pt-12 scroll-mt-20">
      <h2 className="text-[20px] font-semibold text-ink mb-6">学员评价</h2>

      <div className="grid gap-8 md:grid-cols-[auto_1fr] md:items-center">
        <div className="text-center md:pr-8 md:border-r md:border-line">
          <div className="text-[44px] font-semibold leading-none text-ink">
            {summary.count > 0 ? summary.avg.toFixed(1) : "—"}
          </div>
          <div className="mt-2 flex justify-center">
            <StarRating value={summary.avg} size={16} />
          </div>
          <div className="mt-1.5 text-[12px] text-ink-3">
            {summary.count > 0 ? `${summary.count} 条评价` : "暂无评价"}
          </div>
        </div>

        <div className="space-y-1.5">
          {([5, 4, 3, 2, 1] as const).map((star) => {
            const n = summary.distribution[star];
            const pct = summary.count > 0 ? Math.round((n / summary.count) * 100) : 0;
            return (
              <div key={star} className="flex items-center gap-3 text-[12px]">
                <span className="w-8 shrink-0 text-ink-3">{star} 星</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-bg-soft">
                  <div
                    className="h-full rounded-full bg-amber-400 transition-[width]"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right tabular-nums text-ink-3">
                  {n}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-10">
        <h3 className="text-[15px] font-semibold text-ink mb-3">我的评价</h3>
        {!user ? (
          <p className="text-[13px] leading-6 text-ink-2">
            <Link
              href={`/login?next=${encodeURIComponent(`/courses/${courseId}`)}`}
              className="text-brand hover:underline"
            >
              登录
            </Link>{" "}
            后即可为课程打分留言。
          </p>
        ) : canReview ? (
          <ReviewForm
            courseId={courseId}
            initialRating={mine?.rating ?? 0}
            initialBody={mine?.body ?? ""}
            hasExisting={Boolean(mine)}
          />
        ) : (
          <p className="text-[13px] leading-6 text-ink-2">
            报名本课后即可评价。
            <Link href={`/courses/${courseId}`} className="ml-1 text-brand hover:underline">
              查看报名方式
            </Link>
          </p>
        )}
      </div>

      <div className="mt-10">
        <h3 className="text-[15px] font-semibold text-ink mb-4">
          全部评价{total > 0 ? ` (${total})` : ""}
        </h3>
        {reviews.length === 0 ? (
          <p className="text-[13px] text-ink-3">还没有评价,来做第一个分享心得的人。</p>
        ) : (
          <ul className="space-y-5">
            {reviews.map((r) => (
              <li key={r.id} className="flex gap-3">
                {r.authorAvatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={r.authorAvatar}
                    alt={r.authorNickname}
                    className="h-9 w-9 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <InstructorAvatar name={r.authorNickname} size={36} />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-[14px] font-medium text-ink">
                      {r.authorNickname}
                    </span>
                    <StarRating value={r.rating} size={13} />
                    <span className="text-[12px] text-ink-3">
                      {formatDate(r.createdAt)}
                    </span>
                  </div>
                  {r.body ? (
                    <p className="mt-1.5 whitespace-pre-wrap break-words text-[14px] leading-6 text-ink-2">
                      {r.body}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
