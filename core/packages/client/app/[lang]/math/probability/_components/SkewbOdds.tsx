'use client';

/**
 * 斜转的识别概率与首步分布。数字全部来自 `lib/skewb-odds.ts` 的常量,而那份常量由
 * `tests/skewb_odds.test.ts` 每次跑都用全空间枚举重算后逐个断言 —— 本组件只排版。
 */
import Link from '@/components/AppLink';
import { T, tr } from '@/i18n/tr';
import { groupDigits } from '@/lib/group-digits';
import { SKEWB_ODDS, SKEWB_PURE_CENTRE_3CYCLE, SKEWB_WCA_SAMPLE } from '@/lib/skewb-odds';

const { total, wcaLegal, recognition: rec, centresOnly, steps, lastLayer } = SKEWB_ODDS;

/** 1/p 的显示:大数分节,小数留两位。 */
function oneIn(count: number): string {
  const v = total / count;
  const [int, frac] = v.toFixed(v >= 10_000 ? 0 : v >= 100 ? 1 : 2).split('.');
  return frac ? `${groupDigits(int)}.${frac}` : groupDigits(int);
}

function pct(n: number, denom = total): string {
  const p = (n / denom) * 100;
  if (p >= 1) return `${p.toFixed(2)}%`;
  if (p >= 0.01) return `${p.toFixed(3)}%`;
  return `${Number(p.toPrecision(2))}%`;
}

const RECOGNITION = [
  {
    n: rec.noBar,
    zh: <>没有<b>棒</b> —— 六个面的中心都不与同面的角块同色</>,
    en: <>No <b>bar</b> — no centre shares its colour with a corner on the same face</>,
  },
  {
    n: rec.noLight,
    zh: <>没有<b>灯</b> —— 没有哪条棱的两端两个角块同色</>,
    en: <>No <b>light</b> — no cube edge has matching corner stickers at both ends</>,
  },
  { n: rec.noBarNoLight, zh: <>棒和灯都没有</>, en: <>Neither a bar nor a light</> },
  { n: rec.rainbow, zh: <>每一面的 5 格两两不同色</>, en: <>All five stickers differ on every face</> },
  { n: rec.skipLayer, zh: <>首层已经还原(任一面)</>, en: <>A first layer is already solved (any face)</> },
  {
    n: SKEWB_PURE_CENTRE_3CYCLE.states,
    zh: <>角块全好、只剩三个中心轮换</>,
    en: <>Corners done, three centres left in a cycle</>,
  },
];

const CYCLE_LABEL: Record<string, { zh: string; en: string }> = {
  '': { zh: '已还原', en: 'solved' },
  '2+2': { zh: '两组对换', en: 'two swaps' },
  3: { zh: '三循环', en: '3-cycle' },
  '4+2': { zh: '四循环 + 对换', en: '4-cycle + swap' },
  '3+3': { zh: '两个三循环', en: 'two 3-cycles' },
  5: { zh: '五循环', en: '5-cycle' },
};

const STEP_LABEL: Record<string, { zh: string; en: string }> = {
  face: { zh: '首面:某个面四个角同色', en: 'A face: four corners of one face match' },
  layer: { zh: '首层:再加四条侧带成对', en: 'A layer: that face plus matching side bands' },
  layerCentre: { zh: '首层 + 该面中心', en: 'A layer including its own centre' },
  centres: { zh: '六个中心各归各位', en: 'All six centres home' },
};

const DEPTHS = [...new Set(centresOnly.flatMap((r) => Object.keys(r.byDist).map(Number)))]
  .sort((a, b) => a - b);
const MAX_STEP = Math.max(...steps.map((s) => s.hist.length - 1));
const STEP_COLS = Array.from({ length: MAX_STEP + 1 }, (_, i) => i);

