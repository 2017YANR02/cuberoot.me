'use client';

/**
 * 跳步概率速查表。所有数字来自 lib/skip-probability.ts 的现算结果 ——
 * 本组件一个小数都不写死,只负责排版与分组。
 */
import { useState } from 'react';
import { T, tr } from '@/i18n/tr';
import { groupDigits } from '@/lib/group-digits';
import {
  SKIP_ENTRIES, atLeastKInRound, entryById, exactlyKInRound, oneOver, oneOverRelative, probability,
  type SkipEntry,
} from '@/lib/skip-probability';

const GROUP_LABEL: Record<SkipEntry['group'], { zh: string; en: string }> = {
  ll: { zh: '顶层', en: 'Last layer' },
  cross: { zh: '十字', en: 'Cross' },
  block: { zh: '2×2×2 与 2×2×3 块', en: '2×2×2 and 2×2×3 blocks' },
  roux: { zh: 'Roux', en: 'Roux' },
  '222': { zh: '二阶', en: '2×2' },
  '444': { zh: '四阶中心', en: '4×4 centres' },
  minx: { zh: '五魔顶层', en: 'Megaminx last layer' },
  pyram: { zh: '金字塔', en: 'Pyraminx' },
  sq1: { zh: 'Square-1', en: 'Square-1' },
};

const KIND_LABEL: Record<SkipEntry['kind'], { zh: string; en: string }> = {
  counted: { zh: '数出来的', en: 'counted' },
  exact: { zh: '容斥精确值', en: 'exact' },
  sim: { zh: '模拟值', en: 'simulated' },
};

/** 1/p 的展示:整数就写整数,否则留两位小数。 */
function formatOneOver(v: number): string {
  return Number.isInteger(v) ? groupDigits(String(v)) : groupDigits(v.toFixed(2));
}

const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';

/** 概率跨 13 个数量级,小的那头只能写科学记数法 —— 但写成 `1.4×10⁻¹³%` 而不是 `1.4e-13%`。 */
function pct(p: number): string {
  const v = p * 100;
  if (v >= 0.01) return `${v.toFixed(2)}%`;
  // 十字那一族落在 10⁻⁴ 附近,写成小数比科学记数法好读,同组内也不会一半小数一半指数
  if (v >= 1e-4) return `${Number(v.toPrecision(2))}%`;
  const [m, e] = v.toExponential(1).split('e');
  const exp = String(Math.abs(Number(e))).replace(/\d/g, (d) => SUP[Number(d)]);
  return `${m}×10⁻${exp}%`;
}

