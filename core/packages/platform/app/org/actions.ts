"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth-user";
import {
  createTeachingOrganization,
  createTeachingStudent,
} from "@/lib/teaching-api";
import { teachingErrorMessage } from "@/lib/teaching-labels";

export type CreateOrganizationResult =
  | { ok: true; slug: string }
  | { ok: false; error: string };

export type CreateStudentResult =
  | { ok: true; studentId: string }
  | { ok: false; error: string };

export async function createOrganizationAction(
  formData: FormData,
): Promise<CreateOrganizationResult> {
  const user = await requireUser("/org");
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  const operationKey = String(formData.get("operationKey") ?? "");
  if (!name || name.length > 160) {
    return { ok: false, error: "机构名称需为 1 至 160 个字符" };
  }
  if (!/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(slug)) {
    return { ok: false, error: "机构标识只能使用小写字母、数字和中间连字符" };
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(operationKey)) {
    return { ok: false, error: "操作标识已失效，请刷新页面后重试" };
  }
  try {
    const organization = await createTeachingOrganization(user, { name, slug }, operationKey);
    revalidatePath("/org");
    return { ok: true, slug: organization.slug };
  } catch (error) {
    return { ok: false, error: teachingErrorMessage(error) };
  }
}

export async function createStudentAction(
  orgSlug: string,
  formData: FormData,
): Promise<CreateStudentResult> {
  const user = await requireUser(`/org/${orgSlug}/students`);
  const displayName = String(formData.get("displayName") ?? "").trim();
  const rawExternalRef = String(formData.get("externalRef") ?? "").trim();
  const operationKey = String(formData.get("operationKey") ?? "");
  if (!displayName || displayName.length > 160) {
    return { ok: false, error: "学员姓名需为 1 至 160 个字符" };
  }
  if (rawExternalRef.length > 100) {
    return { ok: false, error: "学员编号不能超过 100 个字符" };
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(operationKey)) {
    return { ok: false, error: "操作标识已失效，请刷新页面后重试" };
  }
  try {
    const student = await createTeachingStudent(user, orgSlug, {
      displayName,
      externalRef: rawExternalRef || null,
    }, operationKey);
    revalidatePath(`/org/${orgSlug}`);
    revalidatePath(`/org/${orgSlug}/students`);
    return { ok: true, studentId: student.id };
  } catch (error) {
    return { ok: false, error: teachingErrorMessage(error) };
  }
}
