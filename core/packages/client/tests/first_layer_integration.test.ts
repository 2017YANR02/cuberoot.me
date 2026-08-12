import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { TABLE_SETS } from '@/lib/rust-cross-client';
import { RECENT_METRIC_ORDER, VARIANT_STAGES } from '@/lib/scramble-variants';
import { METRIC_OFFSET } from '@/app/[lang]/scramble/gen/CompCrossAnalysis';

const ROOT = path.resolve(__dirname, '../../../..');
const read = (p: string) => readFileSync(path.join(ROOT, p), 'utf8');

describe('First Face / First Layer 全链路登记', () => {
  it('一个方法下保留两个阶段，且浏览器只装载预构建 bundle', () => {
    expect(VARIANT_STAGES.first_layer).toEqual(['first_face', 'first_layer']);
    expect(TABLE_SETS.first_layer).toEqual(['opt_first_layer']);
    expect(RECENT_METRIC_ORDER).toContain('first_face');
    expect(RECENT_METRIC_ORDER).toContain('first_layer');
  });

  it('比赛步骤的两阶段槽位固定为 0 / 6', () => {
    expect(METRIC_OFFSET.bfirst_face).toBe(0);
    expect(METRIC_OFFSET.bfirst_layer).toBe(6);
  });

  it('native 增量、难题集、comp steps 与近期打乱都使用同一 CSV 契约', () => {
    expect(read('core/packages/scramble-stats-build/update_cross_stats.ps1'))
      .toMatch(/first_layer\s*=\s*'first_layer_analyzer\.exe'/);
    expect(read('core/packages/scramble-stats-build/backfill_xcross_variant.ps1'))
      .toContain("first_layer = 'first_layer_analyzer.exe'");
    expect(read('core/packages/scramble-stats-build/src/variants.ts'))
      .toContain("stages: ['first_face', 'first_layer']");
    expect(read('core/packages/scramble-stats-build/src/build_comp_steps.ts'))
      .toContain("{ csv: 'first_layer.csv', stages: 2, outDir: 'comp_steps_first_layer' }");
    expect(read('core/packages/scramble-stats-build/src/build_recent_scrambles.ts'))
      .toContain("metrics: ['first_face', 'first_layer']");
  });

  it('worker 单类同时提供两个阶段的长度与解法协议', () => {
    const worker = read('tools/solver/rust-cross/cross-solver-worker.js');
    expect(worker).toContain("need === 'first_layer'");
    expect(worker).toContain("msg.type === 'first_layer_stage'");
    expect(worker).toContain("msg.type === 'first_layer_moves'");
  });
});
