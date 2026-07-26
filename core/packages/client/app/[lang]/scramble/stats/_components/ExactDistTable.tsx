'use client';

/**
 * 精确穷举分布的逐档数据表 —— 承载图上放不下的完整数字。
 *
 * 图里柱顶走紧凑写法(12.8B),因为 11~20 位的完整数字在 13 个柱子上会撞成一片;
 * 但这批数据的价值恰恰在于**逐位精确**,所以完整值必须有个地方看得到。两者同源,
 * 都从 counts 的十进制字符串来,不经过 Number。
 *
 * 叠加对照打开时多两列真题数据 + 偏差列 —— 这是「WCA 打乱离均匀随机态有多近」
 * 最直接的读法(单色底 Cross 的最大逐档偏差是 0.07 个百分点)。
 */

import { tr } from '@/i18n/tr';
import { exactRatio, formatExactPct, groupDigits, type ExactFull } from '../_data/exact_dist';
import './exact-dist-table.css';

interface Props {
  cell: ExactFull;
  /** 同 (阶段,底色) 的 WCA 真题经验分布;未开叠加或不可比时为 null。 */
  overlay: Record<string, number> | null;
}

export default function ExactDistTable({ cell, overlay }: Props) {
  const empTotal = overlay
    ? Object.values(overlay).reduce((a, n) => a + n, 0)
    : 0;

  // 最大逐档偏差 —— 表末尾给一句结论,免得用户自己逐行比。
  let maxDiff = 0;
  let maxDiffAt = 0;
  if (overlay && empTotal > 0) {
    cell.counts.forEach((c, d) => {
      const diff = Math.abs(exactRatio(c, cell.total) - (overlay[String(d)] ?? 0) / empTotal);
      if (diff > maxDiff) { maxDiff = diff; maxDiffAt = d; }
    });
  }

  return (
    <div className="exact-table">
      <div className="exact-table-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">{tr({ zh: '深度', en: 'Depth' })}</th>
              <th scope="col">{tr({ zh: '状态数', en: 'States' })}</th>
              <th scope="col">{tr({ zh: '占比', en: 'Share' })}</th>
              {overlay && (
                <>
                  <th scope="col">{tr({ zh: '真题条数', en: 'Scrambles' })}</th>
                  <th scope="col">{tr({ zh: '真题占比', en: 'Observed' })}</th>
                  <th scope="col">{tr({ zh: '偏差', en: 'Diff' })}</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {cell.counts.map((c, d) => {
              const ratio = exactRatio(c, cell.total);
              const empCount = overlay?.[String(d)] ?? 0;
              const empRatio = empTotal > 0 ? empCount / empTotal : 0;
              const diff = (ratio - empRatio) * 100;
              return (
                <tr key={d}>
                  <td>{d}</td>
                  <td className="num">{groupDigits(c)}</td>
                  <td className="num">{formatExactPct(ratio)}</td>
                  {overlay && (
                    <>
                      <td className="num">{empCount.toLocaleString()}</td>
                      <td className="num">{formatExactPct(empRatio)}</td>
                      <td className="num">{`${diff >= 0 ? '+' : ''}${diff.toFixed(4)}`}</td>
                    </>
                  )}
                </tr>
              );
            })}
            <tr className="exact-table-sum">
              <td>{tr({ zh: '合计', en: 'Total' })}</td>
              <td className="num">{groupDigits(cell.total)}</td>
              <td className="num">100%</td>
              {overlay && (
                <>
                  <td className="num">{empTotal.toLocaleString()}</td>
                  <td className="num">100%</td>
                  <td />
                </>
              )}
            </tr>
          </tbody>
        </table>
      </div>

      {overlay && empTotal > 0 && (
        <p className="exact-table-note">
          {tr({
            zh: `最大逐档偏差 ${(maxDiff * 100).toFixed(3)} 个百分点(深度 ${maxDiffAt})—— WCA 打乱与均匀随机态在采样误差内一致。`,
            en: `Largest per-bin gap is ${(maxDiff * 100).toFixed(3)} percentage points (depth ${maxDiffAt}) — WCA scrambles match a uniformly random state within sampling error.`,
          })}
        </p>
      )}
    </div>
  );
}