export default function SkipTable() {
  const [roundOf, setRoundOf] = useState(5);
  const [pickId, setPickId] = useState('pll');
  const groups: SkipEntry['group'][] = ['ll', 'cross', 'block', 'roux', '222', '444', 'minx', 'pyram', 'sq1'];
  const picked = entryById(pickId);
  const pickedP = probability(picked);

  return (
    <div className="prob-skip">
      <div className="prob-skip-scroll">
        <table className="prob-skip-table">
          <thead>
            <tr>
              <th scope="col">{tr({ zh: '跳步', en: 'Skip' })}</th>
              <th scope="col">{tr({ zh: '概率', en: 'Probability' })}</th>
              <th scope="col">1/p</th>
              <th scope="col">{tr({ zh: `一轮 ${roundOf} 把里至少 1 次`, en: `at least once in ${roundOf}` })}</th>
              <th scope="col">{tr({ zh: '怎么来的', en: 'Where it comes from' })}</th>
            </tr>
          </thead>
          {groups.map((g) => {
            const rows = SKIP_ENTRIES.filter((e) => e.group === g);
            return (
              <tbody key={g}>
                <tr className="prob-skip-grouphead">
                  <th scope="colgroup" colSpan={5}>{tr(GROUP_LABEL[g])}</th>
                </tr>
                {rows.map((e) => {
                  const p = probability(e);
                  return (
                    <tr key={e.id}>
                      <th scope="row">
                        {tr(e.name)}
                        <span className={`prob-skip-kind is-${e.kind}`}>{tr(KIND_LABEL[e.kind])}</span>
                      </th>
                      <td className="prob-skip-num">{pct(p)}</td>
                      <td className="prob-skip-num">{formatOneOver(oneOver(e))}</td>
                      <td className="prob-skip-num">{pct(atLeastKInRound(p, 1, roundOf))}</td>
                      <td className="prob-skip-why">
                        {tr(e.why)}
                        {/* 条件概率:大家日常引用的就是这一列(XCross「大约 1/96」),
                            绝对概率反而没人用 —— 两者差 20 万倍,必须同时露出来。 */}
                        {e.relativeTo && (
                          <span className="prob-skip-rel">
                            {tr({ zh: '相对', en: 'relative to' })}
                            {' '}{tr(entryById(e.relativeTo).name)}:{' '}
                            <b>1/{formatOneOver(oneOverRelative(e)!)}</b>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            );
          })}
        </table>
      </div>

      <div className="prob-skip-round">
        <label htmlFor="prob-skip-rounds">{tr({ zh: '一轮几把', en: 'Solves per round' })}</label>
        <input
          id="prob-skip-rounds"
          className="prob-skip-range"
          type="range"
          min={1}
          max={12}
          value={roundOf}
          onChange={(ev) => setRoundOf(Number(ev.target.value))}
        />
        <span className="prob-skip-round-val">{roundOf}</span>
      </div>

      {/* 一轮里跳几次 —— 二项分布。表格那张「PLL skip in a round」把 p 写死成 1/36,
          与它自己 3x3 页的 1/72 打架;这里 p 直接从上表选,不留第二个来源。 */}
      <div className="prob-round">
        <div className="prob-round-head">
          <h3>{tr({ zh: `一轮 ${roundOf} 把里跳几次`, en: `How many skips in a ${roundOf}-solve round` })}</h3>
          <label>
            <span>{tr({ zh: '看哪种跳步', en: 'Which skip' })}</span>
            <select value={pickId} onChange={(e) => setPickId(e.target.value)} className="prob-round-pick">
              {SKIP_ENTRIES.map((e) => (
                <option key={e.id} value={e.id}>{`${tr(e.name)} (1/${formatOneOver(oneOver(e))})`}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="prob-skip-scroll">
          <table className="prob-skip-table">
            <thead>
              <tr>
                <th scope="col">{tr({ zh: '次数', en: 'Times' })}</th>
                <th scope="col">{tr({ zh: '恰好', en: 'Exactly' })}</th>
                <th scope="col">{tr({ zh: '至少', en: 'At least' })}</th>
                <th scope="col">{tr({ zh: '至少的 1/p', en: '1/p for at least' })}</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: roundOf }, (_, i) => i + 1).map((n) => {
                const atLeast = atLeastKInRound(pickedP, n, roundOf);
                return (
                  <tr key={n}>
                    <th scope="row">{n}</th>
                    <td className="prob-skip-num">{pct(exactlyKInRound(pickedP, n, roundOf))}</td>
                    <td className="prob-skip-num">{pct(atLeast)}</td>
                    <td className="prob-skip-num">{atLeast > 0 ? formatOneOver(1 / atLeast) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="prob-skip-note">
        <T
          zh={<>
            表里每个分数都是「合法状态数 / 全集大小」的整数比,现场算出来的,没有写死的小数。
            十字那四档另有一重保险:同一套容斥代码算出的结果,与 solver 端用完全不同的算法
            (子空间广搜 / mask 容斥 / 全空间取 min)得到的精确值<strong>分数相等</strong>,所以它接着去算
            2×2×2 块(那一族没有独立金标)才可信。
          </>}
          en={<>
            Every fraction here is an integer ratio of legal states to universe size, computed on the spot —
            no hardcoded decimals. The cross rows carry an extra guarantee: the same inclusion-exclusion code
            produces values that are <em>exactly equal</em>, as fractions, to results the solver derives by
            completely different means (subspace BFS, mask inclusion-exclusion, whole-space min-reduction).
            That is what licenses it to compute the 2×2×2 block rows, which have no independent ground truth.
          </>}
        />
      </p>
    </div>
  );
}
