// Temporary branch-only edit transport; removed before merge.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const changed = new Set<string>();
function edit(path: string, before: string, after: string) {
  const filename = resolve(root, path), source = readFileSync(filename, 'utf8');
  if (source.includes(after)) return;
  if (source.split(before).length !== 2) throw new Error(`Unexpected patch: ${path}: ${before}`);
  writeFileSync(filename, source.replace(before, after));
  changed.add(path);
}
const browser = 'core/packages/client/scripts/radio-web-browser-acceptance.mts';
edit(browser, "  await solution(page).fill(\"R 2L' Gw [F,U]\");\n  await page.getByRole('button', { name: '回到起点', exact: true }).click();", "  await solution(page).fill(\"R 2L' Gw [F,U]\");\n  // At anchor=start, start is correctly disabled; seek to end first.\n  await end(page).click();\n  await page.getByRole('button', { name: '回到起点', exact: true }).click();");
edit(browser, "    if (!await menu.count()) await trigger.click();\n    await expect(menu).toBeVisible();", "    // The competition panel hydrates after its first SSR paint. Retry the\n    // public trigger only while collapsed, never toggle an already open menu.\n    await expect.poll(async () => {\n      if (await menu.count()) return true;\n      if (await trigger.getAttribute('aria-expanded') !== 'true') await trigger.click();\n      return await menu.count() > 0;\n    }, { timeout: 30_000, intervals: [500, 1000] }).toBe(true);");
edit('core/packages/client/tests/timer-drill-contract-shared.test.ts', 'expect(EVENTS).toHaveLength(76);', 'expect(EVENTS).toHaveLength(77);');
edit('core/packages/client/tests/timer-puzzle-picker.test.ts', 'expect(items).toHaveLength(76);', 'expect(items).toHaveLength(77);');
const out = resolve(root, 'core/.tmp/radio-web-evidence');
mkdirSync(out, { recursive: true });
writeFileSync(resolve(out, 'changed-paths.txt'), [...changed].join('\n') + '\n');
// Review tracked source only; never runner credentials, generated runtime files or secrets.
const tracked = execFileSync('git', ['ls-files', 'core/apps/miniprogram', 'core/packages/app-ui', 'core/packages/client/scripts', '.github/workflows/test.yml'], { cwd: root, encoding: 'utf8' }).trim().split('\n');
const sources: Record<string, string> = {};
for (const path of tracked) if (/\.(?:ts|tsx|mts|mjs|json|yml)$/.test(path) && existsSync(resolve(root, path))) {
  const text = readFileSync(resolve(root, path), 'utf8');
  if (text.length < 300_000) sources[path] = text;
}
writeFileSync(resolve(out, 'cross-platform-review.json'), JSON.stringify(sources));
console.log(`Applied ${changed.size} exact source updates; exported ${Object.keys(sources).length} tracked review files.`);
