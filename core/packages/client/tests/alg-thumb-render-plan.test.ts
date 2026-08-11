import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { AlgPuzzle } from '@cuberoot/shared';
import { caseThumbPlan, type CaseThumbPlanInput } from '@/lib/alg_thumb_plan';
import { algCaseSvg } from '@/lib/alg_pdf/case_svg';

// guard-registry: tracked at /code/guards (app/[lang]/code/guards/_guards.ts)

const RAW = { kind: 'raw' as const, tag: '', attrs: {} };
const FACE = {
  kind: 'face' as const,
  us: 'rygyyyyyy',
  ub: 'yrybbbbbb',
  uf: 'ggogggggg',
  ul: 'bbrrrrrrr',
  ur: 'boooooooo',
};

function input(puzzle: AlgPuzzle, set = 'shape'): CaseThumbPlanInput {
  return { puzzle, set, sticker: RAW, alg: '', setup: '' };
}

describe('网页与 PDF 共用 case 缩略图渲染计划', () => {
  it('所有公式库拼图都由同一计划选择渲染器', () => {
    expect(caseThumbPlan(input('2x2')).renderer).toBe('visualcube');
    expect(caseThumbPlan(input('3x3')).renderer).toBe('visualcube');
    expect(caseThumbPlan(input('4x4')).renderer).toBe('visualcube');
    expect(caseThumbPlan(input('5x5')).renderer).toBe('visualcube');
    expect(caseThumbPlan(input('sq1')).renderer).toBe('inline-svg');
    expect(caseThumbPlan(input('megaminx')).renderer).toBe('sr');
    expect(caseThumbPlan(input('pyraminx')).renderer).toBe('engine');
    expect(caseThumbPlan(input('skewb')).renderer).toBe('inline-svg');
  });

  it.each(['cs', 'csp', 'co', 'eo', 'cp', 'ep', 'obl', 'parity'])('%s 的网页和 PDF 使用逐字相同的 SQ1 平面 SVG', async (set) => {
    const spec = {
      ...input('sq1', set),
      alg: '(1,0) / (-1,0)',
      sq1BlackTop: false,
    };
    const plan = caseThumbPlan(spec);
    expect(plan.renderer).toBe('inline-svg');
    if (plan.renderer !== 'inline-svg') throw new Error('expected inline Square-1 SVG');
    await expect(algCaseSvg(spec)).resolves.toBe(plan.svg);
  });

  it.each([
    {
      name: 'Right fist / Square',
      alg: '0,-1/0,1/4,0/-2,-1/2,0/-1,-2/-3,0/',
      staleSetup: '/3,0/1,2/-2,0/2,1/-4,0/0,-1',
    },
    {
      name: 'Square / Right fist',
      alg: '1,0/-1,0/0,-4/1,2/0,-2/2,1/0,3/',
      staleSetup: '/0,-3/-2,-1/0,2/-1,-2/0,4/1,0',
    },
  ])('CS $name 始终由公式反推形状,不采用截断的 setup', ({ alg, staleSetup }) => {
    const fromCase = caseThumbPlan({ ...input('sq1', 'cs'), alg, setup: staleSetup });
    const fromFormula = caseThumbPlan({ ...input('sq1', 'cs'), alg });
    const fromStaleSetup = caseThumbPlan({ ...input('sq1', 'cs'), alg: '', setup: staleSetup });
    expect(fromCase.renderer).toBe('inline-svg');
    expect(fromFormula.renderer).toBe('inline-svg');
    expect(fromStaleSetup.renderer).toBe('inline-svg');
    if (
      fromCase.renderer !== 'inline-svg'
      || fromFormula.renderer !== 'inline-svg'
      || fromStaleSetup.renderer !== 'inline-svg'
    ) throw new Error('expected inline Square-1 SVG');
    expect(fromCase.svg).toBe(fromFormula.svg);
    expect(fromCase.svg).not.toBe(fromStaleSetup.svg);
  });

  it('SQ1 黑顶开关进入共享计划和 PDF 缓存键', async () => {
    const base = { ...input('sq1', 'cp'), alg: '(1,0) / (-1,0)' };
    const black = caseThumbPlan({ ...base, sq1BlackTop: true });
    const yellow = caseThumbPlan({ ...base, sq1BlackTop: false });
    expect(black.renderer).toBe('inline-svg');
    expect(yellow.renderer).toBe('inline-svg');
    if (black.renderer !== 'inline-svg' || yellow.renderer !== 'inline-svg') {
      throw new Error('expected inline Square-1 SVG');
    }
    expect(black.svg).not.toBe(yellow.svg);
    await expect(algCaseSvg({ ...base, sq1BlackTop: true })).resolves.toBe(black.svg);
    await expect(algCaseSvg({ ...base, sq1BlackTop: false })).resolves.toBe(yellow.svg);
  });

  it('3x3 识别简化进入网页与 PDF 共用计划，其他阶数不误用', async () => {
    const base = { puzzle: '3x3' as const, set: 'zbll', sticker: FACE, alg: "R U R'", setup: "R U R'" };
    const plain = caseThumbPlan(base);
    const simplified = caseThumbPlan({ ...base, simplifyRecognition: true });
    expect(plain.renderer).toBe('visualcube');
    expect(simplified.renderer).toBe('visualcube');
    if (plain.renderer !== 'visualcube' || simplified.renderer !== 'visualcube') {
      throw new Error('expected visualcube plans');
    }
    expect(plain.params.planSimplify).toBeUndefined();
    expect(simplified.params.planSimplify).toEqual({ side: 'oppbar', up: 'all', showYellow: true });
    expect(simplified.setup).toBe(plain.setup);
    expect(simplified.algorithm).toBe(plain.algorithm);
    await expect(algCaseSvg({ ...base, simplifyRecognition: true }))
      .resolves.not.toBe(await algCaseSvg(base));

    const four = caseThumbPlan({ ...base, puzzle: '4x4', simplifyRecognition: true });
    expect(four.renderer).toBe('visualcube');
    if (four.renderer === 'visualcube') expect(four.params.planSimplify).toBeUndefined();
  });

  it('网页适配器和 PDF 适配器都只能消费 caseThumbPlan,不能再按 puzzle 分叉', () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), '..');
    const reactAdapter = readFileSync(join(root, 'components', 'CaseThumb.tsx'), 'utf8');
    const pdfAdapter = readFileSync(join(root, 'lib', 'alg_pdf', 'case_svg.ts'), 'utf8');
    for (const source of [reactAdapter, pdfAdapter]) {
      expect(source).toContain('caseThumbPlan(');
      expect(source).not.toMatch(/puzzle\s*===/);
      expect(source).not.toMatch(/switch\s*\(\s*puzzle\s*\)/);
    }
  });
});
