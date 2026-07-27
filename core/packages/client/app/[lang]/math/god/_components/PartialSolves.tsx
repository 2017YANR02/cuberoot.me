'use client';

/**
 * 部分还原的上帝之数 —— 只要求还原一部分块时,那个子目标自己的直径与距离分布。
 *
 * 两族数据(角 5-循环 / 棱 5-循环)的来历、复算方式、以及"类平均 ≠ 真平均"这个陷阱,
 * 全部写在 lib/partial-solve-god.ts 的文件头。本组件只负责把它画出来,不放第二份数字。
 */
import Link from '@/components/AppLink';
import { T, tr } from '@/i18n/tr';
import { groupDigits } from '@/lib/group-digits';
import {
  PARTIAL_SOLVE_FAMILIES, meanFraction, meanOf, totalOf,
  type PartialSolveFamily,
} from '@/lib/partial-solve-god';
import { TeX } from './Tex';

/** `13 + 64/567` 这种写法 —— 真平均都是有理数,只写小数会看不出它是精确值。 */
function meanTex(counts: Record<number, number>): string {
  const { whole, num, den } = meanFraction(counts);
  return num === 0 ? `${whole}` : `${whole}\\tfrac{${num}}{${den}}`;
}

function FamilyCard({ f }: { f: PartialSolveFamily }) {
  const depths = Object.keys(f.classCounts).map(Number).sort((a, b) => a - b);
  const hasStates = Object.keys(f.stateCounts).length > 0;
  const maxState = hasStates ? Math.max(...Object.values(f.stateCounts)) : 0;
  const classMean = meanOf(f.classCounts);
  const trueMean = hasStates ? meanOf(f.stateCounts) : NaN;

  return (
    <article className="god-partial-card">
      <header className="god-partial-head">
        <h3>{tr(f.name)}</h3>
        <span className="god-partial-diam">
          {f.diameter}<span className="god-partial-diam-metric">HTM</span>
        </span>
      </header>
      <p className="god-partial-what">{tr(f.what)}</p>

      <div className="god-partial-formula">
        <TeX src={f.formula.tex} />
        <span className="god-partial-formula-parts">{tr(f.formula.parts)}</span>
      </div>

      <table className="god-partial-table">
        <thead>
          <tr>
            <th scope="col">{tr({ zh: '步数', en: 'Moves' })}</th>
            <th scope="col">{tr({ zh: '等价类', en: 'Classes' })}</th>
            {hasStates && <th scope="col">{tr({ zh: '状态数', en: 'States' })}</th>}
          </tr>
        </thead>
        <tbody>
          {depths.map((d) => (
            <tr key={d}>
              <th scope="row">{d}</th>
              <td>{groupDigits(String(f.classCounts[d]))}</td>
              {hasStates && (
                <td className="god-partial-statecell">
                  {/* 条与数字同源,都从 stateCounts 来 */}
                  <i style={{ width: `${(f.stateCounts[d] / maxState) * 100}%` }} />
                  <span>{groupDigits(String(f.stateCounts[d]))}</span>
                </td>
              )}
            </tr>
          ))}
          <tr className="god-partial-total">
            <th scope="row">{tr({ zh: '合计', en: 'Total' })}</th>
            <td>{groupDigits(String(totalOf(f.classCounts)))}</td>
            {hasStates && <td>{groupDigits(String(totalOf(f.stateCounts)))}</td>}
          </tr>
        </tbody>
      </table>

      <dl className="god-partial-means">
        <div>
          <dt>{tr({ zh: '按等价类平均', en: 'Averaged over classes' })}</dt>
          <dd className="is-trap">{classMean.toFixed(4)}</dd>
        </div>
        {hasStates && (
          <div>
            <dt>{tr({ zh: '按状态平均', en: 'Averaged over states' })}</dt>
            <dd><TeX src={meanTex(f.stateCounts)} /> <span>= {trueMean.toFixed(4)}</span></dd>
          </div>
        )}
      </dl>

      <p className="god-partial-src">
        <a href={f.source.href} target="_blank" rel="noopener noreferrer">{f.source.label}</a>
      </p>
    </article>
  );
}

export default function PartialSolves() {
  return (
    <div className="god-partial">
      <div className="god-partial-wrap">
        {PARTIAL_SOLVE_FAMILIES.map((f) => <FamilyCard key={f.id} f={f} />)}
      </div>

      <p className="god-partial-note">
        <T
          zh={<>
            两列不是一回事。等价类是把 48 个空间对称 + 取逆(共 96 个操作)下相同的状态合成一条 ——
            但轨道大小并不齐,只有 48 或 96 两种,所以「每类算一票」求出的平均没有物理意义。
            cuBerBruce 当年就写明了这一点。划掉的那两个数就是这么来的,流传的版本正是它们。
            本站的等价类数(1152 / 3272)由站内 48 元对称群引擎独立复算对上,逐深度状态数则是
            对每个类代表跑最优解器、再按轨道大小加权算出来的 —— 上游没给过这一列。
          </>}
          en={<>
            The two columns are different objects. A class collapses all states that agree under the 48
            spatial symmetries plus inversion (96 operations in all) — but the orbits are not the same
            size, only 48 or 96, so "one vote per class" produces an average with no physical meaning.
            cuBerBruce said as much at the time. The two struck-through numbers are what that mistake
            yields, and they are the figures in circulation. The class counts here (1152 / 3272) were
            re-derived independently with this site&apos;s own 48-element symmetry engine, and the
            per-depth state counts come from running an optimal solver on every class representative
            and weighting by orbit size — a column the source never published.
          </>}
        />
      </p>

      <p className="god-partial-note">
        <T
          zh={<>
            CFOP 的阶段(十字 / XCross / XXCross …)也是部分还原,但它们能在商空间里直接 BFS
            (自由块不看),所以整条分布都是穷举出来的 —— 那批在 <Link href="/scramble/stats">打乱统计</Link> 的
            「精确穷举」数据集里。这里这两族不行:目标是整个魔方还原,只是起点被限制成某族部分打乱,
            距离仍活在 4.3×10¹⁹ 的全群里,只能一个一个求最优解。
          </>}
          en={<>
            CFOP stages (cross, XCross, XXCross …) are partial solves too, but they can be BFS&apos;d
            directly in a quotient space where the free pieces simply are not looked at — so their whole
            distributions are exhaustive. Those live in the &quot;exhaustive&quot; dataset on{' '}
            <Link href="/scramble/stats">Scramble Stats</Link>. These two families cannot: the goal is a
            fully solved cube and only the starting position is restricted, so the distance still lives
            in the full 4.3×10¹⁹ group and every state needs its own optimal solve.
          </>}
        />
      </p>
    </div>
  );
}
