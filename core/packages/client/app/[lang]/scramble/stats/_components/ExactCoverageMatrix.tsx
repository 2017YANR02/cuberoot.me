'use client';

/**
 * 精确穷举分布的覆盖矩阵 —— 5 阶段 × 3 底色 × 槽位。
 *
 * 这张表同时是「占坑」的载体:能画图的格子只有 8 个,其余要么只算出了 0 步状态数
 * (完整分布跑不动或无可信金标),要么在该阶段根本不适用。与其在图表区显示一句
 * 「暂无数据」,不如把每格「有什么 / 缺什么 / 缺的那部分卡在哪」直接摊开。
 *
 * 三态:
 *   完整分布  可点,点了把上方图表切到该格
 *   仅 0 步   显示状态数 + 完整分布卡在哪(2.2TB visited / 无可信金标 等)
 *   不适用    该阶段没有这个槽位概念(Cross 无 F2L 槽;XCross 只解 1 槽,谈不上相邻/对角)
 */

import { tr } from '@/i18n/tr';
import {
  COLORS_LABEL, EXACT_COLOR_KEYS, EXACT_DIST, EXACT_STAGES, SLOT_LABEL, SLOT_OK,
  groupDigits, isSlotApplicable,
  type ExactColors, type ExactFull, type ExactSlot, type ExactStage,
} from '../_data/exact_dist';
import './exact-coverage.css';

/** 阶段显示名与 lib/scramble-variants.ts 的 stageLabel 一致,这里只列本组件用到的 5 个。 */
const STAGE_LABEL: Record<ExactStage, string> = {
  cross: 'Cross',
  xcross: 'XCross',
  xxcross: 'XXCross',
  xxxcross: 'XXXCross',
  xxxxcross: 'XXXXCross',
};

/**
 * 列 = (槽位, 底色) 组合。固定槽那几档只有单色底有数据(C++ 端没写双色/六色的固定槽版),
 * 全列出来会得到一张三分之二是空的宽表 —— 故固定槽只出单色底一列。
 */
const COLUMNS: Array<{ slot: ExactSlot; colors: ExactColors }> = [
  ...EXACT_COLOR_KEYS.map((colors) => ({ slot: 'unfixed' as ExactSlot, colors })),
  { slot: 'fixed1', colors: 'W' },
  { slot: 'adj', colors: 'W' },
  { slot: 'diag', colors: 'W' },
];

interface Props {
  /** 当前图表选中的格子,用于高亮。 */
  stage: string;
  slot: string;
  colors: ExactColors | null;
  /** 点「完整分布」格 → 把图表切过去。 */
  onPick: (stage: ExactStage, slot: ExactSlot, colors: ExactColors) => void;
}

export default function ExactCoverageMatrix({ stage, slot, colors, onPick }: Props) {
  return (
    <div className="exact-cov">
      <div className="exact-cov-head">
        <h3>{tr({ zh: '覆盖矩阵', en: 'Coverage matrix' })}</h3>
        <p>
          {tr({
            zh: '每格说明有什么、缺什么、缺的那部分卡在哪。绿格可点,点了把上方图表切过去。',
            en: 'Each cell states what exists, what is missing, and what blocks it. Green cells are clickable and switch the chart above.',
          })}
        </p>
      </div>

      {/* 宽表在自己的容器里横滚 —— 页面本身不允许横向滚动 */}
      <div className="exact-cov-scroll">
        <table className="exact-cov-table">
          <thead>
            <tr>
              <th scope="col" className="exact-cov-rowhead">
                {tr({ zh: '阶段', en: 'Stage' })}
              </th>
              {COLUMNS.map(({ slot: sl, colors: c }) => (
                <th scope="col" key={`${sl}-${c}`}>
                  <span className="exact-cov-colmain">{tr(COLORS_LABEL[c])}</span>
                  <span className="exact-cov-colsub">{tr(SLOT_LABEL[sl])}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {EXACT_STAGES.map((st) => (
              <tr key={st}>
                <th scope="row" className="exact-cov-rowhead">{STAGE_LABEL[st]}</th>
                {COLUMNS.map(({ slot: sl, colors: c }) => {
                  const key = `${st}-${sl}-${c}`;
                  const selected = st === stage && sl === slot && c === colors;

                  if (!isSlotApplicable(st, sl)) {
                    return (
                      <td key={key}>
                        <div className="exact-cov-cell is-na">
                          <span className="exact-cov-state">{tr({ zh: '不适用', en: 'N/A' })}</span>
                        </div>
                      </td>
                    );
                  }

                  const cell = EXACT_DIST[st][sl]?.[c];
                  if (!cell) {
                    return (
                      <td key={key}>
                        <div className="exact-cov-cell is-na">
                          <span className="exact-cov-state">{tr({ zh: '未实现', en: 'Not built' })}</span>
                        </div>
                      </td>
                    );
                  }

                  if (cell.kind === 'full') {
                    const full = cell as ExactFull;
                    return (
                      <td key={key}>
                        <button
                          type="button"
                          className={`exact-cov-cell is-full${selected ? ' is-selected' : ''}`}
                          onClick={() => onPick(st, sl, c)}
                          aria-pressed={selected}
                        >
                          <span className="exact-cov-state">
                            {tr({ zh: '完整分布', en: 'Full distribution' })}
                          </span>
                          <span className="exact-cov-val">
                            {tr({ zh: `深度 ≤ ${full.counts.length - 1}`, en: `depth ≤ ${full.counts.length - 1}` })}
                          </span>
                          <span className="exact-cov-val">{groupDigits(full.total)}</span>
                        </button>
                      </td>
                    );
                  }

                  return (
                    <td key={key}>
                      <div className={`exact-cov-cell is-zero${selected ? ' is-selected' : ''}`}>
                        <span className="exact-cov-state">{tr({ zh: '仅 0 步', en: '0-move count only' })}</span>
                        <span className="exact-cov-val">{groupDigits(cell.zero)}</span>
                        <span className="exact-cov-blocked">{tr(cell.blocked)}</span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="exact-cov-legend">
        <li>
          <b className="is-full">{tr({ zh: '完整分布', en: 'Full distribution' })}</b>
          {tr({
            zh: `${countKind('full')} 项 —— 整个状态空间穷举 BFS,逐深度精确计数`,
            en: `${countKind('full')} of them — exhaustive BFS over the whole state space, exact per-depth counts`,
          })}
        </li>
        <li>
          <b className="is-zero">{tr({ zh: '仅 0 步', en: '0-move count only' })}</b>
          {tr({
            zh: `${countKind('zero')} 项 —— 0 步状态数由容斥算出,完整分布受内存或金标所限未算`,
            en: `${countKind('zero')} of them — the 0-move count comes from inclusion-exclusion; the full distribution is blocked by memory or by the lack of a trusted ground truth`,
          })}
        </li>
        <li>
          <b className="is-na">{tr({ zh: '不适用', en: 'N/A' })}</b>
          {tr({
            zh: '该阶段没有这个槽位概念,槽位下拉里也不会出现这一档',
            en: 'the stage has no such slot notion; the slot picker does not offer it either',
          })}
        </li>
      </ul>
    </div>
  );
}

/** 统计矩阵里各态的格子数 —— 图例上的数字与表格永远同源,不手写。 */
function countKind(kind: 'full' | 'zero'): number {
  let n = 0;
  for (const st of EXACT_STAGES) {
    for (const sl of SLOT_OK[st]) {
      for (const c of EXACT_COLOR_KEYS) {
        if (EXACT_DIST[st][sl]?.[c]?.kind === kind) n++;
      }
    }
  }
  return n;
}
