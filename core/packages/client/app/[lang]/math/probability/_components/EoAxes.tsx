'use client';

/**
 * 三轴坏棱联合分布。数字全部由 lib/eo-axes.ts 现场算出来(列联表 × 二项卷积,毫秒级),
 * 本组件只排版。65 个组合默认只露最常见的那些,点一下展开全部。
 */
import { useMemo, useState } from 'react';
import { T, tr } from '@/i18n/tr';
import { groupDigits } from '@/lib/group-digits';
import {
  EO_AXIS_UNIVERSE, eoAxisJoint, eoAxisMarginal, eoAxisMinDist, meanOfDist,
} from '@/lib/eo-axes';

const TOP_N = 12;

function pct(v: number): string {
  const p = v * 100;
  if (p >= 0.01) return `${p.toFixed(2)}%`;
  if (p >= 1e-4) return `${Number(p.toPrecision(2))}%`;
  return `${p.toExponential(1)}%`;
}

export default function EoAxes() {
  const [all, setAll] = useState(false);
  const { joint, minDist, minMean, axisMean } = useMemo(() => {
    const j = eoAxisJoint();
    return {
      joint: j,
      minDist: eoAxisMinDist(),
      minMean: meanOfDist(eoAxisMinDist()),
      axisMean: meanOfDist(eoAxisMarginal()),
    };
  }, []);
  const rows = all ? joint : joint.slice(0, TOP_N);
  const maxCount = joint[0].count;
  const minDepths = Object.keys(minDist).map(Number).sort((a, b) => a - b);
  const minTotal = Object.values(minDist).reduce((a, b) => a + b, 0);

  return (
    <div className="prob-eo">
      <div className="prob-eo-nums">
        <div>
          <b>{groupDigits(String(EO_AXIS_UNIVERSE))}</b>
          <span>{tr({ zh: '全集 = 12!/(4!·4!·4!) × 2¹¹', en: 'universe = 12!/(4!·4!·4!) × 2¹¹' })}</span>
        </div>
        <div>
          <b>{axisMean}</b>
          <span>{tr({ zh: '每个轴的平均坏棱数', en: 'mean bad edges per axis' })}</span>
        </div>
        <div>
          <b>{minMean.toFixed(4)}</b>
          <span>{tr({ zh: '三个轴里最少的那个的平均', en: 'mean of the best of the three axes' })}</span>
        </div>
      </div>

      <p className="prob-eo-note">
        <T
          zh={<>
            「平均 6 条坏棱」说的是<strong>每个轴各自</strong>。但选轴时你看的是三个轴里最少的那个,
            那个的平均只有 {minMean.toFixed(2)} 条 —— ZZ 选 EO 轴、DR 选方向,占的就是这个便宜。
            三个轴也不独立:(4,6,6) 和 (6,6,8) 都比 (6,6,6) 更常见。
          </>}
          en={<>
            &quot;Six bad edges on average&quot; is a statement about <strong>each axis separately</strong>.
            What you actually pick is the best of the three, and that averages only {minMean.toFixed(2)} —
            the edge ZZ gets from choosing its EO axis, and DR from choosing its direction. The axes are not
            independent either: both (4,6,6) and (6,6,8) beat (6,6,6) in frequency.
          </>}
        />
      </p>

      <div className="prob-eo-cols">
        <div>
          <h4>{tr({ zh: '最少的那个轴有几条坏棱', en: 'Bad edges on the best axis' })}</h4>
          <table className="prob-skip-table prob-eo-table">
            <thead>
              <tr>
                <th scope="col">{tr({ zh: '坏棱', en: 'Bad' })}</th>
                <th scope="col">{tr({ zh: '占比', en: 'Share' })}</th>
                <th scope="col">{tr({ zh: '状态数', en: 'States' })}</th>
              </tr>
            </thead>
            <tbody>
              {minDepths.map((d) => (
                <tr key={d}>
                  <th scope="row">{d}</th>
                  <td className="prob-skip-num">{pct(minDist[d] / minTotal)}</td>
                  <td className="prob-skip-num">{groupDigits(String(minDist[d]))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <h4>
            {tr({ zh: '三轴组合', en: 'The three-axis combination' })}
            <span className="prob-eo-sub">{tr({ zh: '共 65 种', en: '65 of them' })}</span>
          </h4>
          <table className="prob-skip-table prob-eo-table">
            <thead>
              <tr>
                <th scope="col">{tr({ zh: '组合', en: 'Combination' })}</th>
                <th scope="col">{tr({ zh: '占比', en: 'Share' })}</th>
                <th scope="col">{tr({ zh: '状态数', en: 'States' })}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ triple, count }) => (
                <tr key={triple.join(',')}>
                  <th scope="row">({triple.join(', ')})</th>
                  <td className="prob-skip-num">{pct(count / EO_AXIS_UNIVERSE)}</td>
                  <td className="prob-eo-bar">
                    <i style={{ width: `${(count / maxCount) * 100}%` }} />
                    <span>{groupDigits(String(count))}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {joint.length > TOP_N && (
            <button type="button" className="prob-eo-more" onClick={() => setAll((v) => !v)}>
              {all
                ? tr({ zh: '只看最常见的', en: 'Show the common ones only' })
                : tr({ zh: `展开全部 ${joint.length} 种`, en: `Show all ${joint.length}` })}
            </button>
          )}
        </div>
      </div>

      <p className="prob-eo-note">
        <T
          zh={<>
            组合里的三个数一定都是偶数,而且极差不超过 8 —— 满足这两条的三元组恰好 65 个,
            并且每一个都真的出现。表里的数不是抄来的:每条棱对三个轴的好坏只由「它家在哪一层、
            现在在哪一层、朝向位」决定,那张 18 项小表由 CI 现场从 cubing.js 的三阶模型重读,
            整条分布再由 3×3 列联表 × 四组二项卷积算出,与上游那份表逐个组合吻合。
          </>}
          en={<>
            All three numbers are even and the spread never exceeds 8 — there are exactly 65 triples
            satisfying both, and every one of them occurs. None of this is transcribed: whether an edge is
            bad on a given axis depends only on which slice it belongs to, which slice it currently sits in,
            and its orientation bit. CI re-reads that 18-entry table from cubing.js on every run, and the
            distribution follows from a 3×3 contingency table with four binomial convolutions — matching the
            upstream table combination by combination.
          </>}
        />
      </p>
    </div>
  );
}
