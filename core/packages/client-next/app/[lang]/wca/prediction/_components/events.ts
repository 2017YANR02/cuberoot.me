// 项目元数据 + 显示配置
import { formatWcaResult } from '@/lib/wca-format-result';
import type { ExpFloorFit } from './models';

export type EventScale = 'cs' | 'moves';

export interface EventMeta {
  id: string;
  name_en: string;
  name_zh: string;
  short: string;       // 给图表标签用的短名
  scale: EventScale;
  /** 平均 = Mo3 (FM/Big BLD) 还是 Ao5 (其他) */
  avgFormat: 'Ao5' | 'Mo3' | 'none';
  /** 排序权重(给 cross-event grid 用)*/
  rank: number;
  /** 该项目的 sub-X 阈值列表 (单位等于 scale, cs=百分秒) */
  subThresholds: number[];
  /** 给关键阈值起昵称(如 sub10 → "Sub 10") */
  subLabel: (t: number) => string;
}

function csLabel(t: number): string {
  const v = t / 100;
  // 给次秒级阈值 (1.5/0.8/0.3 …) 保留 1 位小数, 整数阈值 0 位
  if (v < 60) {
    const s = v.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
    return `Sub ${s}`;
  }
  // 大于 60 秒 → 转 m:ss
  const m = Math.floor(v / 60);
  const s = Math.round(v - m * 60);
  return `Sub ${m}:${s.toString().padStart(2, '0')}`;
}
function movesLabel(t: number): string { return `Sub ${t} moves`; }

export const EVENTS: EventMeta[] = [
  { id: '333',   name_en: '3x3x3',         name_zh: '三阶',     short: '3x3',   scale: 'cs', avgFormat: 'Ao5', rank: 10, subThresholds: [1500, 1200, 1000, 800, 700, 600, 500, 400, 300], subLabel: csLabel
},
  { id: '222',   name_en: '2x2x2',         name_zh: '二阶',     short: '2x2',   scale: 'cs', avgFormat: 'Ao5', rank: 20, subThresholds: [1000, 500, 300, 200, 150, 100, 80], subLabel: csLabel
},
  { id: '444',   name_en: '4x4x4',         name_zh: '四阶',     short: '4x4',   scale: 'cs', avgFormat: 'Ao5', rank: 30, subThresholds: [6000, 4500, 3500, 3000, 2500, 2000, 1700, 1500], subLabel: csLabel
},
  { id: '555',   name_en: '5x5x5',         name_zh: '五阶',     short: '5x5',   scale: 'cs', avgFormat: 'Ao5', rank: 40, subThresholds: [12000, 9000, 7000, 6000, 5000, 4000, 3500, 3000], subLabel: csLabel
},
  { id: '666',   name_en: '6x6x6',         name_zh: '六阶',     short: '6x6',   scale: 'cs', avgFormat: 'Mo3', rank: 50, subThresholds: [25000, 18000, 12000, 10000, 8000, 7000, 6000], subLabel: csLabel
},
  { id: '777',   name_en: '7x7x7',         name_zh: '七阶',     short: '7x7',   scale: 'cs', avgFormat: 'Mo3', rank: 60, subThresholds: [40000, 30000, 20000, 15000, 12000, 10000, 9000], subLabel: csLabel
},
  { id: '333bf', name_en: '3x3 Blindfolded', name_zh: '三阶盲拧', short: '3BLD', scale: 'cs', avgFormat: 'Mo3', rank: 70, subThresholds: [12000, 6000, 3000, 2000, 1500, 1200, 1000, 800], subLabel: csLabel
},
  { id: '333fm', name_en: '3x3 Fewest Moves', name_zh: '三阶最少步', short: 'FMC', scale: 'moves', avgFormat: 'Mo3', rank: 80, subThresholds: [40, 30, 25, 22, 20, 19, 18], subLabel: movesLabel
},
  { id: '333oh', name_en: '3x3 One-Handed', name_zh: '三阶单手', short: 'OH',   scale: 'cs', avgFormat: 'Ao5', rank: 90, subThresholds: [3000, 2000, 1500, 1200, 1000, 800, 700, 600], subLabel: csLabel
},
  { id: 'clock', name_en: 'Clock',         name_zh: '魔表',     short: 'Clock', scale: 'cs', avgFormat: 'Ao5', rank: 110, subThresholds: [1500, 1000, 700, 500, 400, 300, 250, 200], subLabel: csLabel
},
  { id: 'minx',  name_en: 'Megaminx',      name_zh: '五魔方',   short: 'Mega',  scale: 'cs', avgFormat: 'Ao5', rank: 120, subThresholds: [10000, 6000, 4500, 3500, 3000, 2700, 2500, 2300], subLabel: csLabel },
  { id: 'pyram', name_en: 'Pyraminx',      name_zh: '金字塔',   short: 'Pyram', scale: 'cs', avgFormat: 'Ao5', rank: 130, subThresholds: [500, 300, 250, 200, 150, 120, 100, 80], subLabel: csLabel },
  { id: 'skewb', name_en: 'Skewb',         name_zh: '斜转',     short: 'Skewb', scale: 'cs', avgFormat: 'Ao5', rank: 140, subThresholds: [800, 500, 300, 200, 150, 120, 100, 80], subLabel: csLabel
},
  { id: 'sq1',   name_en: 'Square-1',      name_zh: 'SQ1',      short: 'SQ1',   scale: 'cs', avgFormat: 'Ao5', rank: 150, subThresholds: [3000, 1500, 1000, 800, 600, 500, 400, 300], subLabel: csLabel },
  { id: '444bf', name_en: '4x4 Blindfolded', name_zh: '四阶盲拧', short: '4BLD', scale: 'cs', avgFormat: 'Mo3', rank: 160, subThresholds: [60000, 30000, 15000, 12000, 9000, 7000, 6000], subLabel: csLabel
},
  { id: '555bf', name_en: '5x5 Blindfolded', name_zh: '五阶盲拧', short: '5BLD', scale: 'cs', avgFormat: 'Mo3', rank: 170, subThresholds: [200000, 100000, 50000, 30000, 20000, 15000, 12000], subLabel: csLabel
},
];

