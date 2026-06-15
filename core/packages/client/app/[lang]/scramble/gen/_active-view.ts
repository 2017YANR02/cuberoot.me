/**
 * 多 puzzle 同屏选择时的 "当前展示" 派生:用户上次点的 event 若仍在候选里就保留,
 * 否则回退到 333(若在候选里),再回退候选第一个;候选空 → null。
 * /scramble/gen QuickMode + TNoodleMode 共用。
 */
export function activeEventOf<T extends string>(
  stored: T | null,
  candidates: ReadonlyArray<T>,
): T | null {
  if (stored && candidates.includes(stored)) return stored;
  // 默认偏好 333 —— 比赛/批量打乱场景里最常用的项目应当先展示。
  if ((candidates as ReadonlyArray<string>).includes('333')) return '333' as T;
  return candidates[0] ?? null;
}
