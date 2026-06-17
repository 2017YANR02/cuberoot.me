// IME 安全约定守卫:自由文本 <input>/<textarea> 的 value 若**直接绑定 nuqs 状态**
// (useQueryState 的值),每次按键写回会改 URL → 重渲染 → 打断中文/日文输入法合成
// (把「bei」拼成乱码)。这类输入必须处理 composition(onCompositionStart/End)——
// 实践上统一走共享件 <SearchInput>(components/SearchInput.tsx,已内置)。
//
// 本测试只盯「value 直接绑 nuqs 值」这一精确信号:用本地 state 承接 + 防抖/合成的写法
// (value 不是 nuqs 值)不会误报。CI 跑 vitest 当红灯,新代码裸写即挂。
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname, relative, sep } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..'); // packages/client
const SCAN_DIRS = ['app', 'components'];

// 相对 client 根的 posix 路径 → 豁免(确属特殊,文件内应说明理由)
const ALLOWLIST = new Set<string>([
  // 目前无豁免;确需绕过(非文本输入误判 / 特殊编码)再加,并在文件内注释理由。
]);

// 非自由文本输入类型:不涉及 IME 合成,跳过。
const NON_TEXT_TYPES = new Set([
  'checkbox', 'radio', 'range', 'date', 'datetime-local', 'month', 'week', 'time',
  'color', 'file', 'number', 'submit', 'button', 'reset', 'image', 'hidden',
]);

function safeReaddir(dir: string) {
  try { return readdirSync(dir, { withFileTypes: true }); } catch { return []; }
}
function walk(dir: string): string[] {
  let out: string[] = [];
  for (const ent of safeReaddir(dir)) {
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === '.next') continue;
      out = out.concat(walk(join(dir, ent.name)));
    } else if (/\.tsx$/.test(ent.name) && !/\.test\.tsx?$/.test(ent.name)) {
      out.push(join(dir, ent.name));
    }
  }
  return out;
}

// useQueryState 解构出的「值」名(`const [q, setQ] = useQueryState(...)` 里的 q)。
function nuqsValueNames(src: string): Set<string> {
  const names = new Set<string>();
  const re = /const\s*\[\s*([A-Za-z0-9_]+)\s*,\s*[A-Za-z0-9_]+\s*\]\s*=\s*useQueryState\b/g;
  for (const m of src.matchAll(re)) names.add(m[1]);
  return names;
}

// 从 '<' 起读完整个开标签(到 depth 0 的 '>'),跳过引号串与 {} 内部,
// 这样属性里的箭头函数 `=>` 的 '>' 不会被当成标签结束。
function readOpenTag(src: string, start: number): string {
  let depth = 0;
  let quote: string | null = null;
  for (let j = start; j < src.length; j++) {
    const c = src[j];
    if (quote) {
      if (c === quote && src[j - 1] !== '\\') quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === '>' && depth === 0) return src.slice(start, j + 1);
  }
  return src.slice(start);
}

function tagType(tag: string): string | null {
  const m = tag.match(/\btype\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\s*['"]([^'"]*)['"]\s*\})/);
  if (!m) return null; // 无 type 属性 = 默认 text
  return (m[1] ?? m[2] ?? m[3] ?? '').toLowerCase();
}

describe('IME-safe convention — nuqs-bound free-text inputs must handle composition (use <SearchInput>)', () => {
  const files = SCAN_DIRS.flatMap((d) => walk(join(ROOT, d)));

  it('scans a meaningful number of source files', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it('has no nuqs-bound free-text input without IME composition handling', () => {
    const violations: string[] = [];
    for (const file of files) {
      const rel = relative(ROOT, file).split(sep).join('/');
      if (ALLOWLIST.has(rel)) continue;
      const src = readFileSync(file, 'utf8');
      if (!src.includes('useQueryState')) continue;
      const nuqsVals = nuqsValueNames(src);
      if (nuqsVals.size === 0) continue;

      for (const m of src.matchAll(/<(input|textarea)\b/g)) {
        const tag = readOpenTag(src, m.index!);
        const isTextarea = m[1] === 'textarea';
        if (!isTextarea) {
          const t = tagType(tag);
          if (t !== null && (NON_TEXT_TYPES.has(t) || !(t === 'text' || t === 'search'))) continue;
        }
        // value 直接绑定某个 nuqs 值?(value={q} / value={q ?? ''} / value={!q} 等)
        const vm = tag.match(/\bvalue\s*=\s*\{\s*!?\s*([A-Za-z0-9_]+)/);
        const boundName = vm?.[1];
        if (!boundName || !nuqsVals.has(boundName)) continue;
        // 已处理合成?
        if (/onComposition(Start|End)/.test(tag)) continue;
        violations.push(`${rel} → <${m[1]} value={${boundName}}> 直接绑 nuqs 但未处理 IME composition`);
      }
    }
    expect(
      violations,
      '自由文本输入若 value 直接绑 nuqs(useQueryState)状态,合成途中写回会打断中文/日文输入法。\n' +
        '统一改用共享件 <SearchInput value={q} onChange={setQ} />(components/SearchInput.tsx,已内置 composition 处理),\n' +
        '别裸写 <input value={q} onChange={e => setQ(e.target.value)} />。确属特殊再加进本测试 ALLOWLIST + 文件内注释理由。\n' +
        '命中:\n' +
        violations.join('\n'),
    ).toEqual([]);
  });
});
