"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth-user";
import { canAccessCourse, findById as findCourse } from "@/lib/db/courses";
import { upsertReview } from "@/lib/db/course-reviews";
import { awardPoints } from "@/lib/db/points";

// 课程评价提交:仅能访问该课的用户可评(已购 / 会员 / 免费课 / 试看)。
// rating 必须 1..5;不达资格或非法分值带错误码跳回课程页。
export async function submitReviewAction(f: FormData): Promise<void> {
  const courseId = String(f.get("courseId") ?? "").trim();
  if (!courseId) redirect("/courses");
  const coursePath = `/courses/${courseId}`;

  const user = await requireUser(coursePath);

  const course = await findCourse(courseId);
  if (!course) redirect("/courses");

  const access = await canAccessCourse(user, course);
  if (!access.allowed) {
    redirect(`${coursePath}?reviewError=not_allowed`);
  }

  const rating = Number(f.get("rating"));
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    redirect(`${coursePath}?reviewError=rating`);
  }

  const body = String(f.get("body") ?? "").trim();

  await upsertReview(user.id, courseId, Math.round(rating), body);
  // 每门课首条评价发分;改评价同 reason+courseId 去重不重复发。
  await awardPoints(user.id, 10, "review", { refId: courseId });
  revalidatePath(coursePath);
  redirect(`${coursePath}?reviewOk=1#reviews`);
}
