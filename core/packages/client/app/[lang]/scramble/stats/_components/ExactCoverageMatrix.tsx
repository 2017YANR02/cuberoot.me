'use client';

/**
 * 精确穷举分布的覆盖矩阵 —— 全部 39 个阶段 × 底色档 × 帧档。
 *
 * 阶段行与方法/阶段下拉逐项相同(菜单怎么列,这里就有几行),所以绝大多数格子是空的。
 * 这张表的价值恰恰在空格上:每格说明**有什么、缺什么、缺的那部分卡在哪**,以及那一格的坐标
 * 空间有多大 —— 「没算」和「算不动」是两件事,「算不动」和「不适用」又是两件事。
 *
 * 五态:
 *   完整分布  可点,跳到上方图表的那一格
 *   仅 0 步   同样可点(那一格上方会说明只有端点数);另显示状态数 + 完整分布卡在哪
 *   待跑      算法与代码就位,只差机时 —— 单元号见 solver/EXACT_DIST_EXPANSION.md
 *   有路线    路线清楚、代码还没写
 *   够不着    现有硬件够不着,写清楚要多少
 *   不适用    该阶段没有这个帧档(十字没有 F2L 槽;XCross 只解 1 槽,谈不上相邻/对角)
 *
 * 可点的格子是真 `<a>`(href 由 page.tsx 的 exactHref 拼,带锚点回图表),不是 button + JS:
 * 中键 / Ctrl 点得能开新标签,地址也得复制得出去。
 */

import Link from '@/components/AppLink';
import { tr, useLang } from '@/i18n/tr';
import { stageLabel, uiVariantOf, variantLabel } from '@/lib/scramble-variants';
import {
  COLORS_LABEL, EXACT_COLOR_KEYS, EXACT_DIST, EXACT_STAGES, EXACT_STAGE_VARIANT,
  FRAME_NOTE, FRAME_STATES, SLOT_LABEL, SLOT_OK,
  compactExact, groupDigits, isColorFreeCell, isSlotApplicable, pendingCell,
  type ExactColors, type ExactFull, type ExactPending, type ExactSlot, type ExactStage,
} from '../_data/exact_dist';
import './exact-coverage.css';

/**
 * 列 = (帧档, 底色)组合。固定帧那三档**没有底色维度**(`isColorFreeCell`):固定一个帧之后
 * 底色就没有自由度了 —— 换个底色就是换个帧,同一条曲线。故各只出一列,数据也只存一份
 * (存储键 `W`,不读作「单色底」);列头因此不标底色,标的是帧本身。
 */
const COLUMNS: Array<{ slot: ExactSlot; colors: ExactColors }> = [
  ...EXACT_COLOR_KEYS.map((colors) => ({ slot: 'unfixed' as ExactSlot, colors })),
  { slot: 'fixed1', colors: 'W' },
  { slot: 'adj', colors: 'W' },
  { slot: 'diag', colors: 'W' },
];

const PENDING_LABEL: Record<ExactPending['feasible'], { zh: string; en: string }> = {
  ready: { zh: '待跑', en: 'Ready to run' },
  plan: { zh: '有路线', en: 'Route only' },
  oor: { zh: '够不着', en: 'Out of reach' },
};

interface Props {
  /** 当前图表选中的格子,用于高亮。 */
  stage: string;
  slot: string;
  colors: ExactColors | null;
  /** 该格的深链(带锚点回图表)。 */
  hrefOf: (stage: ExactStage, slot: ExactSlot, colors: ExactColors) => string;
}

/**
 * 四个底色档的「取最优帧」经常是同一句死因(多帧取最优 → 整只魔方),四格照抄四遍只会把表变成
 * 一堵字墙。同一行里这四格若都没数据且完全同话,合成一格横跨四列 —— 说的还是那件事,只说一遍。
 * 有一格有数据就不合并:那一行的看点正是「哪个底色档算得出来」。
 */
