'use client';

/**
 * 交互式度量切换:HTM / QTM / STM 对同一个三阶超解释示例
 *   - HTM(Half-Turn Metric):U2 = 1 步
 *   - QTM(Quarter-Turn Metric):U2 = 2 步
 *   - STM(Slice-Turn Metric):允许内层 M E S,与 HTM 不同的是 NxN 切片也算 1 步
 *
 * 示例打乱 "R U R' U' R' F R2 U' R' U' R U R' F'" 在三种度量下分别 14 / 19 / 14。
 * 用户切换度量,组件高亮"哪几步会折算成 2"。
 */
import { useState } from 'react';
import { htm, moveCost, qtm, stm, tokenizeMoves } from '@cuberoot/shared/alg-notation';
import { MathText } from './Tex';

type Metric = 'HTM' | 'QTM' | 'STM';

// 带一个 M 层,好让 STM 真的跟 HTM 分开(M = R' L x' ⟹ HTM 记 2 步、STM 记 1 步)。
const ALG = "M2 U M U2 M' U M2";
const TOKENS = tokenizeMoves(ALG).moves;

// 三个数都由 @cuberoot/shared/alg-notation 算出来 —— 这一页讲的就是度量,自己算错就没得看了。
// (此处原先是内联的:`/2$/` 抓不到 `R2'`,STM 还直接写死等于 HTM。)
const COUNTS: Record<Metric, number> = { HTM: htm(ALG), QTM: qtm(ALG), STM: stm(ALG) };

const GOD: Record<Metric, { puzzle: string; v: number }[]> = {
  HTM: [
    { puzzle: '2×2', v: 11 },
    { puzzle: '3×3', v: 20 },
    { puzzle: 'Clock', v: 12 },
    { puzzle: 'Pyraminx', v: 11 },
    { puzzle: 'Skewb', v: 11 },
  ],
  QTM: [
    { puzzle: '2×2', v: 14 },
    { puzzle: '3×3', v: 26 },
  ],
  STM: [
    { puzzle: '3×3', v: 18 },
  ],
};

interface Props { isZh: boolean; }

export default function MetricExplainer({ isZh }: Props) {
  const t = (zh: string, en: string) => (isZh ? zh : en);
  const [metric, setMetric] = useState<Metric>('HTM');

  return (
    <div className="god-metric-wrap">
      <div className="god-metric-tabs">
        {(['HTM', 'QTM', 'STM'] as Metric[]).map((m) => (
          <button key={m}
                  className={`god-metric-tab ${metric === m ? 'is-on' : ''}`}
                  onClick={() => setMetric(m)}>
            {m}
          </button>
        ))}
      </div>

      <div className="god-metric-defn">
        {metric === 'HTM' && (
          <MathText>{t(
            'Half-Turn Metric:每个 90° 或 180° 面转都算 1 步。U2 = 1。WCA 文献最常用,也是 cube20.org 给出的 "20" 这个数字所用的度量。',
            'Half-Turn Metric: each 90° or 180° face turn counts as 1. U2 = 1. The default in WCA literature and the metric behind the famous "20".'
          )}</MathText>
        )}
        {metric === 'QTM' && (
          <MathText>{t(
            'Quarter-Turn Metric:只有 90° 转算 1 步,180° 必须拆成两步 90°。U2 = 2。Rokicki & Davidson 2014 在这个度量下证出三阶直径 = 26。',
            'Quarter-Turn Metric: only 90° counts as 1 step; a 180° turn is two 90°s. U2 = 2. Rokicki & Davidson 2014 proved the 3×3 diameter = 26 in this metric.'
          )}</MathText>
        )}
        {metric === 'STM' && (
          <MathText>{t(
            'Slice-Turn Metric:允许内层切片 M E S 作为单独一步。Rokicki 2014 证 3×3 STM 直径 = 18(同时是上下界)。多面 NxN 的 STM 上帝之数无人证过。',
            'Slice-Turn Metric: inner slices M E S each count as a single move. Rokicki (2014) proved the 3×3 STM diameter = 18. No NxN STM bounds exist for N ≥ 4.'
          )}</MathText>
        )}
      </div>

      <div className="god-metric-example">
        <div className="god-metric-alg">
          {TOKENS.map((m, i) => {
            const w = moveCost(m, metric.toLowerCase() as Lowercase<Metric>);
            return (
              <span key={i} className={`god-metric-move ${w > 1 ? 'is-heavy' : ''}`}
                    title={w > 1 ? t(`这一步在 ${metric} 里算 ${w} 步`, `counts as ${w} in ${metric}`) : undefined}>
                {m.raw}
                {w > 1 && <sup>×{w}</sup>}
              </span>
            );
          })}
        </div>
        <div className="god-metric-count">
          {t('共', 'total')}:{' '}
          <b style={{ color: 'var(--god-accent)', fontSize: '1.4em' }}>{COUNTS[metric]}</b>
          {' '}{t('步', 'moves')} ({metric})
        </div>
      </div>

      <table className="god-metric-table">
        <thead>
          <tr>
            <th>{t('项目', 'Puzzle')}</th>
            <th>{t('上帝之数', "God's number")} ({metric})</th>
          </tr>
        </thead>
        <tbody>
          {GOD[metric].map((row) => (
            <tr key={row.puzzle}>
              <td>{row.puzzle}</td>
              <td><b>{row.v}</b></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