export default function SkewbOdds() {
  const wcaWorst = (() => {
    let worst = 0;
    for (let d = 7; d < SKEWB_ODDS.histogram.length; d++) {
      const theory = SKEWB_ODDS.histogram[d] / wcaLegal;
      const seen = (SKEWB_WCA_SAMPLE.counts[d] ?? 0) / SKEWB_WCA_SAMPLE.sampleCount;
      worst = Math.max(worst, Math.abs(theory - seen) * 100);
    }
    return worst;
  })();

  return (
    <div>
      <div className="prob-nums">
        <div>
          <b>{groupDigits(String(total))}</b>
          <span>{tr({ zh: '全空间', en: 'the whole space' })}</span>
        </div>
        <div>
          <b>{groupDigits(String(wcaLegal))}</b>
          <span>{tr({ zh: '比赛能抽到的(最优 ≥ 7 步)', en: 'reachable in competition (optimal ≥ 7)' })}</span>
        </div>
        <div>
          <b>11</b>
          <span>{tr({ zh: '上帝之数', en: 'God’s number' })}</span>
        </div>
      </div>

      <p className="prob-note">
        <T
          zh={<>
            比赛打乱不给 6 步以内就能解开的状态,所以那一档的分母是 {groupDigits(String(wcaLegal))} 而不是全空间。
            这不是约定俗成:{groupDigits(String(SKEWB_WCA_SAMPLE.sampleCount))} 条 WCA 真题打乱里最短的正是 7 步,
            而且七到十一步的逐档占比与理论条件分布最大只差 {wcaWorst.toFixed(3)} 个百分点。
            整解的逐步分布在 <Link href="/scramble/stats?tab=difficulty&event=skewb" className="prob-link">求解统计</Link> 里。
          </>}
          en={<>
            Competition scrambles never hand you a state solvable in six moves or fewer, so that row’s
            denominator is {groupDigits(String(wcaLegal))} rather than the whole space. That is not a convention
            we assumed: across {groupDigits(String(SKEWB_WCA_SAMPLE.sampleCount))} real WCA scrambles the shortest
            optimal solution is exactly 7, and the seven-to-eleven shares differ from the theoretical conditional
            distribution by at most {wcaWorst.toFixed(3)} percentage points. The full depth histogram lives
            in <Link href="/scramble/stats?tab=difficulty&event=skewb" className="prob-link">the solve stats</Link>.
          </>}
        />
      </p>

      <div className="prob-cols">
        <div>
          <h4>{tr({ zh: '一眼能看出来的', en: 'What you can see at a glance' })}</h4>
          <table className="prob-skip-table prob-mini-table prob-rowtext">
            <thead>
              <tr>
                <th scope="col">{tr({ zh: '情形', en: 'Case' })}</th>
                <th scope="col">1/p</th>
                <th scope="col">{tr({ zh: '状态数', en: 'States' })}</th>
              </tr>
            </thead>
            <tbody>
              {RECOGNITION.map((r) => (
                <tr key={r.n}>
                  <th scope="row"><T zh={r.zh} en={r.en} /></th>
                  <td className="prob-skip-num">{oneIn(r.n)}</td>
                  <td className="prob-skip-num">{groupDigits(String(r.n))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <h4>
            {tr({ zh: '角块全好、只剩中心', en: 'Corners done, centres left' })}
            <span className="prob-h4-sub">{tr({ zh: '共 360 种', en: '360 of them' })}</span>
          </h4>
          <table className="prob-skip-table prob-mini-table">
            <thead>
              <tr>
                <th scope="col">{tr({ zh: '中心置换', en: 'Centre permutation' })}</th>
                <th scope="col">{tr({ zh: '种数', en: 'Cases' })}</th>
                {DEPTHS.map((d) => <th scope="col" key={d}>{d}</th>)}
              </tr>
            </thead>
            <tbody>
              {centresOnly.map((r) => (
                <tr key={r.cycle || 'id'}>
                  <th scope="row">{tr(CYCLE_LABEL[r.cycle])}</th>
                  <td className="prob-skip-num">{r.total}</td>
                  {DEPTHS.map((d) => (
                    <td className="prob-skip-num" key={d}>{r.byDist[d] ?? '—'}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="prob-note">
            <T
              zh={<>表头的数字是最优步数。中心块只能做偶置换,所以单个对换、单个四循环一个都不出现。</>}
              en={<>Column headings are optimal move counts. Centres only ever undergo even permutations, so a
                lone swap or a lone 4-cycle never shows up.</>}
            />
          </p>
        </div>
      </div>

      <h4 className="prob-steps-h">{tr({ zh: '第一步要几步', en: 'How far the first step is' })}</h4>
      <div className="prob-skip-scroll">
        <table className="prob-skip-table prob-mini-table">
          <thead>
            <tr>
              <th scope="col">{tr({ zh: '目标', en: 'Goal' })}</th>
              {STEP_COLS.map((d) => <th scope="col" key={d}>{d}</th>)}
              <th scope="col">{tr({ zh: '平均', en: 'Mean' })}</th>
            </tr>
          </thead>
          <tbody>
            {steps.map((s) => {
              const mean = s.hist.reduce((a, n, d) => a + n * d, 0) / total;
              return (
                <tr key={s.key}>
                  <th scope="row">{tr(STEP_LABEL[s.key])}</th>
                  {STEP_COLS.map((d) => (
                    <td className="prob-skip-num" key={d}>
                      {d < s.hist.length ? pct(s.hist[d]) : '—'}
                    </td>
                  ))}
                  <td className="prob-skip-num">{mean.toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="prob-note">
        <T
          zh={<>
            这四行是全 {groupDigits(String(total))} 态的精确分布,不是采样。0 步那一列就是上表的
            「首层已经还原」——同一件事全站只有一个数。首层的四个角归位之后还剩
            {' '}{groupDigits(String(lastLayer.cases))} 个 case,到还原的最优步数是
            {' '}{Object.entries(lastLayer.byDist).map(([d, n]) => `${d} 步 ${n} 个`).join('、')}。
          </>}
          en={<>
            All four rows are exact over the full {groupDigits(String(total))} states, not sampled. The 0-move
            column is the &quot;first layer already solved&quot; row of the table above — one number, one place.
            Once the four first-layer corners are home, {groupDigits(String(lastLayer.cases))} cases remain, at
            optimal depths of {Object.entries(lastLayer.byDist).map(([d, n]) => `${n} at ${d}`).join(', ')}.
          </>}
        />
      </p>
    </div>
  );
}
