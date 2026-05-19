/**
 * 多 puzzle 同屏选择时的 "当前展示" 派生:用户上次点的 event 若仍在候选里就保留,
 * 否则回退到候选第一个;候选空 → null。/scramble/gen QuickMode + TNoodleMode 共用。
 */
export function activeEventOf<T extends string>(
  stored: T | null,
  candidates: ReadonlyArray<T>,
): T | null {
  if (stored && candidates.includes(stored)) return stored;
  return candidates[0] ?? null;
}