function bestColsMerge(st: ExactStage): ExactPending | null {
  if (!isSlotApplicable(st, 'unfixed')) return null;
  const cells = EXACT_COLOR_KEYS.map((c) => EXACT_DIST[st].unfixed?.[c] ?? pendingCell(st, 'unfixed'));
  const first = cells[0];
  if (first.kind !== 'todo') return null;
  const same = cells.every((x) => x.kind === 'todo'
    && x.feasible === first.feasible && x.states === first.states
    && x.unit === first.unit && x.note.zh === first.note.zh);
  return same ? first : null;
}

/** 连续同 UI 方法的行数 —— 方法列用 rowSpan 合并。 */
function variantGroups(): Array<{ variant: string; stages: ExactStage[] }> {
  const out: Array<{ variant: string; stages: ExactStage[] }> = [];
  for (const st of EXACT_STAGES) {
    const v = uiVariantOf(EXACT_STAGE_VARIANT[st]);
    const last = out[out.length - 1];
    if (last && last.variant === v) last.stages.push(st);
    else out.push({ variant: v, stages: [st] });
  }
  return out;
}

export default function ExactCoverageMatrix({ stage, slot, colors, hrefOf }: Props) {
  const isZh = useLang() === 'zh';
  const groups = variantGroups();

  return (
    <div className="exact-cov">
      <div className="exact-cov-head">
        <h3>{tr({ zh: '覆盖矩阵', en: 'Coverage matrix' })}</h3>
        <p>
          {tr({
            zh: '行与方法 / 阶段下拉逐项相同。每格说明有什么、缺什么、缺的那部分卡在哪。'
              + '有数据的格子(绿、黄)都能点,点了跳到上方图表的那一格。',
            en: 'One row per entry in the method / stage pickers. Each cell states what exists, what is missing, '
              + 'and what blocks it. Cells with data (green, amber) link to that cell in the chart above.',
          })}
        </p>
      </div>

      {/* 宽表在自己的容器里横滚 —— 页面本身不允许横向滚动 */}
      <div className="exact-cov-scroll">
        <table className="exact-cov-table">
          <thead>
            <tr>
              <th scope="col" className="exact-cov-rowhead">
                {tr({ zh: '方法', en: 'Method' })}
              </th>
              <th scope="col" className="exact-cov-rowhead">
                {tr({ zh: '阶段', en: 'Stage' })}
              </th>
              {/* 取最优帧:底色档是主标(它决定对多少个帧取 min)。固定帧:没有底色维度,
                  主标就是帧档本身,副标说明这一列对四档底色通用。 */}
              {COLUMNS.map(({ slot: sl, colors: c }) => (
                <th scope="col" key={`${sl}-${c}`}>
                  <span className="exact-cov-colmain">
                    {sl === 'unfixed' ? tr(COLORS_LABEL[c]) : tr(SLOT_LABEL[sl])}
                  </span>
                  <span className="exact-cov-colsub">
                    {sl === 'unfixed'
                      ? tr(SLOT_LABEL[sl])
                      : tr({ zh: '不分底色', en: 'any colour' })}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => g.stages.map((st, i) => (
              <tr key={st} className={i === 0 ? 'exact-cov-group-start' : undefined}>
                {i === 0 && (
                  <th scope="row" rowSpan={g.stages.length} className="exact-cov-rowhead exact-cov-variant">
                    {variantLabel(g.variant, isZh)}
                  </th>
                )}
                <th scope="row" className="exact-cov-rowhead">
                  <span className="exact-cov-stage">{stageLabel(st, isZh)}</span>
                  {FRAME_STATES[st] && (
                    <span className="exact-cov-space">
                      {tr({ zh: '定帧 ', en: 'frame ' })}{compactExact(FRAME_STATES[st])}
                    </span>
                  )}
                </th>
                {COLUMNS.map(({ slot: sl, colors: c }, ci) => {
                  const key = `${st}-${sl}-${c}`;
                  const selected = st === stage && sl === slot
                    && (c === colors || isColorFreeCell(st, sl));
                  // 四个「取最优帧」列同话时:第一列画一格横跨四列,其余三列不画。
                  const merged = bestColsMerge(st);
                  if (merged && sl === 'unfixed') {
                    if (ci > 0) return null;
                    return (
                      <td key={key} colSpan={EXACT_COLOR_KEYS.length}>
                        <div className={`exact-cov-cell is-${merged.feasible}`}>
                          <span className="exact-cov-state">{tr(PENDING_LABEL[merged.feasible])}</span>
                          <span className="exact-cov-blocked">
                            {tr(merged.note)}
                            {merged.unit && <b className="exact-cov-unit">{merged.unit}</b>}
                          </span>
                        </div>
                      </td>
                    );
                  }

                  if (!isSlotApplicable(st, sl)) {
                    return (
                      <td key={key}>
                        <div className="exact-cov-cell is-na">
                          <span className="exact-cov-state">{tr({ zh: '不适用', en: 'N/A' })}</span>
                        </div>
                      </td>
                    );
                  }

                  const cell = EXACT_DIST[st][sl]?.[c] ?? pendingCell(st, sl);

                  if (cell.kind === 'todo') {
                    return (
                      <td key={key}>
                        <div className={`exact-cov-cell is-${cell.feasible}`}>
                          <span className="exact-cov-state">{tr(PENDING_LABEL[cell.feasible])}</span>
                          {cell.states && (
                            <span className="exact-cov-val">{groupDigits(cell.states)}</span>
                          )}
                          <span className="exact-cov-blocked">
                            {tr(cell.note)}
                            {cell.unit && <b className="exact-cov-unit">{cell.unit}</b>}
                          </span>
                        </div>
                      </td>
                    );
                  }

                  if (cell.kind === 'full') {
                    const full = cell as ExactFull;
                    return (
                      <td key={key}>
                        <Link
                          className={`exact-cov-cell is-full${selected ? ' is-selected' : ''}`}
                          href={hrefOf(st, sl, c)}
                          prefetch={false}
                          aria-current={selected ? 'true' : undefined}
                        >
                          <span className="exact-cov-state">
                            {tr({ zh: '完整分布', en: 'Full distribution' })}
                          </span>
                          <span className="exact-cov-val">
                            {tr({ zh: `深度 ≤ ${full.counts.length - 1}`, en: `depth ≤ ${full.counts.length - 1}` })}
                          </span>
                          <span className="exact-cov-val">{groupDigits(full.total)}</span>
                          {sl === 'fixed1' && FRAME_NOTE[st] && (
                            <span className="exact-cov-blocked">{tr(FRAME_NOTE[st])}</span>
                          )}
                        </Link>
                      </td>
                    );
                  }

                  return (
                    <td key={key}>
                      <Link
                        className={`exact-cov-cell is-zero${selected ? ' is-selected' : ''}`}
                        href={hrefOf(st, sl, c)}
                        prefetch={false}
                        aria-current={selected ? 'true' : undefined}
                      >
                        <span className="exact-cov-state">
                          {cell.top
                            ? tr({ zh: '只知道两端', en: 'Both ends only' })
                            : tr({ zh: '仅 0 步', en: '0-move count only' })}
                        </span>
                        <span className="exact-cov-val">
                          {tr({ zh: '0 步 ', en: 'd=0 ' })}{groupDigits(cell.zero)}
                        </span>
                        {/* 最深一档:中间跑不动,但极值档的状态数是知道的 —— 这一格里最有信息量的数 */}
                        {cell.top && (
                          <span className="exact-cov-val is-top">
                            {tr({ zh: `${cell.top.depth} 步 `, en: `d=${cell.top.depth} ` })}
                            {groupDigits(cell.top.count)}
                          </span>
                        )}
                        {/* 上游表格给的均值:搬运值,与穷举出来的均值必须看得出区别 */}
                        {cell.refMean !== undefined && (
                          <span className="exact-cov-val is-ref">
                            {tr({ zh: '均值 ≈ ', en: 'mean ≈ ' })}{cell.refMean.toFixed(2)}
                            <em>{tr({ zh: '未证', en: 'unproven' })}</em>
                          </span>
                        )}
                        <span className="exact-cov-blocked">{tr(cell.blocked)}</span>
                      </Link>
                    </td>
                  );
                })}
              </tr>
            )))}
          </tbody>
        </table>
      </div>

      <ul className="exact-cov-legend">
        <li>
          <b className="is-full">{tr({ zh: '完整分布', en: 'Full distribution' })}</b>
          {tr({
            zh: `${countKind('full')} 个组合 —— 整个状态空间穷举 BFS,逐深度精确计数`,
            en: `${countKind('full')} combinations — exhaustive BFS over the whole state space, exact per-depth counts`,
          })}
        </li>
        <li>
          <b className="is-zero">{tr({ zh: '只有端点', en: 'Endpoints only' })}</b>
          {tr({
            zh: `${countKind('zero')} 个组合 —— 0 步状态数由容斥算出,完整分布受内存或金标所限未算;`
              + '六色底 XCross 另有最深一档(10 步 438 个)由上游穷举搜索给出',
            en: `${countKind('zero')} combinations — the 0-move count comes from inclusion-exclusion and the full `
              + 'distribution is blocked by memory or by the lack of a trusted ground truth; colour-neutral '
              + 'XCross additionally has its deepest bin (438 states at 10 moves) from an upstream exhaustive search',
          })}
        </li>
        <li>
          <b className="is-ready">{tr(PENDING_LABEL.ready)}</b>
          {tr({
            zh: `${countPending('ready')} 个组合 —— 算法与代码都就位,只差机时;单元号见 solver/EXACT_DIST_EXPANSION.md`,
            en: `${countPending('ready')} combinations — algorithm and code are in place, only machine time is missing; `
              + 'see solver/EXACT_DIST_EXPANSION.md for the unit ids',
          })}
        </li>
        <li>
          <b className="is-plan">{tr(PENDING_LABEL.plan)}</b>
          {tr({
            zh: `${countPending('plan')} 个组合 —— 路线清楚,代码还没写`,
            en: `${countPending('plan')} combinations — the route is clear, the code is not written`,
          })}
        </li>
        <li>
          <b className="is-oor">{tr(PENDING_LABEL.oor)}</b>
          {tr({
            zh: `${countPending('oor')} 个组合 —— 现有硬件够不着,格子里写了要多少;四个底色档同话时并成一格`,
            en: `${countPending('oor')} combinations — beyond the hardware at hand; each cell says by how much, and the four colour tiers merge into one cell when the reason is the same`,
          })}
        </li>
        <li>
          <b className="is-na">{tr({ zh: '不适用', en: 'N/A' })}</b>
          {tr({
            zh: '该阶段没有这个帧档,帧档下拉里也不会出现这一档',
            en: 'the stage has no such frame mode; the frame picker does not offer it either',
          })}
        </li>
      </ul>
    </div>
  );
}

/** 遍历矩阵真正画出来的格子 —— 图例上的数字与表格永远同源,不手写。 */
function eachDrawnCell(fn: (cell: ReturnType<typeof pendingCell> | NonNullable<ReturnType<typeof cellAt>>) => void) {
  for (const st of EXACT_STAGES) {
    for (const { slot, colors } of COLUMNS) {
      if (!SLOT_OK[st].includes(slot)) continue;
      fn(EXACT_DIST[st][slot]?.[colors] ?? pendingCell(st, slot));
    }
  }
}

const cellAt = (st: ExactStage, slot: ExactSlot, colors: ExactColors) => EXACT_DIST[st][slot]?.[colors];

function countKind(kind: 'full' | 'zero'): number {
  let n = 0;
  eachDrawnCell((cell) => { if (cell.kind === kind) n++; });
  return n;
}

function countPending(feasible: ExactPending['feasible']): number {
  let n = 0;
  eachDrawnCell((cell) => { if (cell.kind === 'todo' && cell.feasible === feasible) n++; });
  return n;
}
