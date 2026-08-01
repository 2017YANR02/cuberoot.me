/**
 * /predict 的拼图登记处。
 *
 * 三阶('3')的出题另有引擎(`../challenge.ts`,带十字 / 前两层 / F2L 三档方法学模式),
 * 但它的**展示元数据**(面序、配色、方位名、转动卡片上色)照样从这里取 —— 页面那一半
 * 代码对所有拼图是同一份,别让三阶再抄一遍。
 */
import { makeNxnPuzzle } from './nxn';
import { pyraminxPuzzle } from './pyraminx';
import { skewbPuzzle } from './skewb';
import { ivyPuzzle } from './ivy';
import { megaminxPuzzle } from './megaminx';
import type { PredictPuzzle, PredictPuzzleId } from './types';

export * from './types';

/** 选择器里的顺序:三阶打头(它是这页的原住民),再按阶数,最后是异形。 */
export const PREDICT_PUZZLE_IDS: readonly PredictPuzzleId[] = [
  '3', '2', '4', '5', '6', '7', 'megaminx', 'pyraminx', 'skewb', 'ivy',
];

const NXN_ORDERS = [2, 3, 4, 5, 6, 7] as const;

const REGISTRY: Record<PredictPuzzleId, PredictPuzzle> = {
  ...Object.fromEntries(NXN_ORDERS.map((n) => [String(n), makeNxnPuzzle(n)])) as Record<PredictPuzzleId, PredictPuzzle>,
  megaminx: megaminxPuzzle,
  pyraminx: pyraminxPuzzle,
  skewb: skewbPuzzle,
  ivy: ivyPuzzle,
};

export const getPuzzle = (id: PredictPuzzleId): PredictPuzzle => REGISTRY[id] ?? REGISTRY['3'];

/** 这个拼图的贴纸总数。 */
export const stickerCount = (p: PredictPuzzle): number => p.faces.length * p.perFace;

export const PUZZLE_LABELS: Record<PredictPuzzleId, { zh: string; en: string }> = {
  2: { zh: '二阶', en: '2×2' },
  3: { zh: '三阶', en: '3×3' },
  4: { zh: '四阶', en: '4×4' },
  5: { zh: '五阶', en: '5×5' },
  6: { zh: '六阶', en: '6×6' },
  7: { zh: '七阶', en: '7×7' },
  megaminx: { zh: '五魔方', en: 'Megaminx' },
  pyraminx: { zh: '金字塔', en: 'Pyraminx' },
  skewb: { zh: '斜转', en: 'Skewb' },
  ivy: { zh: '枫叶', en: 'Ivy' },
};
