import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { METHOD_KEYS } from '@/components/StageSolver';
import { TABLE_SETS, XCROSS_TABLES } from '@/lib/rust-cross-client';
import {
  RECENT_METRIC_ORDER, VARIANT_STAGES, uiVariantOptions, variantDataRef,
} from '@/lib/scramble-variants';
import { METRIC_OFFSET } from '@/app/[lang]/scramble/gen/CompCrossAnalysis';
import { EXACT_VARIANT_STAGES, getExactCell } from '@/app/[lang]/scramble/stats/_data/exact_dist';

const ROOT = path.resolve(__dirname, '../../../..');
const read = (p: string) => readFileSync(path.join(ROOT, p), 'utf8');

describe('Second Layer 薄别名全链路登记', () => {
  it('用户态独立，数据态统一落到 std stage-4', () => {
    expect(VARIANT_STAGES.second_layer).toEqual(['second_layer']);
    expect(variantDataRef('second_layer', 'second_layer')).toEqual({
      variant: 'std', stage: 'xxxxcross', recentMetric: 'xxxxc',
    });
    expect(uiVariantOptions((v) => v === 'std')).toContain('second_layer');
    expect(METHOD_KEYS).toContain('second_layer');
    expect(RECENT_METRIC_ORDER).toContain('second_layer');
  });

  it('比赛步骤复用 std stage-4 的 24 偏移', () => {
    expect(METRIC_OFFSET.bsecond_layer).toBe(24);
  });

  it('浏览器复用 cross need 与唯一 XCross 大资产，不建新表', () => {
    expect(TABLE_SETS.cross).toEqual(['pt_cross']);
    expect(XCROSS_TABLES).toEqual(['pt_cross_C4E0']);
    expect(Object.hasOwn(TABLE_SETS, 'second_layer')).toBe(false);

    const solver = read('core/packages/client/components/StageSolver.tsx');
    expect(solver).toContain("m === 'std' || m === 'second_layer' ? 'cross'");
    expect(solver).toContain("method === 'second_layer' ? 4 : stage");
    const worker = read('tools/solver/rust-cross/cross-solver-worker.js');
    expect(worker).not.toContain("need === 'second_layer'");
  });

  it('静态统计保持单份 std/xxxxcross，精确矩阵只给别名入口', () => {
    expect(EXACT_VARIANT_STAGES.second_layer).toEqual(['second_layer']);
    expect(getExactCell('second_layer', 'unfixed', 'W')?.kind).toBe('todo');

    const variants = read('core/packages/scramble-stats-build/src/variants.ts');
    const recent = read('core/packages/scramble-stats-build/src/build_recent_scrambles.ts');
    const compSteps = read('core/packages/scramble-stats-build/src/build_comp_steps.ts');
    expect(variants).not.toMatch(/key:\s*['"]second_layer['"]/);
    expect(recent).not.toMatch(/key:\s*['"]second_layer['"]/);
    expect(compSteps).not.toMatch(/second_layer\.csv/);
  });
});
