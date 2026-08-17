import type {
  TeachingMemberStatus,
  TeachingOrganizationRole,
  TeachingOrganizationStatus,
  TeachingStudentStatus,
} from "@cuberoot/shared/teaching";
import { TeachingApiError } from "@/lib/teaching-api";

const ROLE_LABELS: Record<TeachingOrganizationRole, string> = {
  owner: "所有者",
  admin: "管理员",
  teacher: "老师",
  assistant: "助教",
  finance: "财务",
  viewer: "只读成员",
};

const STATUS_LABELS: Record<
  TeachingOrganizationStatus | TeachingMemberStatus | TeachingStudentStatus,
  string
> = {
  active: "正常",
  suspended: "已停用",
  archived: "已归档",
  invited: "待加入",
  revoked: "已移除",
  inactive: "暂停学习",
};

export function teachingRoleLabel(role: TeachingOrganizationRole): string {
  return ROLE_LABELS[role];
}

export function teachingStatusLabel(
  status: TeachingOrganizationStatus | TeachingMemberStatus | TeachingStudentStatus,
): string {
  return STATUS_LABELS[status];
}

export function teachingErrorMessage(error: unknown): string {
  if (!(error instanceof TeachingApiError)) return "教学服务暂时不可用，请稍后重试";
  switch (error.code) {
    case "CONFLICT":
      return "当前数据状态不允许这项操作，请检查后重试";
    case "INVALID_INPUT":
      return "提交内容不符合要求，请检查后重试";
    case "ORGANIZATION_NOT_FOUND":
      return "机构不存在，或你没有访问权限";
    case "PERMISSION_DENIED":
      return "你当前的机构角色不能执行此操作";
    case "ORGANIZATION_SUSPENDED":
      return "该机构当前已停用，不能修改数据";
    case "IDEMPOTENCY_CONFLICT":
      return "操作状态冲突，请刷新页面后重试";
    case "RATE_LIMITED":
      return "操作过于频繁，请稍后再试";
    case "UNAVAILABLE":
    case "BAD_RESPONSE":
    case "INTERNAL_ERROR":
      return error.message;
    default:
      return "操作未完成，请稍后重试";
  }
}
