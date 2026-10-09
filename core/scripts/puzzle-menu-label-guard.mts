/** Repository-wide menu catalogs; include new name sources when adding a menu. */
export const puzzleMenuCatalogs = [
  'core/packages/shared/src/timer/types.ts',
  'core/packages/shared/src/timer/event-catalog.ts',
  'core/packages/shared/src/wca_events.ts',
  'core/packages/client/lib/cstimer-scramble.ts',
  'core/packages/client/lib/shape-mod-scramble.ts',
  'core/packages/client/app/[lang]/sim/pgCatalog.ts',
  'core/packages/client/app/[lang]/sim/PlayerControls.tsx',
  'core/packages/client/app/[lang]/sim/puzzleOptions.ts',
];
export function puzzleMenuLabelViolations(filePath: string, source: string): string[] {
  const path = filePath.replaceAll('\\', '/');
  if (!puzzleMenuCatalogs.some(p => path === p || path.endsWith('/' + p))) return [];
  const violations: string[] = [];
  // The WCA dictionaries key display names by event ID instead of a label field.
  const labels = path.endsWith('/wca_events.ts')
    ? /(?:\b(?:zh|labelZh|nameZh|en|labelEn|nameEn|textLabel)|['"][\w-]+['"])\s*:\s*(['"`])([^'"`]*?)\1/g
    : /\b(?:zh|labelZh|nameZh|en|labelEn|nameEn|textLabel)\s*:\s*(['"`])([^'"`]*?)\1/g;
  for (const match of source.matchAll(labels)) {
    if (match[2].includes('魔方')) violations.push(`项目菜单名称「${match[2]}」须去掉「魔方」，直接使用短名。`);
    if (/\d+\s*[×xX]\s*\d+\s*[×xX]\s*\d+/.test(match[2])) violations.push(`项目菜单尺寸「${match[2]}」须省略乘号，例如 233、334；左侧文字标签也使用相同短名。`);
  }
  return violations;
}
