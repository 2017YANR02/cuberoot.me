/**
 * 文字复盘 —— 标注是 /recon 那套认出来的,不是这里写的。
 * =========================================================================
 *
 * 三件事要钉住:
 *
 * 1. **一手不丢、一手不重**:所有行的区间首尾相接、合起来正好是整把。切错了会
 *    在这里红,而不是等到用户发现文字里比表里多一手。
 * 2. **标签真的来自 /recon 的识别器**:cross 行认得出十字颜色,四对行给的是
 *    cubedb 那种两字母配色(GR / OB / …)。这两类纯几何,不查公式库。
 * 3. **十字面认对了**:`crossOnDRotation` 曾经取「第一个四条棱都归位的面」——
 *    F2L 拧完之后侧面也可能凑齐四条(三条是十字/F2L 棱,第四条是碰巧归位的顶层
 *    棱),于是规范化到了错的面,末层指纹全查不中、标签退化成泛 `// OLL`。
 *    这里对着那个真局面钉死正确答案。
 *
 * 末层的精确 case 名(`OLL-F-` / `PLL-T`)要查公式库,而公式库在 API 上 ——
 * 拉不到就跳过那一条并吼一声,拉得到就必须是精确名,不接受泛标签。
 *
 * 用的是和 `f2l_slots.test.ts` / `f2l_slot_reference.test.ts` 同一条真解法。
 */
import { describe, it, expect } from 'vitest';

import { computeF2lSlots } from '@/app/[lang]/timer/_lib/reconstruct/f2l_slots';
import {
  buildReconText, formatReconLine, reconTextForClipboard, reconTextHeader,
} from '@/app/[lang]/timer/_lib/reconstruct/recon_text';
import { computeStageSegments } from '@/app/[lang]/timer/_lib/reconstruct/stage_segments';
import { computeStepMetrics } from '@/app/[lang]/timer/_lib/reconstruct/step_metrics';
import { patternFromAlg } from '@/lib/cube3';
import { crossOnDRotation, detectStage } from '@/lib/stage_detect';
import { loadAlg } from '@cuberoot/shared/alg';

const SCRAMBLE = "D R' D' R B' U' R' F2 L' F2 D' U2 L' D2 F L' B R'";
const SOLUTION = [
  'U', "R'", 'F', "R'", 'B', 'B', 'L',
  'U', 'F', 'F', "R'", 'F', 'F', 'U', 'U', 'R',
  'U', "B'", 'U', 'U', 'B',
  'F', 'L', 'F', "L'", 'F', 'F', "U'", 'F',
  'U', 'U', "L'", 'U', 'L', "U'", "L'", "U'", 'L',
  'U', 'U', 'F', 'U', 'R', "U'", "R'", "F'",
  "U'", 'F', 'F', "U'", 'F', 'F', 'D', 'R', 'R', 'B', 'B', 'U', 'B',
  'B', "D'", 'R', 'R', 'U',
];

const timed = (tokens: string[], stepMs = 200) =>
  tokens.map((m, i) => ({ m, ts: (i + 1) * stepMs }));

const moves = timed(SOLUTION);
const totalMs = moves[moves.length - 1].ts + 300;

function build() {
  const segs = computeStageSegments(SCRAMBLE, moves, totalMs)!;
  const metrics = computeStepMetrics(SCRAMBLE, moves, totalMs)!;
  const slots = computeF2lSlots(SCRAMBLE, moves, totalMs, segs)!;
  return buildReconText({ scramble: SCRAMBLE, moves, totalMs, segs, metrics, slots });
}

/** 同一把,但带上从姿态流推出来的转体(Sprint 28)。 */
function buildWithRotations(rotations: Array<{ tMs: number; token: string; angleRad: number }>) {
  const segs = computeStageSegments(SCRAMBLE, moves, totalMs)!;
  const metrics = computeStepMetrics(SCRAMBLE, moves, totalMs)!;
  const slots = computeF2lSlots(SCRAMBLE, moves, totalMs, segs)!;
  return buildReconText({ scramble: SCRAMBLE, moves, totalMs, segs, metrics, slots, rotations });
}

