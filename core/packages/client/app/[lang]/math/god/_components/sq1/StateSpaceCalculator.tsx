'use client';

/**
 * SQ1 状态空间计算器:Mike Godfrey 的"单大圆"双射计数。
 *
 * C 个角块(各占 2 槽)+ E 个棱块(各占 1 槽)排成一个 2C+E 槽的大圆,
 * 不同位置数(忽略中层)= 4×(C+E−1)! / (2C+E);含中层翻转再 ×2。
 * 标准 SQ1 即 C=E=8: 8×15!/24 = 15!/3 = 435,891,456,000。
 *
 * 大数会溢出 JS number(19! > 2^53),故全程用 BigInt 精确计算,
 * 自写千位逗号格式化。来源 jaapsch.net/puzzles/square1p.htm。
 */
import { useMemo, useState } from 'react';
import { STATE_SPACE } from './sq1_data';
import { TeX, TeXBlock } from './Tex';

/** BigInt 阶乘(n ≥ 0)。 */
function fact(n: number): bigint {
  let acc = 1n;
  for (let i = 2; i <= n; i++) acc *= BigInt(i);
  return acc;
}

/** 千位逗号格式化(BigInt,toLocaleString 不可靠故手写)。 */
function groupBig(n: bigint): string {
  const neg = n < 0n;
  let s = (neg ? -n : n).toString();
  let out = '';
  while (s.length > 3) {
    out = ',' + s.slice(-3) + out;
    s = s.slice(0, -3);
  }
  out = s + out;
  return neg ? '-' + out : out;
}

interface WedgeSlot {
  kind: 'corner' | 'edge';
  /** 起始单位槽下标(0..2C+E-1) */
  start: number;
  /** 占用单位槽数:角 2、棱 1 */
  span: number;
}

/** 极坐标 → 笛卡尔(SVG y 向下,角从 12 点钟顺时针)。 */
function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

/** 一个环形扇区 path(从 rInner 到 rOuter,deg0→deg1)。 */
function annularSector(
  cx: number,
  cy: number,
  rInner: number,
  rOuter: number,
  deg0: number,
  deg1: number,
): string {
  const [ox0, oy0] = polar(cx, cy, rOuter, deg0);
  const [ox1, oy1] = polar(cx, cy, rOuter, deg1);
  const [ix1, iy1] = polar(cx, cy, rInner, deg1);
  const [ix0, iy0] = polar(cx, cy, rInner, deg0);
  const large = deg1 - deg0 > 180 ? 1 : 0;
  return [
    `M ${ox0.toFixed(2)} ${oy0.toFixed(2)}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${ox1.toFixed(2)} ${oy1.toFixed(2)}`,
    `L ${ix1.toFixed(2)} ${iy1.toFixed(2)}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${ix0.toFixed(2)} ${iy0.toFixed(2)}`,
    'Z',
  ].join(' ');
}

