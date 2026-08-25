import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { workspaceFixturePath } from './workspace-fixture-path';
import { METHOD_KEYS } from '@/components/StageSolver';
import { TABLE_SETS } from '@/lib/rust-cross-client';
import {
  RECENT_METRIC_ORDER, VARIANT_LABEL, VARIANT_ORDER, VARIANT_STAGES,
  dataVariantOfStage, normalizeVariantDataRef, stageLabel, uiVariantOf, uiVariantOptions,
  variantDataRef,
} from '@/lib/scramble-variants';
import { METRIC_OFFSET } from '@/app/[lang]/scramble/gen/CompCrossAnalysis';
import { EXACT_VARIANT_STAGES } from '@/app/[lang]/scramble/stats/_data/exact_dist';
import {
  FIRST_LAYER_SOLVED_SECOND_LAYER_COUNTS,
  FIRST_LAYER_SOLVED_SECOND_LAYER_GOD,
  FIRST_LAYER_SOLVED_SECOND_LAYER_TOTAL,
} from '@/app/[lang]/scramble/stats/_data/first_layer_solved_dist';
import { FIRST_LAYER_SOLVED_SECOND_LAYER_EXAMPLES } from '@/app/[lang]/scramble/stats/_data/first_layer_solved_examples';

const ROOT = path.resolve(__dirname, '../../../..');
const read = (p: string) => readFileSync(path.join(ROOT, p), 'utf8');
const readScrambleJob = (p: string) => readFileSync(
  workspaceFixturePath('@cuberoot/scramble-stats-build', p),
  'utf8',
);

