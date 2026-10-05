/** Shared Hook/CI guard for the canonical label-left/switch-right contract. */
export function toggleSideViolations(filePath: string, source: string): string[] {
  const path = filePath.replaceAll('\\', '/');
  if (!/packages\/(client|timer-ui|app-ui)\//.test(path) || /(?:tests|scripts)\/|\.test\./.test(path)) return [];
  const text = source.replace(/\/\*[\s\S]*?\*\//g, '');
  const violations: string[] = [];
  for (const match of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!/\.(?:bool-toggle(?:-label)?|settings-row-boolean|settings-row-control)\b/.test(match[1])) continue;
    if (/flex-direction\s*:\s*(?:row|column)-reverse\b|(?:^|;)\s*order\s*:|direction\s*:\s*rtl\b/.test(match[2])) {
      violations.push('Toggle rows must keep labels left and switches right; remove reverse/order/rtl overrides.');
    }
  }
  if (path.endsWith('/BoolToggle.tsx')) {
    const label = text.indexOf('className="bool-toggle-label"');
    const control = text.indexOf('{(renderSwitch ??');
    if (label >= 0 && control >= 0 && label > control) violations.push('BoolToggle must render its label before its switch.');
  }
  if (path.endsWith('/TimerTimingSettingsSections.tsx')) {
    const start = text.indexOf('export function TimerBooleanSettingRow');
    const label = text.indexOf('className="settings-row-label"', start);
    const control = text.indexOf('className="settings-row-control"', start);
    if (start >= 0 && label >= 0 && control >= 0 && label > control) violations.push('TimerBooleanSettingRow must render its label before its control.');
  }
  return violations;
}
