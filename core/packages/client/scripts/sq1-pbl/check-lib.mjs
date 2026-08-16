const CATEGORY_LABELS = {
  content: '内容',
  presentation: '结构/格式',
  editorial: '讨论批注',
};

const code = (value) => `\`${String(value).replaceAll('`', '\\`').slice(0, 240)}\``;

export function invariantChanges(before = {}, after = {}) {
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  return keys.flatMap((key) => {
    const oldValue = JSON.stringify(before[key]);
    const newValue = JSON.stringify(after[key]);
    return oldValue === newValue ? [] : [{ key, before: oldValue, after: newValue }];
  });
}

export function classifyDrift(baseline, live) {
  const workbookCategories = Object.keys(CATEGORY_LABELS).filter(
    (category) => baseline.digests?.[category] !== live.digests?.[category],
  );
  const oldSheets = new Map((baseline.sheets ?? []).map((sheet) => [sheet.name, sheet]));
  const liveSheets = new Map((live.sheets ?? []).map((sheet) => [sheet.name, sheet]));
  const added = [...liveSheets.keys()].filter((name) => !oldSheets.has(name));
  const removed = [...oldSheets.keys()].filter((name) => !liveSheets.has(name));
  const changed = [];
  for (const [name, sheet] of liveSheets) {
    const old = oldSheets.get(name);
    if (!old) continue;
    const categories = Object.keys(CATEGORY_LABELS).filter(
      (category) => old.digests?.[category] !== sheet.digests?.[category],
    );
    if (categories.length) changed.push({ name, categories, before: old, after: sheet });
  }
  const invariantDiff = invariantChanges(baseline.invariants, live.invariants);
  const material = added.length > 0
    || removed.length > 0
    || invariantDiff.length > 0
    || workbookCategories.some((category) => category !== 'editorial');
  const editorial = workbookCategories.includes('editorial');
  return { material, editorial, workbookCategories, added, removed, changed, invariantDiff };
}

export function renderReport(baseline, live, result, docUrl) {
  const lines = [
    '# SQ1 PBL 表格漂移检测',
    '',
    `- 数据源: ${docUrl}`,
    `- 基线来源: ${baseline.source ?? '(unknown)'}`,
    `- 基线时间: ${baseline.fetchedAt ?? '(unknown)'}`,
    `- 当前原始 SHA-256: ${live.rawSha256}`,
    `- 当前表页: ${live.totals?.sheets ?? live.sheets?.length ?? 0}`,
    '',
  ];
  if (!result.material && !result.editorial) {
    lines.push('与仓库快照一致，无需更新。');
    return lines.join('\n');
  }
  if (!result.material && result.editorial) {
    lines.push('仅讨论批注发生变化；内容与结构未漂移，不创建阻塞 Issue。', '');
  }
  const workbookMaterial = result.workbookCategories.filter((category) => category !== 'editorial');
  if (workbookMaterial.length) {
    lines.push('## 工作簿级变化', '', `- ${workbookMaterial.map((category) => CATEGORY_LABELS[category]).join('、')}`, '');
  }
  const materialChanges = result.changed.filter((item) =>
    item.categories.some((category) => category !== 'editorial'));
  if (materialChanges.length) {
    lines.push(`## 表页变化 (${materialChanges.length})`, '');
    for (const item of materialChanges) {
      const labels = item.categories.map((category) => CATEGORY_LABELS[category]).join('、');
      lines.push(`- **${item.name}**: ${labels}`);
      for (const field of ['valueOrFormula', 'formulas', 'merges', 'validations', 'conditionalFormatting', 'hyperlinks', 'stableComments', 'pictureAnchors']) {
        const oldValue = item.before.counts?.[field] ?? 0;
        const newValue = item.after.counts?.[field] ?? 0;
        if (oldValue !== newValue) lines.push(`  - ${field}: ${oldValue} → ${newValue}`);
      }
    }
    lines.push('');
  }
  const editorialChanges = result.changed.filter((item) => item.categories.includes('editorial'));
  if (editorialChanges.length) {
    lines.push('## 讨论批注变化（非阻塞）', '', ...editorialChanges.map((item) => `- ${item.name}`), '');
  }
  if (result.added.length) lines.push('## 新增表页', '', ...result.added.map((name) => `- ${name}`), '');
  if (result.removed.length) lines.push('## 删除表页', '', ...result.removed.map((name) => `- ${name}`), '');
  if (result.invariantDiff.length) {
    lines.push('## 数据不变量变化', '');
    for (const item of result.invariantDiff) {
      lines.push(`- ${item.key}: ${code(item.before)} → ${code(item.after)}`);
    }
    lines.push('');
  }
  if (!result.material) return lines.join('\n').trimEnd();
  lines.push(
    '## 处理步骤',
    '',
    '1. 使用 `maintain-sq1-pbl` skill 在本地复跑 checker，并审阅上述内容/结构变化。',
    '2. 完成 PBL 数据、页面和回归测试的同步；不要直接用公式缓存覆盖规范数据。',
    '3. 人工确认 968 个 Raw Algs、频次 10368、四个 unused case 和图片渲染。',
    '4. 验证完成后运行 `node packages/client/scripts/sq1-pbl-check.mjs --write` 更新基线。',
  );
  return lines.join('\n');
}