export default function StateSpaceCalculator({ isZh }: { isZh: boolean }) {
  const t = (zh: string, en: string) => (isZh ? zh : en);

  const [C, setC] = useState(8);
  const [E, setE] = useState(8);

  const { slots, slotCount, includeMid, ignoreMid, factStr } = useMemo(() => {
    const slotCount = 2 * C + E; // 2C+E 单位槽
    const f = fact(C + E - 1); // (C+E−1)!
    const denom = BigInt(slotCount);
    const includeMid = (8n * f) / denom;
    const ignoreMid = (4n * f) / denom;

    // 角块在前(各占 2 槽),棱块在后(各占 1 槽),沿圆周连续排布
    const slots: WedgeSlot[] = [];
    let cursor = 0;
    for (let i = 0; i < C; i++) {
      slots.push({ kind: 'corner', start: cursor, span: 2 });
      cursor += 2;
    }
    for (let i = 0; i < E; i++) {
      slots.push({ kind: 'edge', start: cursor, span: 1 });
      cursor += 1;
    }
    return { slots, slotCount, includeMid, ignoreMid, factStr: `${C + E - 1}!` };
  }, [C, E]);

  const isStandard = C === 8 && E === 8;

  // ── SVG 单大圆 ──────────────────────────────────────────────
  const VB = 320;
  const cx = VB / 2;
  const cy = VB / 2;
  const rOuter = 138;
  const rInnerCorner = 86; // 角块更宽(径向更深)
  const rInnerEdge = 102; // 棱块更窄
  const degPerUnit = 360 / slotCount;
  const padDeg = Math.min(degPerUnit * 0.12, 1.6); // 楔块间留缝

  return (
    <div className="sq1-panel">
      <div className="sq1-panel-title">
        {t('状态空间计算器', 'State-space calculator')}
      </div>
      <div className="sq1-panel-sub">
        {t(
          'Godfrey 的"单大圆"双射:把 C 个角块(各 2 槽)和 E 个棱块(各 1 槽)排成一个 2C+E 槽的圆。拖动滑块改变 C / E,精确位置数用 BigInt 实时算出。',
          'Godfrey’s single-big-circle bijection: arrange C corners (2 slots each) and E edges (1 slot each) on one ring of 2C+E slots. Drag the sliders; the exact count is computed live with BigInt.',
        )}
      </div>

      {/* ── 滑块 ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, margin: '6px 0 14px' }}>
        <div style={{ flex: '1 1 220px', minWidth: 180 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '0.85rem',
              marginBottom: 4,
              color: 'var(--sq1-text-sub)',
            }}
          >
            <span>
              {t('角块', 'Corners')}{' '}
              <TeX src={String.raw`C`} />
            </span>
            <span className="sq1-mono" style={{ color: 'var(--sq1-accent)', fontWeight: 700 }}>
              {C}
            </span>
          </div>
          <input
            type="range"
            className="sq1-range"
            min={2}
            max={12}
            step={1}
            value={C}
            onChange={(e) => setC(Number(e.target.value))}
            aria-label={t('角块数 C', 'corner count C')}
          />
        </div>

        <div style={{ flex: '1 1 220px', minWidth: 180 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '0.85rem',
              marginBottom: 4,
              color: 'var(--sq1-text-sub)',
            }}
          >
            <span>
              {t('棱块', 'Edges')}{' '}
              <TeX src={String.raw`E`} />
            </span>
            <span className="sq1-mono" style={{ color: 'var(--sq1-info)', fontWeight: 700 }}>
              {E}
            </span>
          </div>
          <input
            type="range"
            className="sq1-range"
            min={2}
            max={12}
            step={1}
            value={E}
            onChange={(e) => setE(Number(e.target.value))}
            aria-label={t('棱块数 E', 'edge count E')}
          />
        </div>
      </div>

      {/* ── 公式(代入当前 C, E, 2C+E)── */}
      <TeXBlock
        src={String.raw`\frac{8 \cdot (${C}+${E}-1)!}{2\cdot${C}+${E}} = \frac{8 \cdot ${factStr}}{${slotCount}}`}
      />

      {/* ── 结果行 ── */}
      <div className="sq1-result-row">
        <span className="sq1-result-label">
          {t('含中层翻转 (×2)', 'Include middle layer (×2)')}
        </span>
        <span className="sq1-result-val sq1-mono">{groupBig(includeMid)}</span>
      </div>
      <div className="sq1-result-row">
        <span className="sq1-result-label">
          {t('忽略中层', 'Ignore middle layer')}
        </span>
        <span className="sq1-result-val sq1-mono">{groupBig(ignoreMid)}</span>
      </div>

      {/* ── 标准魔方高亮 ── */}
      {isStandard && (
        <div
          className="sq1-readout"
          style={{
            borderLeft: '3px solid var(--sq1-proven)',
            background: 'color-mix(in srgb, var(--sq1-proven) 12%, transparent)',
            color: 'var(--sq1-text)',
          }}
        >
          {t(
            '这就是真正的 Square-1(C = E = 8):',
            'This is the real Square-1 (C = E = 8): ',
          )}
          <TeX src={String.raw`\frac{15!}{3} = 435{,}891{,}456{,}000`} />{' '}
          {t(
            '不同位置 —— 一个与计步口径无关的纯组合计数。',
            'distinct positions — a count that is independent of any move metric.',
          )}
        </div>
      )}

      {/* ── 单大圆可视化 ── */}
      <svg
        viewBox={`0 0 ${VB} ${VB}`}
        className="sq1-svg"
        style={{ maxWidth: VB }}
        role="img"
        aria-label={t(
          `Godfrey 单大圆:${C} 角块 + ${E} 棱块 = ${slotCount} 个单位槽`,
          `Godfrey single big circle: ${C} corners + ${E} edges = ${slotCount} unit slots`,
        )}
      >
        {/* 底圆参考环 */}
        <circle
          cx={cx}
          cy={cy}
          r={(rOuter + Math.min(rInnerCorner, rInnerEdge)) / 2}
          fill="none"
          stroke="var(--sq1-grid)"
          strokeWidth={1}
          opacity={0.5}
        />
        {slots.map((s, i) => {
          const deg0 = s.start * degPerUnit + padDeg;
          const deg1 = (s.start + s.span) * degPerUnit - padDeg;
          const isCorner = s.kind === 'corner';
          const rInner = isCorner ? rInnerCorner : rInnerEdge;
          const fill = isCorner ? 'var(--sq1-accent)' : 'var(--sq1-info)';
          const d = annularSector(cx, cy, rInner, rOuter, deg0, deg1);
          // 楔块中心放标号
          const midDeg = (deg0 + deg1) / 2;
          const [lx, ly] = polar(cx, cy, (rInner + rOuter) / 2, midDeg);
          return (
            <g key={i}>
              <path
                d={d}
                fill={fill}
                opacity={0.82}
                stroke="var(--sq1-bg)"
                strokeWidth={1}
              />
              {(isCorner || slotCount <= 28) && (
                <text
                  x={lx}
                  y={ly}
                  fontSize={isCorner ? 9 : 8}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="var(--sq1-bg)"
                  fontWeight={700}
                >
                  {isCorner ? 'C' : 'E'}
                </text>
              )}
            </g>
          );
        })}
        {/* 圆心读数 */}
        <text
          x={cx}
          y={cy - 8}
          fontSize={13}
          textAnchor="middle"
          fill="var(--sq1-text)"
          fontWeight={700}
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {slotCount} {t('槽', 'slots')}
        </text>
        <text x={cx} y={cy + 10} fontSize={10} textAnchor="middle" fill="var(--sq1-accent)">
          {C} {t('角', 'corners')}
        </text>
        <text x={cx} y={cy + 24} fontSize={10} textAnchor="middle" fill="var(--sq1-info)">
          {E} {t('棱', 'edges')}
        </text>
      </svg>

      <p className="sq1-caption">
        {t(
          `把 ${C} 个角块(每个占 2 个相邻槽)和 ${E} 个棱块(每个占 1 槽)排成一圈,共 ${slotCount} = 2×${C}+${E} 个单位槽。圆周的旋转对称使总排列数除以 2C+E;${factStr} 计的是 C+E 个块在圆上的环排列。`,
          `The ${C} corners (2 adjacent slots each) and ${E} edges (1 slot each) sit on a ring of ${slotCount} = 2×${C}+${E} unit slots. Rotational symmetry of the ring divides the arrangements by 2C+E; ${factStr} counts the circular orderings of the C+E pieces.`,
        )}
      </p>

      {/* ── 公式定义块 ── */}
      <div style={{ marginTop: 16 }}>
        <div className="sq1-panel-title" style={{ fontSize: '0.88rem' }}>
          {t('计数公式', 'The counting formula')}
        </div>
        <TeXBlock src={String.raw`N_{\text{distinct}} = \frac{8\,(C+E-1)!}{2C+E}`} />
        <p className="sq1-caption" style={{ marginTop: 0 }}>
          {t(
            '系数里的 ×2 来自中层可整体翻转(去掉它系数减半,即 15!/6);其余常数来自 Godfrey 双射——把 C+E 个块在 2C+E 槽大圆上的环排列折算成上下两层的合法分布。',
            'The ×2 comes from the middle layer\'s whole flip (drop it and the constant halves, giving 15!/6); the rest follows from Godfrey\'s bijection between circular orderings of the C+E pieces on the 2C+E-slot ring and valid two-layer distributions.',
          )}
        </p>
      </div>

      {/* ── 标准魔方各口径计数表 ── */}
      <div style={{ marginTop: 18 }}>
        <div className="sq1-panel-title" style={{ fontSize: '0.88rem' }}>
          {t('标准 Square-1 的几种循环计数', 'Circulating counts for the standard Square-1')}
        </div>
        <div className="sq1-table-wrap">
          <table className="sq1-table">
            <thead>
              <tr>
                <th>{t('口径', 'Count')}</th>
                <th>{t('数值', 'Value')}</th>
                <th>{t('说明', 'Meaning')}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{t('不同位置', 'Distinct')}</td>
                <td className="sq1-td-strong sq1-mono">{STATE_SPACE.distinct}</td>
                <td>
                  {t(
                    '严格去重后的真实位置数,等于 15!/3,即 C=E=8 时本计算器的"含中层"结果。',
                    'The rigorous deduplicated position count = 15!/3 — the include-middle result here when C=E=8.',
                  )}
                </td>
              </tr>
              <tr>
                <td>{t('原始(未完全约商)', 'Raw')}</td>
                <td className="sq1-td-strong sq1-mono">{STATE_SPACE.raw}</td>
                <td>
                  {t(
                    '170 × 2 × 8! × 8!,按"配对形状 × 中层 × 上下层排列"直乘,旋转未完全约去。',
                    '170 × 2 × 8! × 8! — pairings × middle × two-layer permutations, before fully quotienting rotations.',
                  )}
                </td>
              </tr>
              <tr>
                <td>{t('计朝向', 'With orientations')}</td>
                <td className="sq1-td-strong sq1-mono">{STATE_SPACE.rotationsDistinct}</td>
                <td>
                  {t(
                    '19305 × 2 × 8! × 8!,把每个整体朝向都当作不同状态来数。',
                    '19305 × 2 × 8! × 8! — every whole-cube orientation counted as a separate state.',
                  )}
                </td>
              </tr>
              <tr>
                <td>{t('可切位置', 'Twistable')}</td>
                <td className="sq1-td-strong sq1-mono">{STATE_SPACE.twistable}</td>
                <td>
                  {t(
                    '3678 × 2 × 8! × 8!,允许做 "/" 切片的位置(面转 BFS 的搜索空间)。',
                    '3678 × 2 × 8! × 8! — positions where a "/" slice is possible (the face-turn BFS search space).',
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="sq1-caption">
          {t(
            `形状统计:单层 ${STATE_SPACE.shapes.singleLayer} 种、配对 ${STATE_SPACE.shapes.pairings} 种、立方体形 ${STATE_SPACE.shapes.cube} 种、可切 ${STATE_SPACE.shapes.twistable} 种。`,
            `Shape tallies: ${STATE_SPACE.shapes.singleLayer} single-layer, ${STATE_SPACE.shapes.pairings} pairings, ${STATE_SPACE.shapes.cube} cube-shaped, ${STATE_SPACE.shapes.twistable} twistable.`,
          )}
        </p>
      </div>
    </div>
  );
}
