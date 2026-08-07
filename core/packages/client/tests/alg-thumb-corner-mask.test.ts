// 约束守卫:顶层公式集(COLL / CMLL,以及 ZBLL / 1LLL / OLLCP 那批同样用 coll 遮罩的二级选择卡)
// 的缩略图参数只能出自 lib/alg_thumb_plan.ts —— 那里的 `cubeThumbParams` 一处决定视角 / 遮罩 /
// 侧环删灰(`hideGreySides`),屏幕上的 <CaseThumb>、PDF 导出的 renderFromSimpleQuery、/recognize
// 的题图全从它取。
//
// 防的是这个具体回归:有人图省事直接写一个 `<VisualCube view="pll" mask="coll">`(训练器里真出现过
// 一份),那张图就绕开了删灰这一步 —— 同一个 case 在列表里四个侧面干干净净,在选择面板里却挂着
// 一圈灰格。语义判据(灰格删没删干净)在 plan-hide-grey-sides.test.ts;这里只锁「别再手搓第二份」。
//
// 豁免:行内 allow-corner-mask: <理由>。
// guard-registry: tracked at /code/guards (app/[lang]/code/guards/_guards.ts)
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname, relative } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..'); // packages/client
const SCAN_DIRS = ['app', 'components', 'lib'];

/** 唯一允许写死角块遮罩的地方 —— 遮罩表本身。 */
const SINGLE_SOURCE = join('lib', 'alg_thumb_plan.ts');

/** 出图组件的开标签起点。CaseVisualizer(/alg/roux 的自有渲染器)不在此列。 */
const TAG_RE = /<(VisualCube|CaseThumb)\b/g;
const CORNER_MASK_RE = /mask=(?:["'](coll|cmll)["']|\{\s*["'](coll|cmll)["']\s*\})/;

function safeReaddir(dir: string) {
  try { return readdirSync(dir, { withFileTypes: true }); } catch { return []; }
}
function walk(dir: string): string[] {
  let out: string[] = [];
  for (const ent of safeReaddir(dir)) {
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === '.next') continue;
      out = out.concat(walk(join(dir, ent.name)));
    } else if (/\.tsx$/.test(ent.name) && !/\.test\.tsx$/.test(ent.name)) {
      out.push(join(dir, ent.name));
    }
  }
  return out;
}

/** 开标签的属性段:从 `<Tag` 到最近的 `>`(JSX 属性里嵌 `>` 的写法本仓没有)。 */
function openTags(src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(TAG_RE)) {
    const start = m.index ?? 0;
    const end = src.indexOf('>', start);
    out.push(src.slice(start, end < 0 ? src.length : end + 1));
  }
  return out;
}

describe('顶层公式集缩略图的角块遮罩只出自 CaseThumb', () => {
  it('没有别处手写 mask="coll" / "cmll"', () => {
    const offenders: string[] = [];
    for (const base of SCAN_DIRS) {
      for (const file of walk(join(ROOT, base))) {
        const rel = relative(ROOT, file);
        if (rel === SINGLE_SOURCE) continue;
        const src = readFileSync(file, 'utf8');
        for (const tag of openTags(src)) {
          if (!CORNER_MASK_RE.test(tag)) continue;
          if (tag.includes('allow-corner-mask')) continue;
          offenders.push(`${rel}\t${tag.replace(/\s+/g, ' ').slice(0, 120)}`);
        }
      }
    }
    expect(
      offenders,
        '角块遮罩(coll / cmll)写死在了 alg_thumb_plan 之外 —— 这张图会绕开 cubeThumbParams 的删灰。\n' +
        '改成 <CaseThumb …>,遮罩从 alg_thumb_plan 的 CORNER_LL_MASK / LEVEL2_PICKER_MASK 取;\n' +
        '确有特例就行内注释 allow-corner-mask: <理由>。\n' +
        offenders.join('\n'),
    ).toEqual([]);
  });

  it('遮罩表还在统一缩略图计划里(改名/搬走就把上面那条判据架空了)', () => {
    const src = readFileSync(join(ROOT, SINGLE_SOURCE), 'utf8');
    expect(src).toContain('CORNER_LL_MASK');
    expect(src).toContain('LEVEL2_PICKER_MASK');
  });
});
