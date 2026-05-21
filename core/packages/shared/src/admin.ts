// 管理员 / 黑名单 WCA ID — 全栈共享单一来源,前端 UI gate 与后端 requireAdmin 必须一致。

export const ADMIN_WCA_IDS: readonly string[] = ['2017YANR02'];

export const BANNED_WCA_IDS: readonly string[] = [];

export function isAdminWcaId(wcaId: string | null | undefined): boolean {
  return !!wcaId && ADMIN_WCA_IDS.includes(wcaId);
}

export function isBannedWcaId(wcaId: string | null | undefined): boolean {
  return !!wcaId && BANNED_WCA_IDS.includes(wcaId);
}
