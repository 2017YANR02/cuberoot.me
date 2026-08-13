/**
 * 训练器当前设置 → 可打印的打乱题单。
 *
 * PDF 与屏幕上的出题规则同源:覆盖模式每个 case 一次,随机模式独立抽题;
 * AUF / y / 纯打乱都交给训练器现有生成器。每格只印编号和打乱,不放 case 名或还原公式。
 */
import type { AlgCase, AlgPuzzle } from '@cuberoot/shared';
import { caseOrbit } from '@/lib/alg_probability';
import type { TrainerMode, TrainerProbMode, TrainerRecapOrder } from '@/lib/trainer-store';
import {
  cstimerStyleScramble,
  f2lFinalAdjustmentVariants,
  generateScramble,
  purifyScramble,
  type F2LFinalAdjustment,
  type ScrambleKind,
  type TrainerScrambleOpts,
} from '@/lib/trainer-scramble';
import type { AlgPdfCase, AlgPdfSheetInput } from './sheet';

type TrainerPdfSheet = Omit<AlgPdfSheetInput, 'onProgress' | 'shouldCancel' | 'theme'>;

export interface TrainerSheetOptions {
  puzzle: AlgPuzzle;
  set: string;
  cases: AlgCase[];
  title: string;
  subtitle?: string;
  filename: string;
  mode: TrainerMode;
  probMode: TrainerProbMode;
  recapOrder: TrainerRecapOrder;
  scrambleKind: ScrambleKind;
  scrambleOpts: TrainerScrambleOpts;
  showThumb: boolean;
  pureScramble: boolean;
  /** 单元测试用;生产默认就是 Math.random。 */
  random?: () => number;
}

function randomIndex(length: number, random: () => number): number {
  return Math.min(Math.floor(random() * length), length - 1);
}

function shuffle<T>(values: readonly T[], random: () => number): T[] {
  const out = [...values];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = randomIndex(i + 1, random);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function weightedCase(cases: readonly AlgCase[], random: () => number): AlgCase {
  const weights = cases.map(c => caseOrbit(c) ?? 16);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let remaining = random() * total;
  for (let i = 0; i < cases.length - 1; i += 1) {
    remaining -= weights[i];
    if (remaining < 0) return cases[i];
  }
  return cases[cases.length - 1];
}

function trainerQuestions(o: TrainerSheetOptions, random: () => number): AlgCase[] {
  if (o.cases.length === 0) return [];
  if (o.mode === 'recap') {
    return o.recapOrder === 'shuffle' ? shuffle(o.cases, random) : [...o.cases];
  }
  if (o.mode === 'memo') return [...o.cases];
  return Array.from({ length: o.cases.length }, () => (
    o.probMode === 'real'
      ? weightedCase(o.cases, random)
      : o.cases[randomIndex(o.cases.length, random)]
  ));
}

function f2lAdjustmentPicker(o: TrainerSheetOptions, random: () => number) {
  const useAuf = o.scrambleOpts.randomFinalAuf === true;
  const useY = o.scrambleOpts.randomFinalY === true;
  if (o.mode !== 'recap' || (!useAuf && !useY)) return () => undefined;

  let bag: F2LFinalAdjustment[] = [];
  let last = '';
  return (): F2LFinalAdjustment | undefined => {
    if (bag.length === 0) {
      bag = shuffle(f2lFinalAdjustmentVariants(useAuf, useY), random);
      const nextIndex = bag.length - 1;
      const next = bag[nextIndex];
      if (nextIndex > 0 && `${next.auf}|${next.y}` === last) {
        [bag[0], bag[nextIndex]] = [bag[nextIndex], bag[0]];
      }
    }
    const adjustment = bag.pop();
    if (adjustment) last = `${adjustment.auf}|${adjustment.y}`;
    return adjustment;
  };
}

export async function trainerSheetFromCases(o: TrainerSheetOptions): Promise<TrainerPdfSheet> {
  const random = o.random ?? Math.random;
  const questions = trainerQuestions(o, random);
  const nextF2LAdjustment = f2lAdjustmentPicker(o, random);
  const out: AlgPdfCase[] = [];

  for (let i = 0; i < questions.length; i += 1) {
    const c = questions[i];
    const adjustment = c.sticker.kind === 'f2l' ? nextF2LAdjustment() : undefined;
    const initial = generateScramble(c, o.puzzle, o.scrambleKind, {
      ...o.scrambleOpts,
      ...(adjustment ? { f2lFinalAdjustment: adjustment } : {}),
    });
    const raw = o.scrambleKind === 'cstimer'
      ? await cstimerStyleScramble(initial) ?? initial
      : initial;
    const shown = o.pureScramble ? purifyScramble(o.puzzle, raw) : raw;
    const firstAlg = c.algs.flat()[0]?.alg ?? c.standard ?? '';

    out.push({
      // 训练题单没有 case 名;编号直接并入打乱,共用排版器便不会预留名称行。
      name: '',
      algs: [`${i + 1}. ${shown}`],
      thumb: o.showThumb
        ? { puzzle: o.puzzle, set: o.set, sticker: c.sticker, alg: firstAlg, setup: raw, size: 160 }
        : undefined,
    });
  }

  return {
    title: o.title,
    subtitle: o.subtitle,
    cases: out,
    filename: o.filename,
  };
}