/** 公式库在 API 上。拉不到(离线 / API 挂了)就跳过依赖它的那一条,并吼一声。 */
async function algDbUp(): Promise<boolean> {
  try { await loadAlg('3x3', 'oll'); return true; } catch { return false; }
}

describe('buildReconText', () => {
  it('七行:十字 + 四对 + OLL + PLL,顺序就是拧的顺序', async () => {
    const r = await build();
    expect(r.lines.map(l => l.key)).toEqual([
      'cross', 'slot-BR', 'slot-BL', 'slot-FR', 'slot-FL', 'oll', 'pll',
    ]);
    expect(r.lines.map(l => l.kind)).toEqual([
      'cross', 'f2l', 'f2l', 'f2l', 'f2l', 'oll', 'pll',
    ]);
  });

  it('区间首尾相接,合起来正好是整把,一手不丢一手不重', async () => {
    const r = await build();
    expect(r.lines[0].fromIdx).toBe(0);
    for (let i = 1; i < r.lines.length; i++) {
      expect(r.lines[i].fromIdx).toBe(r.lines[i - 1].toIdx + 1);
    }
    expect(r.lines[r.lines.length - 1].toIdx).toBe(SOLUTION.length - 1);
    // 记号已按 HTM 合并,所以不能和 SOLUTION 比长度;比合并后的整条。
    expect(r.lines.flatMap(l => l.moves).join(' ')).toBe(
      "U R' F R' B2 L"
      + " U F2 R' F2 U2 R"
      + " U B' U2 B"
      + " F L F L' F2 U' F"
      + " U2 L' U L U' L' U' L"
      + " U2 F U R U' R' F'"
      + " U' F2 U' F2 D R2 B2 U B2 D' R2 U",
    );
  });

  it('标注来自 /recon 的识别器:十字带颜色,四对给 cubedb 的两字母配色', async () => {
    const r = await build();
    const label = (k: string) => r.lines.find(l => l.key === k)?.label ?? null;
    expect(label('cross')).toBe('Y cross');
    expect(label('slot-BR')).toBe('BR');
    expect(label('slot-BL')).toBe('BO');
    expect(label('slot-FR')).toBe('RG');
    expect(label('slot-FL')).toBe('OG');
  });

  it('十字面认的是 D,不是碰巧凑齐四条棱的侧面(回归:末层标签退化成泛 OLL)', async () => {
    // F2L 拧完那一刻的局面。中心没动过 → 正确答案是「不用转」。
    const p = await patternFromAlg(`${SCRAMBLE} ${SOLUTION.slice(0, 38).join(' ')}`);
    expect((await detectStage(p)).stage).toBe('f2l');
    expect(await crossOnDRotation(p)).toBe('');
  });

  it('末层给精确 case 名,不是泛 OLL / PLL', async () => {
    if (!await algDbUp()) {
      console.warn('[recon_text] 公式库拉不到,跳过末层 case 名这一条');
      return;
    }
    const r = await build();
    expect(r.lines.find(l => l.key === 'oll')?.label).toBe('OLL-F-');
    expect(r.lines.find(l => l.key === 'pll')?.label).toBe('PLL-T');
  });

  it('渲染成一行:动作 + // 标签 + (识别+执行)', async () => {
    const r = await build();
    const cross = r.lines.find(l => l.key === 'cross')!;
    expect(formatReconLine(cross)).toBe("U R' F R' B2 L // Y cross (0.200+1.000)");
    const slot = r.lines.find(l => l.key === 'slot-BR')!;
    expect(formatReconLine(slot)).toBe("U F2 R' F2 U2 R // BR (0.400+1.400)");
  });

  it('没有标签的行只剩动作,不留一个空的 //', async () => {
    expect(formatReconLine({
      kind: 'f2l', key: 'x', moves: ['R', "U'"], fromIdx: 0, toIdx: 1,
      label: null, recognitionMs: 100, executionMs: 200, stepMs: 300,
    })).toBe("R U'");
  });

  it('头一行报 HTM 和 TPS,和分步分析表同一口径', async () => {
    const r = await build();
    expect(r.turns).toBe(50);
    expect(r.seconds).toBeCloseTo(13.1, 3);
    expect(reconTextHeader(r)).toBe('50 HTM / 13.10s = 3.82 TPS');
  });

  it('剪贴板那份:头 + 打乱 + 空行 + 谱子', async () => {
    const r = await build();
    const lines = reconTextForClipboard(r).split('\n');
    expect(lines[0]).toBe(reconTextHeader(r));
    expect(lines[1]).toBe(SCRAMBLE);
    expect(lines[2]).toBe('');
    expect(lines.length).toBe(3 + r.lines.length);
  });

  it('拧到一半:只写走到的那几行,不为没到的一步编一行', async () => {
    const partial = timed(SOLUTION.slice(0, 21));
    const pTotal = 21 * 200 + 300;
    const segs = computeStageSegments(SCRAMBLE, partial, pTotal)!;
    const metrics = computeStepMetrics(SCRAMBLE, partial, pTotal);
    const slots = computeF2lSlots(SCRAMBLE, partial, pTotal, segs)!;
    const r = await buildReconText({
      scramble: SCRAMBLE, moves: partial, totalMs: pTotal, segs, metrics, slots,
    });
    expect(r.lines.map(l => l.key)).toEqual(['cross', 'slot-BR', 'slot-BL']);
    expect(r.lines[r.lines.length - 1].toIdx).toBe(20);
  });

  it('没有动作 → 没有行,不抛', async () => {
    const r = await buildReconText({
      scramble: SCRAMBLE, moves: [], totalMs: 0,
      segs: computeStageSegments(SCRAMBLE, [], 0) ?? ({} as never),
      metrics: null, slots: null,
    });
    expect(r.lines).toEqual([]);
    expect(r.tps).toBeNull();
  });
});

