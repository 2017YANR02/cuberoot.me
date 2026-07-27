'use client';

/**
 * /scramble/hardest —— 三阶最难开局:六色底 XCross 需要 10 步的那 438 个状态。
 *
 * 「六色底 XCross = 10」= 六个底色 × 四个 F2L 槽共 24 种口径全部要 10 步。单色底
 * 4 槽 XCross 的最大深度就是 10,所以这批状态是整个 4.3e19 空间里开局最难的一撮:
 * 换哪个面当底、先解哪个槽,都躲不掉 10 步。
 *
 * 页面同时是「来源分级」的示范:每条结论都标清楚是 CI 现场自证、本机 solver 实证,
 * 还是上游穷举搜索给的 ground truth —— 搬运不许伪装成证明。
 */

import Link from '@/components/AppLink';
import { ScramblePreview2D } from '@/components/ScramblePreview2D';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { groupDigits } from '@/lib/group-digits';
import { tr } from '@/i18n/tr';
import {
  CN_XCROSS_10_REPS, CN_XCROSS_10_SYMMETRY_ORDER, CN_XCROSS_10_TOTAL, CUBE_STATES,
} from './_data/cn_xcross_10';
import { EOCROSS_10F, EOCROSS_10F_BOTH_AXES, EOCROSS_10F_TOTAL } from './_data/eocross_10f';
import { HARD_SCRAMBLES, type HardStageKey } from './_data/hard_scrambles';
import {
  TWENTY_F_BASELINE, TWENTY_F_EASY_CROSS, TWENTY_F_RANDOM_CN_CROSS, TWENTY_F_RANDOM_CROSS,
  TWENTY_F_RANDOM_EOCROSS, TWENTY_F_RANDOM_TOTAL, TWENTY_F_SYM_CENSUS, TWENTY_F_SYM_SELF_INVERSE,
  TWENTY_F_SYM_TOTAL, twentyFMean,
} from './_data/twenty_f';
import './hardest.css';

const PREVIEW = 46;

/** 本质类数 = 代表条数,不手写。 */
const ESSENTIAL = CN_XCROSS_10_REPS.length;

/** 两条 EO 轴都要 10 步的那条,序号从列表里查,不手写。 */
const DOUBLE_10 = EOCROSS_10F_BOTH_AXES;
const DOUBLE_10_INDEX = EOCROSS_10F.indexOf(EOCROSS_10F_BOTH_AXES) + 1;

const STAGE_LABEL: Record<HardStageKey, string> = {
  cross: 'Cross',
  xcross: 'XCross',
  xxcross: 'XXCross',
  xxxcross: 'XXXCross',
};

/** 一个区间显示成 `8` 或 `6–8`。 */
function span(min: number | null, max: number | null): string {
  if (min == null || max == null) return '—';
  return min === max ? String(min) : `${min}–${max}`;
}

function solverHref(scramble: string): string {
  return `/scramble/solver?event=333&scramble=${encodeURIComponent(scramble)}`;
}

/** 对称型那张表点过去 = 对称分析页(analyze 视图)现场重算这条打乱的对称群。 */
function symmetryHref(scramble: string): string {
  return `/scramble/symmetry?view=analyze&q=${encodeURIComponent(scramble)}`;
}