/** scale-aware: 把 raw 值转成显示 (秒/步) — 用于"单次"成绩 */
export function toDisplay(raw: number | null, scale: EventScale): number | null {
  if (raw === null) return null;
  return scale === 'cs' ? raw / 100 : raw;
}

/** scale-aware 平均编码: WCA 把 FMC mean 存为 moves×100, 单次是原步数 */
export function toDisplayAvg(raw: number | null, event: EventMeta): number | null {
  if (raw === null) return null;
  if (event.scale === 'cs') return raw / 100;
  // moves: FMC 平均特例 = raw / 100; 其他 moves 项目无平均
  if (event.id === '333fm') return raw / 100;
  return raw;
}

/** scale-aware 格式化. 走 utils/wca_format_result.ts 的单一入口 (含 FMC single 整数 / avg 两位小数 / cs / MBLD 等编码雷区).
 *  v 是显示单位的值 (秒 / 步), eventId + kind 让 formatWcaResult 选对路径. */
export function formatVal(
  v: number | null | undefined,
  scaleOrEvent: EventScale | EventMeta,
  kind: 'single' | 'average' = 'single',
): string {
  if (v === null || v === undefined || !isFinite(v)) return '–';
  // 兼容旧签名: formatVal(v, scale) → 走旧路径(无 eventId, FMC 不分 kind)
  if (typeof scaleOrEvent === 'string') {
    if (scaleOrEvent === 'moves') return v.toFixed(1) + ' moves';
    if (v >= 60) {
      const m = Math.floor(v / 60);
      const s = v - m * 60;
      return `${m}:${s.toFixed(2).padStart(5, '0')}`;
    }
    return v.toFixed(2) + ' s';
  }
  // 新签名: formatVal(v, event, kind) → 显示值反编码到 raw 后走 formatWcaResult
  const event = scaleOrEvent;
  let raw: number;
  if (event.scale === 'cs') {
    raw = Math.round(v * 100);
  } else if (event.id === '333fm' && kind === 'average') {
    raw = Math.round(v * 100);  // FMC avg: display 19.33 → raw 1933
  } else {
    raw = Math.round(v);          // FMC single / 其他 moves: 原值
  }
  const s = formatWcaResult(raw, event.id, kind);
  if (event.scale === 'moves') return s + ' moves';
  if (s.includes(':')) return s;   // m:ss / h:mm:ss 已带分秒
  return s + ' s';
}

/** 根据当前 fit 给出 milestone 推断: "首次 sub-X 年份" */
export function milestonePredictions(
  fit: ExpFloorFit | null,
  thresholds: number[],
  scale: EventScale,
): Array<{ target: number; year: number | null }> {
  if (!fit) return thresholds.map((t) => ({ target: t, year: null }));
  return thresholds.map((t) => {
    const v = scale === 'cs' ? t / 100 : t;
    if (v <= fit.L) return { target: t, year: null };
    const dy = Math.log(fit.A / (v - fit.L)) / fit.k;
    return { target: t, year: fit.t0 + dy };
  });
}