describe('转体织进谱子(Sprint 28)', () => {
  const rot = (tMs: number, token: string) => ({ tMs, token, angleRad: Math.PI / 2 });

  it('不给转体时和以前一模一样 —— 老的把不会因为这个功能变样', async () => {
    const before = await build();
    const after = await buildWithRotations([]);
    expect(after.text).toBe(before.text);
  });

  it('转体按时刻落到对应那一行,并排在它之后第一手的前面', async () => {
    // 第 6 手在 ts=1200(十字最后一手是第 6 个记号);1150 落在十字行倒数第二手前
    const r = await buildWithRotations([rot(1150, 'y')]);
    const cross = r.lines.find(l => l.key === 'cross')!;
    expect(cross.moves).toContain('y');
    // 只进了这一行,别的行不受影响
    expect(r.lines.filter(l => l.moves.includes('y'))).toHaveLength(1);
  });

  it('多个转体各就各位,顺序按时刻', async () => {
    const r = await buildWithRotations([rot(400, 'y'), rot(2400, "x'"), rot(2600, 'z2')]);
    const all = r.lines.flatMap(l => l.moves).filter(m => /^[xyz]/.test(m));
    expect(all).toEqual(['y', "x'", 'z2']);
  });

  it('转体**不计步** —— HTM 和 TPS 一个数都不动', async () => {
    const before = await build();
    const after = await buildWithRotations([rot(400, 'y'), rot(2400, "x'")]);
    expect(after.turns).toBe(before.turns);
    expect(after.tps).toBe(before.tps);
  });

  it('转体不喂给识别器 —— 标签和不带转体时逐行相同', async () => {
    const before = await build();
    const after = await buildWithRotations([rot(400, 'y'), rot(2400, "x'"), rot(9000, 'y2')]);
    expect(after.lines.map(l => l.label)).toEqual(before.lines.map(l => l.label));
  });

  it('比所有动作都晚的转体不丢,挂在最后一行末尾', async () => {
    const r = await buildWithRotations([rot(99999, 'z')]);
    const last = r.lines[r.lines.length - 1];
    expect(last.moves[last.moves.length - 1]).toBe('z');
  });
});