describe('第一层已还原条件下的第二层分布', () => {
  it('离线直方图覆盖全部 26,880 个条件状态', () => {
    expect(FIRST_LAYER_SOLVED_SECOND_LAYER_TOTAL).toBe(26_880);
    expect(FIRST_LAYER_SOLVED_SECOND_LAYER_GOD).toBe(13);
    expect(Object.values(FIRST_LAYER_SOLVED_SECOND_LAYER_COUNTS).reduce((a, b) => a + b, 0)).toBe(26_880);
    expect(FIRST_LAYER_SOLVED_SECOND_LAYER_COUNTS['13']).toBe(18);
  });

  it('每个非空步数档都有离线打乱，13 步 18 个状态全部覆盖', () => {
    const nonEmptyBins = Object.entries(FIRST_LAYER_SOLVED_SECOND_LAYER_COUNTS)
      .filter(([, count]) => count > 0)
      .map(([depth]) => depth);
    expect(Object.keys(FIRST_LAYER_SOLVED_SECOND_LAYER_EXAMPLES)).toEqual(nonEmptyBins);
    for (const depth of nonEmptyBins) {
      const rows = FIRST_LAYER_SOLVED_SECOND_LAYER_EXAMPLES[depth];
      expect(rows.length, depth).toBeGreaterThan(0);
      expect(new Set(rows).size, depth).toBe(rows.length);
      expect(rows.length, depth).toBeLessThanOrEqual(
        depth === '13' ? 18 : Math.min(12, FIRST_LAYER_SOLVED_SECOND_LAYER_COUNTS[depth]),
      );
    }
    expect(FIRST_LAYER_SOLVED_SECOND_LAYER_EXAMPLES['13']).toHaveLength(18);
  });

  it('全部离线打乱都保持第一层，且打乱长度等于所属步数档', async () => {
    const [{ Alg }, { cube3x3x3 }] = await Promise.all([
      import('cubing/alg'),
      import('cubing/puzzles'),
    ]);
    const kpuzzle = await cube3x3x3.kpuzzle();
    for (const [depth, rows] of Object.entries(FIRST_LAYER_SOLVED_SECOND_LAYER_EXAMPLES)) {
      for (const scramble of rows) {
        expect([...new Alg(scramble).experimentalLeafMoves()]).toHaveLength(Number(depth));
        const data = kpuzzle.defaultPattern().applyAlg(scramble).patternData;
        const corners = data.CORNERS as unknown as { pieces: number[]; orientation: number[] };
        const edges = data.EDGES as unknown as { pieces: number[]; orientation: number[] };
        for (const i of [4, 5, 6, 7]) {
          expect(corners.pieces[i], `${depth}:${scramble}`).toBe(i);
          expect(corners.orientation[i], `${depth}:${scramble}`).toBe(0);
        }
        // cubing.js edge order = U layer 0..3, D layer 4..7, middle 8..11
        // (Rust solver order differs:middle 0..3, U 4..7, D 8..11).
        for (const i of [4, 5, 6, 7]) {
          expect(edges.pieces[i], `${depth}:${scramble}`).toBe(i);
          expect(edges.orientation[i], `${depth}:${scramble}`).toBe(0);
        }
        if (depth !== '0') {
          expect([8, 9, 10, 11].every((i) => edges.pieces[i] === i && edges.orientation[i] === 0),
            `${depth}:${scramble} must still need second-layer work`).toBe(false);
        }
      }
    }
  });

  it('LBL 保留真实条件阶段，但不再把 std 数据伪装成第二层', () => {
    expect(VARIANT_LABEL.lbl).toEqual({ zh: '层先', en: 'LBL' });
    expect(VARIANT_ORDER).toContain('lbl');
    expect(VARIANT_STAGES.second_layer).toEqual(['second_layer']);
    expect(variantDataRef('second_layer', 'second_layer')).toEqual({
      variant: 'second_layer', stage: 'second_layer', recentMetric: 'second_layer',
    });
    expect(variantDataRef('lbl', 'second_layer')).toEqual({
      variant: 'second_layer', stage: 'second_layer', recentMetric: 'second_layer',
    });
    expect(uiVariantOf('second_layer')).toBe('lbl');
    expect(uiVariantOptions((v) => v === 'std')).not.toContain('lbl');
    expect(uiVariantOptions((v) => v === 'second_layer')).toContain('lbl');
    expect(VARIANT_STAGES.lbl).toEqual(['daisy', 'first_face', 'first_layer', 'second_layer']);
    expect(VARIANT_STAGES.lbl.map((s) => stageLabel(s, true))).toEqual(['小花', '底面', '底层', '第二层']);
    expect(dataVariantOfStage('lbl', 'second_layer')).toBe('second_layer');
  });

  it('从其他数据集带来的旧方法和阶段会在渲染当帧归一为第二层', () => {
    const variants = { second_layer: { stages: ['second_layer'] } };
    expect(normalizeVariantDataRef(variants, 'std', 'cross')).toEqual({
      variant: 'second_layer', stage: 'second_layer', recentMetric: 'second_layer',
    });
    expect(normalizeVariantDataRef(variants, 'lbl', 'cross')).toEqual({
      variant: 'second_layer', stage: 'second_layer', recentMetric: 'second_layer',
    });
    expect(normalizeVariantDataRef(variants, 'second_layer', 'cross')).toEqual({
      variant: 'second_layer', stage: 'second_layer', recentMetric: 'second_layer',
    });
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
    expect(page).toContain('FIRST_LAYER_SOLVED_SECOND_LAYER_EXAMPLES[String(selectedBin)]');
    expect(page).toContain('isFirstLayerSolved ? setSelectedBin : handleBarClick');
    // 深链 / 旧设置可能残留 UI 聚合键 lbl。页面必须先用真实数据键渲染 options,
    // 再把 URL 规范化,不能让原生 select 出现 value 存在但 option 为空的白框。
    expect(page).toContain('normalizeVariantDataRef(currentSet.variants, variant, stage)');
    expect(page).toContain('value={sourceStage}');

    const variants = readScrambleJob('src/variants.ts');
    const recent = readScrambleJob('src/build_recent_scrambles.ts');
    const compSteps = readScrambleJob('src/build_comp_steps.ts');
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
