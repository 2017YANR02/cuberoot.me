/** Registered menu catalogs; include new name sources when adding a menu. */
export const puzzleMenuCatalogs = [
  'core/packages/client/lib/cstimer-scramble.ts',
  'core/packages/client/lib/shape-mod-scramble.ts',
  'core/packages/client/app/[lang]/sim/pgCatalog.ts',
  'core/packages/client/app/[lang]/sim/PlayerControls.tsx',
];
export function puzzleMenuLabelViolations(filePath: string, source: string): string[] {
  const path = filePath.replaceAll('\\', '/');
  if (!puzzleMenuCatalogs.some(p => path === p || path.endsWith('/' + p))) return [];
  const violations: string[] = [];
  for (const match of source.matchAll(/\b(?:zh|labelZh)\s*:\s*(['"`])([^'"`]*?)\1/g)) {
    if (match[2].includes('魔方')) violations.push(`项目菜单名称「${match[2]}」须去掉「魔方」，直接使用短名。`);
  }
  return violations;
}