export default function HardestPage() {
  useDocumentTitle('最难开局', 'Hardest openings');

  return (
    <div className="hardest-page">
      <header>
        <h1>
          {tr({
            zh: `六色底 XCross 要 10 步的 ${CN_XCROSS_10_TOTAL} 个状态`,
            en: `The ${CN_XCROSS_10_TOTAL} states whose colour-neutral XCross takes 10 moves`,
          })}
        </h1>
        <p className="hardest-lede">
          {tr({
            zh: '把六个面轮流当底、四个 F2L 槽轮流先解 —— 24 种开局口径全部要 10 步。'
              + '这是 XCross 的上确界:整个三阶状态空间里,再没有比这更难开的局面。',
            en: 'Put each of the six colours on the bottom and pair each of the four F2L slots — '
              + 'all 24 ways need 10 moves. That is the supremum of XCross: no position in the '
              + 'whole 3×3 state space opens harder than these.',
          })}
        </p>
      </header>

      <div className="hardest-figures">
        <div className="hardest-figure">
          <b>{CN_XCROSS_10_TOTAL}</b>
          <span>{tr({ zh: '这样的状态总数', en: 'such states in total' })}</span>
        </div>
        <div className="hardest-figure">
          <b>{ESSENTIAL}</b>
          <span>
            {tr({
              zh: `对称去重后的本质类(${CN_XCROSS_10_SYMMETRY_ORDER} 元群)`,
              en: `essential classes under the ${CN_XCROSS_10_SYMMETRY_ORDER}-element symmetry group`,
            })}
          </span>
        </div>
        <div className="hardest-figure">
          <b>1 / 9.87 × 10¹⁶</b>
          <span>{tr({ zh: '随机打乱撞上的概率', en: 'odds of a random scramble' })}</span>
        </div>
      </div>

      <section className="hardest-section">
        <h2>{tr({ zh: '为什么 10 步是上限', en: 'Why 10 is the ceiling' })}</h2>
        <p>
          {tr({
            zh: '固定一个底色、允许四个槽任选,XCross 的全空间深度分布最深就到 10 步 —— '
              + '那一档有 4,998,960 个状态(穷举 BFS 金标)。所以「某个底色要 11 步」根本不存在,'
              + '六个底色全部顶到 10 步就是能达到的最难。',
            en: 'Fix one bottom colour and let the solver pick any of the four slots: the exhaustive '
              + 'depth distribution of XCross tops out at 10, a bin holding 4,998,960 states. '
              + 'No colour ever needs 11, so all six colours sitting at 10 is as hard as it gets.',
          })}
        </p>
        <p>
          {tr({
            zh: `全空间 ${groupDigits(CUBE_STATES)} 个状态里,两个相对底色都要 10 步的已经只剩 `
              + `20,230,604 个;六个底色全要 10 步的,只剩 ${CN_XCROSS_10_TOTAL} 个。`,
            en: `Out of ${groupDigits(CUBE_STATES)} states, requiring two opposite colours to both `
              + `need 10 already cuts it to 20,230,604; requiring all six leaves ${CN_XCROSS_10_TOTAL}.`,
          })}{' '}
          <Link href="/scramble/stats" prefetch={false}>
            {tr({ zh: '看完整的穷举分布 →', en: 'See the full exhaustive distributions →' })}
          </Link>
        </p>
      </section>

      <section className="hardest-section">
        <h2>{tr({ zh: '证到哪一步了', en: 'How much of this is proved' })}</h2>
        <ul className="hardest-proof">
          <li>
            <div className="hardest-proof-head">
              <b>
                {tr({
                  zh: `${ESSENTIAL} 类代表展开正好是这 ${CN_XCROSS_10_TOTAL} 个状态`,
                  en: `The ${ESSENTIAL} representatives expand to exactly these ${CN_XCROSS_10_TOTAL} states`,
                })}
              </b>
              <span className="hardest-tag is-proved">
                {tr({ zh: 'CI 现场自证', en: 'proved in CI' })}
              </span>
            </div>
            <p>
              {tr({
                zh: `每条代表在 ${CN_XCROSS_10_SYMMETRY_ORDER} 元对称群(24 个转体 × 是否镜像)下展开、`
                  + '去重,轨道大小落在 6/12/24/48 四档,并集逐个状态命中上游那张全表 —— 不多不少,'
                  + '也不是只比个数。测试每次跑都重算一遍。',
                en: `Each representative is expanded under the ${CN_XCROSS_10_SYMMETRY_ORDER}-element `
                  + 'symmetry group (24 rotations × mirror), deduplicated — orbit sizes come out 6/12/24/48 — '
                  + 'and the union matches the upstream table state by state, not merely in count. '
                  + 'The test recomputes it on every run.',
              })}
            </p>
          </li>
          <li>
            <div className="hardest-proof-head">
              <b>
                {tr({
                  zh: '这些状态的 XCross 确实是 10,整方最优步数也复核过',
                  en: 'Their XCross really is 10, and the optimal solve lengths check out',
                })}
              </b>
              <span className="hardest-tag is-local">
                {tr({ zh: '本机 solver 实证', en: 'verified locally' })}
              </span>
            </div>
            <p>
              {tr({
                zh: `本仓库的 std_analyzer 跑完全部 ${CN_XCROSS_10_TOTAL} 条,${CN_XCROSS_10_TOTAL} × 6 = `
                  + '2,628 个 XCross 值全是 10;整方最优步数另用 15G 剪枝表的 cubeopt 复核了 23 条代表,'
                  + '与表格逐条一致。顺带一个反直觉的事实:XCross 全顶格,Cross 却不一定 —— '
                  + '有一类的部分底色只要 6 步十字。',
                en: `This repo's std_analyzer ran all ${CN_XCROSS_10_TOTAL} of them: all `
                  + `${CN_XCROSS_10_TOTAL} × 6 = 2,628 XCross values are 10. The optimal solve lengths of the `
                  + '23 representatives were re-derived with the 15 GB-table cubeopt and agree row by row. '
                  + 'One counter-intuitive by-product: XCross is maximal everywhere, but Cross is not — '
                  + 'one class has colours needing only a 6-move cross.',
              })}
            </p>
          </li>
          <li>
            <div className="hardest-proof-head">
              <b>
                {tr({
                  zh: `不存在第 ${CN_XCROSS_10_TOTAL + 1} 个`,
                  en: `That there is no ${CN_XCROSS_10_TOTAL + 1}-th such state`,
                })}
              </b>
              <span className="hardest-tag is-upstream">
                {tr({ zh: '上游穷举搜索给出,本站未复算', en: 'upstream exhaustive search, not re-run here' })}
              </span>
            </div>
            <p>
              {tr({
                zh: '这一条要在 4.3 × 10¹⁹ 的全空间上跑。本站能落地的最紧上界是「双色底 XCross = 10」'
                  + '的 20,230,604 个状态,而那一档的分布走对称折叠 + 聚合计数,并不把单个状态存下来。'
                  + '所以这里如实标注:总数 438 是搬运来的 ground truth,不是本站证明的结论。',
                en: 'Settling this needs a sweep of all 4.3 × 10¹⁹ positions. The tightest bound this site '
                  + 'can materialise is the 20,230,604 states with a two-colour XCross of 10, and even that '
                  + 'distribution is computed by symmetry folding and aggregate counting — individual states '
                  + 'are never stored. So it is labelled honestly: 438 is imported ground truth, not a result '
                  + 'proved here.',
              })}
            </p>
          </li>
        </ul>
      </section>

      <section className="hardest-section">
        <h2>
          {tr({
            zh: `${ESSENTIAL} 类本质不同的代表`,
            en: `${ESSENTIAL} essentially different representatives`,
          })}
        </h2>
        <p>
          {tr({
            zh: '「轨道」= 这一类在对称群下能变出多少个不同状态,加起来正好 '
              + `${CN_XCROSS_10_TOTAL}。H* 是整方最优步数,Cross / XXCross / XXXCross 给的是六个底色里的取值范围。`
              + '点开任意一条进求解器。',
            en: '“Orbit” is how many distinct states the class produces under the symmetry group; they sum to '
              + `${CN_XCROSS_10_TOTAL}. H* is the optimal solve length, while Cross / XXCross / XXXCross show the `
              + 'range over the six bottom colours. Click any case to open it in the solver.',
          })}
        </p>
        <div className="hardest-grid">
          {CN_XCROSS_10_REPS.map((rep, i) => (
            <Link
              key={rep.scramble}
              className="hardest-cell"
              href={solverHref(rep.scramble)}
              prefetch={false}
              aria-label={tr({ zh: '在求解器中打开', en: 'Open in the solver' })}
            >
              <span className="hardest-cell-no">#{i + 1}</span>
              <ScramblePreview2D event="333" scramble={rep.scramble} size={PREVIEW} />
              <span className="hardest-cell-alg">{rep.scramble}</span>
              <span className="hardest-metrics">
                <span>{tr({ zh: '轨道', en: 'orbit' })} <b>{rep.orbit}</b></span>
                <span>H* <b>{rep.optimal}</b></span>
                <span>Cross <b>{span(rep.crossMin, rep.crossMax)}</b></span>
                <span>XXC <b>{span(rep.xxcMin, rep.xxcMax)}</b></span>
                <span>XXXC <b>{span(rep.xxxcMin, rep.xxxcMax)}</b></span>
                {rep.block222 != null && <span>2×2×2 <b>{rep.block222}</b></span>}
                {rep.eo != null && <span>EO <b>{rep.eo}</b></span>}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="hardest-section">
        <h2>
          {tr({
            zh: `EOCross 要 10 步的 ${EOCROSS_10F_TOTAL} 个态`,
            en: `The ${EOCROSS_10F_TOTAL} states whose EOCross takes 10 moves`,
          })}
        </h2>
        <p>
          {tr({
            zh: 'EOCross(ZZ 的第一步:12 条棱全部朝向正确 + 底面十字)的全空间是 24,330,240 个态,'
              + `本站在纯 TS 里把它整个广搜了一遍,最深一档恰好 ${EOCROSS_10F_TOTAL} 个。下面这 ${EOCROSS_10F_TOTAL} 条打乱`
              + '各 10 步,落到的正是那些态 —— 一一对应,不多不少,每次跑测试都重验一遍。'
              + '底色固定为黄(D 面),换底色这批就不成立。',
            en: 'EOCross — the ZZ opening: all twelve edges oriented plus the bottom cross — has a state space '
              + `of 24,330,240, and a plain-TypeScript breadth-first search over all of it puts exactly `
              + `${EOCROSS_10F_TOTAL} states at the maximum depth. The ${EOCROSS_10F_TOTAL} ten-move scrambles below land on `
              + 'precisely those states, one for one, and the test suite re-checks that every run. The bottom '
              + 'colour is fixed to yellow, so these do not carry over to another colour.',
          })}
        </p>
        <p>
          {tr({
            zh: '一个补充口径:底面定死之后,EO 还剩两条轴可选(差一个 y 旋转),两条都是合法的 ZZ 起手,'
              + '上面这批固定的是其中一条。把同一批打乱按另一条轴读,139 条掉到 6–9 步 —— '
              + `只有第 ${DOUBLE_10_INDEX} 条 ${DOUBLE_10} 两条轴都要 10 步,那才是黄底 EOCross 真正无处可躲的开局。`,
            en: 'One caveat on the convention: once the bottom face is fixed, EO still has two possible axes '
              + '(a y rotation apart) and either is a legal ZZ start; the list above fixes one of them. Read the '
              + `same scrambles on the other axis and 139 of them drop to 6–9 moves — only #${DOUBLE_10_INDEX}, `
              + `${DOUBLE_10}, needs 10 either way, which makes it the one yellow-cross EOCross opening with nowhere to hide.`,
          })}
        </p>
        <div className="hardest-corpus">
          {EOCROSS_10F.map((scramble, i) => (
            <Link
              key={scramble}
              className="hardest-corpus-item"
              href={solverHref(scramble)}
              prefetch={false}
              aria-label={tr({ zh: '在求解器中打开', en: 'Open in the solver' })}
            >
              <span className="hardest-corpus-no">{i + 1}</span>
              <code>{scramble}</code>
            </Link>
          ))}
        </div>
      </section>

      <section className="hardest-section">
        <h2>{tr({ zh: '20 步态:整方最难的那一撮', en: 'Twenty-move states: the hardest of all' })}</h2>
        <p>
          {tr({
            zh: '上面几节量的都是「开局」。换一个口径 —— 整个魔方的最优解 —— 上限是 20 步(上帝之数),'
              + '而 20 步的状态在 4.3 × 10¹⁹ 里只占约 1.1 × 10⁻¹¹。上游有两份这样的语料,本站把它们各算了一遍。',
            en: 'The sections above all measure the opening. Switch to the other notion — the optimal solution '
              + 'for the whole cube — and the ceiling is 20 moves, God’s number, reached by about 1.1 × 10⁻¹¹ '
              + 'of the 4.3 × 10¹⁹ states. Two such corpora exist upstream; both are recomputed here.',
          })}
        </p>
        <p>
          {tr({
            zh: `第一份是 kociemba.org 的 ${groupDigits(String(TWENTY_F_SYM_TOTAL))} 个带非平凡对称性的 20 步态,`
              + '每条都标了对称型。本站用对称分析页那套 48 元群独立复算了一遍 —— '
              + `${groupDigits(String(TWENTY_F_SYM_TOTAL))} 条逐条相同,一个不差。`
              + `33 个对称型里只有 ${TWENTY_F_SYM_CENSUS.length} 个出现过;`
              + `其中 ${TWENTY_F_SYM_SELF_INVERSE.toLocaleString()} 条与自身的逆同构。`,
            en: `The first is kociemba.org’s ${groupDigits(String(TWENTY_F_SYM_TOTAL))} twenty-move states that `
              + 'carry a nontrivial symmetry, each tagged with its point group. Recomputing every tag with the '
              + `48-element group behind our symmetry page reproduces all ${groupDigits(String(TWENTY_F_SYM_TOTAL))} `
              + `of them. Only ${TWENTY_F_SYM_CENSUS.length} of the 33 types occur at all, and `
              + `${TWENTY_F_SYM_SELF_INVERSE.toLocaleString()} of the states are isomorphic to their own inverse.`,
          })}
        </p>
        <table className="hardest-stage-table hardest-census">
          <thead>
            <tr>
              <th scope="col">{tr({ zh: '对称型', en: 'Type' })}</th>
              <th scope="col">{tr({ zh: '条数', en: 'States' })}</th>
              <th scope="col">{tr({ zh: '第一条', en: 'First one' })}</th>
            </tr>
          </thead>
          <tbody>
            {TWENTY_F_SYM_CENSUS.map((c) => (
              <tr key={c.type}>
                <th scope="row">{c.type}</th>
                <td className="hardest-stage-n">{c.count.toLocaleString()}</td>
                <td className="hardest-stage-sol">
                  <Link href={symmetryHref(c.example)} prefetch={false}>{c.example}</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          {tr({
            zh: '表头那条 Oh(48 个元素全在)全语料只有一个,就是 superflip:角块全归位、12 条棱全部原地翻转。'
              + '测试里是逐位验的 —— 角排列、角朝向、棱排列、棱朝向四项,不是靠它有名。',
            en: 'The single Oh entry — all 48 elements — is the superflip: corners home, all twelve edges flipped '
              + 'in place. The test checks that piece by piece (corner permutation, corner orientation, edge '
              + 'permutation, edge orientation) rather than taking its reputation for granted.',
          })}
        </p>
        <p>
          {tr({
            zh: `第二份是 cube20.org 的 ${TWENTY_F_RANDOM_TOTAL} 个随机 20 步态。拿站内纯 TS 求解器量它们的开局,`
              + '三个口径全部比全空间难 —— 整方最难的状态,开局也确实更难开,而且差距远大于采样误差。',
            en: `The second is cube20.org’s ${TWENTY_F_RANDOM_TOTAL} random twenty-move states. Measuring their `
              + 'openings with the in-repo TypeScript solvers puts all three metrics above the whole-space '
              + 'figures: states that are hardest overall really do open harder, by far more than sampling error.',
          })}
        </p>
        <table className="hardest-stage-table">
          <thead>
            <tr>
              <th scope="col">{tr({ zh: '口径', en: 'Metric' })}</th>
              <th scope="col">{tr({ zh: '这 1000 条', en: 'These 1000' })}</th>
              <th scope="col">{tr({ zh: '全空间', en: 'Whole space' })}</th>
              <th scope="col">{tr({ zh: '差', en: 'Gap' })}</th>
            </tr>
          </thead>
          <tbody>
            {([
              [tr({ zh: '单色底十字', en: 'Single-colour cross' }), TWENTY_F_RANDOM_CROSS, TWENTY_F_BASELINE.cross],
              [tr({ zh: '六色底十字', en: 'Colour-neutral cross' }), TWENTY_F_RANDOM_CN_CROSS, TWENTY_F_BASELINE.cnCross],
              [tr({ zh: 'EOCross', en: 'EOCross' }), TWENTY_F_RANDOM_EOCROSS, TWENTY_F_BASELINE.eoCross],
            ] as [string, Record<number, number>, number][]).map(([label, hist, base]) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                <td className="hardest-stage-n">{twentyFMean(hist).toFixed(2)}</td>
                <td className="hardest-stage-n">{base.toFixed(2)}</td>
                <td className="hardest-stage-n">{`+${(twentyFMean(hist) - base).toFixed(2)}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          {tr({
            zh: '前两行的「全空间」是穷举金标,EOCross 那行是 132 万条 WCA 真题的样本均值(与这 1000 条同口径:'
              + '两条 EO 轴取更短的那条)。反过来也有意思:这 1000 条里有一条 ',
            en: 'The whole-space figures on the first two rows are exhaustive gold values; the EOCross row is the '
              + 'sample mean over 1.32M WCA scrambles, measured the same way as these 1000 (the shorter of the '
              + 'two EO axes). The converse is worth a look too — one of the 1000 has ',
          })}
          <Link href={solverHref(TWENTY_F_EASY_CROSS.scramble)} prefetch={false}>
            <code>{TWENTY_F_EASY_CROSS.scramble}</code>
          </Link>
          {tr({
            zh: `,绿底十字一步(${TWENTY_F_EASY_CROSS.moves})就好,整解照样要 20 步。`,
            en: `, whose green cross is one move away (${TWENTY_F_EASY_CROSS.moves}) and which still needs 20 moves overall.`,
          })}
        </p>
        <p className="hardest-source">
          {tr({ zh: '语料来源:', en: 'Corpora: ' })}
          <a href="https://kociemba.org/math/optman/20moves.zip" target="_blank" rel="noreferrer">20moves.zip</a>
          {' · '}
          <a href="https://cube20.org/distance20s/random1000.txt" target="_blank" rel="noreferrer">random1000.txt</a>
        </p>
      </section>

      <section className="hardest-section">
        <h2>{tr({ zh: '几条被反复引用的极难打乱', en: 'A few much-quoted hard scrambles' })}</h2>
        <p>
          {tr({
            zh: '「难」有好几种口径,彼此并不一致:整方 20 步的状态未必开局难,开局难的也未必整方 20 步。'
              + '下表每一阶段都附一条达到该步数的解法。',
            en: 'There is more than one notion of “hard”, and they disagree: a 20-move state need not open '
              + 'badly, and a bad opening need not be 20-move optimal. Each stage below comes with a '
              + 'solution achieving the stated length.',
          })}
        </p>
        <div className="hardest-famous">
          {HARD_SCRAMBLES.map((h) => (
            <div className="hardest-famous-row" key={h.scramble}>
              <Link
                href={solverHref(h.scramble)}
                prefetch={false}
                aria-label={tr({ zh: '在求解器中打开', en: 'Open in the solver' })}
              >
                <ScramblePreview2D event="333" scramble={h.scramble} size={PREVIEW} />
              </Link>
              <div className="hardest-famous-body">
                <p className="hardest-famous-src">{h.source}</p>
                <code className="hardest-famous-scramble">{h.scramble}</code>
                {h.note && <p className="hardest-famous-note">{tr(h.note)}</p>}
                <table className="hardest-stage-table">
                  <tbody>
                    <tr>
                      <th scope="row">{tr({ zh: '整方最优', en: 'Optimal' })}</th>
                      <td className="hardest-stage-n">{h.optimal}</td>
                      <td className="hardest-stage-sol">
                        {tr({
                          zh: h.length === h.optimal ? '打乱本身就是最优解的逆' : `打乱长度 ${h.length}`,
                          en: h.length === h.optimal
                            ? 'the scramble itself is an inverse optimal solve'
                            : `scramble is ${h.length} moves long`,
                        })}
                      </td>
                    </tr>
                    {h.stages.map((s) => (
                      <tr key={s.key}>
                        <th scope="row">{STAGE_LABEL[s.key]}</th>
                        <td className="hardest-stage-n">{s.count}</td>
                        <td className="hardest-stage-sol">{s.solution}</td>
                      </tr>
                    ))}
                    {h.eo != null && (
                      <tr>
                        <th scope="row">EO</th>
                        <td className="hardest-stage-n">{h.eo}</td>
                        <td className="hardest-stage-sol" />
                      </tr>
                    )}
                  </tbody>
                </table>
                {h.partner && (
                  <p className="hardest-famous-note">
                    {tr(h.partner.label)}
                    <br />
                    <Link
                      className="hardest-famous-scramble"
                      href={solverHref(h.partner.scramble)}
                      prefetch={false}
                    >
                      {h.partner.scramble}
                    </Link>
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <p className="hardest-source">
        {tr({
          zh: `${CN_XCROSS_10_TOTAL} 条全表与 ${ESSENTIAL} 条代表、以及上面几条著名打乱的各阶段步数,`
            + '来自一份自建的三阶统计表格,单条打乱的出处保留在各自的署名里;'
            + '本站自己复核到哪一步,见上文「证到哪一步了」。',
          en: `The full list of ${CN_XCROSS_10_TOTAL}, the ${ESSENTIAL} representatives and the per-stage `
            + 'numbers of the famous scrambles come from a hand-built 3×3 statistics workbook; each '
            + 'individual scramble keeps its own credit line above. What this site re-derived itself is '
            + 'spelled out under “How much of this is proved”.',
        })}
      </p>
    </div>
  );
}
