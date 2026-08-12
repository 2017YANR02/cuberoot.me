import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { METHOD_KEYS } from '@/components/StageSolver';
import { TABLE_SETS } from '@/lib/rust-cross-client';
import {
  RECENT_METRIC_ORDER, VARIANT_LABEL, VARIANT_ORDER, VARIANT_STAGES,
  dataVariantOfStage, stageLabel, uiVariantOf, uiVariantOptions, variantDataRef,
} from '@/lib/scramble-variants';
import { METRIC_OFFSET } from '@/app/[lang]/scramble/gen/CompCrossAnalysis';
import { EXACT_VARIANT_STAGES } from '@/app/[lang]/scramble/stats/_data/exact_dist';
import {
  FIRST_LAYER_SOLVED_SECOND_LAYER_COUNTS,
  FIRST_LAYER_SOLVED_SECOND_LAYER_GOD,
  FIRST_LAYER_SOLVED_SECOND_LAYER_TOTAL,
} from '@/app/[lang]/scramble/stats/_data/first_layer_solved_dist';

const ROOT = path.resolve(__dirname, '../../../..');
const read = (p: string) => readFileSync(path.join(ROOT, p), 'utf8');

describe('第一层已还原条件下的第二层分布', () => {
  it('离线直方图覆盖全部 26,880 个条件状态', () => {
    expect(FIRST_LAYER_SOLVED_SECOND_LAYER_TOTAL).toBe(26_880);
    expect(FIRST_LAYER_SOLVED_SECOND_LAYER_GOD).toBe(13);
    expect(Object.values(FIRST_LAYER_SOLVED_SECOND_LAYER_COUNTS).reduce((a, b) => a + b, 0)).toBe(26_880);
    expect(FIRST_LAYER_SOLVED_SECOND_LAYER_COUNTS['13']).toBe(18);
  });

  it('LBL 保留真实条件阶段，但不再把 std 数据伪装成第二层', () => {
    expect(VARIANT_LABEL.lbl).toEqual({ zh: '层先', en: 'LBL' });
    expect(VARIANT_ORDER).toContain('lbl');
    expect(VARIANT_STAGES.second_layer).toEqual(['second_layer']);
    expect(variantDataRef('second_layer', 'second_layer')).toEqual({
      variant: 'second_layer', stage: 'second_layer', recentMetric: 'second_layer',
    });
    expect(uiVariantOf('second_layer')).toBe('lbl');
    expect(uiVariantOptions((v) => v === 'std')).not.toContain('lbl');
    expect(uiVariantOptions((v) => v === 'second_layer')).toContain('lbl');
    expect(VARIANT_STAGES.lbl).toEqual(['daisy', 'first_face', 'first_layer', 'second_layer']);
    expect(VARIANT_STAGES.lbl.map((s) => stageLabel(s, true))).toEqual(['小花', '底面', '底层', '第二层']);
    expect(dataVariantOfStage('lbl', 'second_layer')).toBe('second_layer');
  });

  it('WCA、近期打乱、生成器和现场求解器均不再暴露伪别名', () => {
    expect(METHOD_KEYS).not.toContain('second_layer');
    expect(RECENT_METRIC_ORDER).not.toContain('second_layer');
    expect(Object.hasOwn(METRIC_OFFSET, 'bsecond_layer')).toBe(false);
    expect(Object.hasOwn(TABLE_SETS, 'second_layer')).toBe(false);
    expect(Object.hasOwn(EXACT_VARIANT_STAGES, 'second_layer')).toBe(false);

    const filesWithoutAnyAlias = [
      'core/packages/client/components/StageSolver.tsx',
      'core/packages/client/components/RecentScrambles.tsx',
      'core/packages/client/app/[lang]/scramble/gen/SheetView.tsx',
      'core/packages/client/app/[lang]/scramble/gen/useCompSteps.ts',
    ];
    for (const file of filesWithoutAnyAlias) expect(read(file), file).not.toMatch(/b?second_layer/);
    const generator = read('core/packages/client/app/[lang]/scramble/gen/TNoodleMode.tsx');
    expect(generator).not.toContain('bsecond_layer');
    expect(generator).not.toMatch(/^\s*second_layer:\s*\{/m);
  });

  it('统计页只注入离线条件集，统计构建管道不伪造 WCA 数据', () => {
    const page = read('core/packages/client/app/[lang]/scramble/stats/page.tsx');
    expect(page).toContain("const FIRST_LAYER_SOLVED_SET_KEY = 'first_layer_solved'");
    expect(page).toContain('客户端不运行搜索');

    const variants = read('core/packages/scramble-stats-build/src/variants.ts');
    const recent = read('core/packages/scramble-stats-build/src/build_recent_scrambles.ts');
    const compSteps = read('core/packages/scramble-stats-build/src/build_comp_steps.ts');
    expect(variants).not.toMatch(/key:\s*['"]second_layer['"]/);
    expect(recent).not.toMatch(/key:\s*['"]second_layer['"]/);
    expect(compSteps).not.toMatch(/second_layer\.csv/);
  });

  it('旧本地设置即使残留 second_layer，也不会发成 WCA 难度查询', () => {
    const timer = read('core/packages/client/app/[lang]/timer/_shell/SoloView.tsx');
    const analyzer = read('core/packages/client/app/[lang]/scramble/analyzer/page.tsx');
    expect(timer).toContain("wcaDiffRef.variant === 'second_layer'");
    expect(timer).toContain('!wcaDiffIsConditionalOnly && !wcaCompUnindexed');
    expect(analyzer).toContain("diffRef.variant === 'second_layer'");
    expect(analyzer).toContain('!conditionalOnly && s.wcaDifficultyOn');
  });
});
