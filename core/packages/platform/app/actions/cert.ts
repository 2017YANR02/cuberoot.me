"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth-user";
import { issueCertificate } from "@/lib/db/certificates";

/**
 * 领取结课证书:校验登录 + 已学完该课,则(幂等)发证并跳转到公开验证页。
 * UI 仅在 100% 完成时暴露入口;未完成 / 课程缺失这里兜底,回 /me/courses 不发证。
 */
export async function issueCertificateAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const courseId = String(formData.get("courseId") ?? "").trim();
  if (!courseId) redirect("/me/courses");

  const res = await issueCertificate(user.id, courseId);
  if (!res.ok) {
    redirect("/me/courses?cert=not_ready");
  }

  revalidatePath("/me/courses");
  redirect(`/cert/${res.certificate.code}`);
}
