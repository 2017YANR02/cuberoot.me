'use client';

/**
 * /math/probability — 情况概率与旋转对称。
 *
 * 为什么 H perm 是 1/72 而 T perm 是 1/18?答案是群论:一个 case 是全体顶层状态
 * 在「起手 AUF × 收尾 AUF」(Z4 × Z4)双边作用下的一条轨道,轨道-稳定子定理给出
 * P(case) = (16 / 对称阶) / 全集大小。页内所有数字均由浏览器现场枚举自证。
 *
 * 面板:
 *   1. UniverseBuilder — 顶层四个自由度,数出 62,208 / 7,776 / 288 / 384
 *   2. OrbitExplorer  — 选一个 PLL,画出 16 个 AUF 像,数重合
 *   3. BurnsideLab    — 五个全集现场枚举 + Burnside 不动点交叉验证
 *   4. SetAccounting  — 拉公式库对账 + 训练概率速查
 */
import Link from '@/components/AppLink';
import dynamic from 'next/dynamic';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { TeX, TeXBlock } from '@/components/math/Tex';
import './probability.css';
import { useT } from '@/hooks/useT';
import { T } from '@/i18n/tr';

// 四个都是长文里的交互实验块:占位撑住高度,chunk 落地时不把下文顶开(CLS)。
const labBox = () => <div style={{ minHeight: 360 }} aria-hidden="true" />;
const UniverseBuilder = dynamic(() => import('./_components/UniverseBuilder'), { ssr: false, loading: labBox });
const OrbitExplorer = dynamic(() => import('./_components/OrbitExplorer'), { ssr: false, loading: labBox });
const BurnsideLab = dynamic(() => import('./_components/BurnsideLab'), { ssr: false, loading: labBox });
const SetAccounting = dynamic(() => import('./_components/SetAccounting'), { ssr: false, loading: labBox });
const SkipTable = dynamic(() => import('./_components/SkipTable'), { ssr: false, loading: labBox });
const EoAxes = dynamic(() => import('./_components/EoAxes'), { ssr: false, loading: labBox });
const SkewbOdds = dynamic(() => import('./_components/SkewbOdds'), { ssr: false, loading: labBox });

export default function ProbabilityPage() {
  useTranslation();
  const t = useT();
  useDocumentTitle('情况概率与旋转对称', 'Case Probability & Symmetry');

  return (
    <div className="prob-page">
      <header className="prob-header">
        <Link href="/math" className="prob-back">
          <ArrowLeft size={16} />
          <span>{t('返回 数学', 'Back to Math')}</span>
        </Link>
      </header>

      <main className="prob-main">
        <section className="prob-hero">
          <div className="prob-eyebrow">{t('数学 群论 组合计数', 'Mathematics Group Theory Enumeration')}</div>
          <h1 className="prob-title">
            {t('情况概率与旋转对称', 'Case Probability & Rotational Symmetry')}
            <span className="prob-title-sub">
              {t('为什么 H perm 是 1/72,T perm 却是 1/18?', 'Why is H perm 1/72 while T perm is 1/18?')}
            </span>
          </h1>
          <p className="prob-lead">
            <T
              zh={<>
                任何一张 PLL / OLL / ZBLL / 1LLL 概率表里,数字都只有寥寥几档:1/18、1/36、1/72……
                这不是巧合,而是<strong>轨道-稳定子定理</strong>在工作。顶层还剩什么状态是均匀随机的,
                而「同一个 case」的定义里藏着一个群作用:打乱前后各转一下 U 层(起手 / 收尾 AUF),
                case 不变 —— 这是 <TeX src={String.raw`\mathbb{Z}_4 \times \mathbb{Z}_4`} />(16 个元素)的作用。
                case 越对称,它的轨道越小,出现概率越低。本页所有数字都由你的浏览器现场枚举验证。
              </>}
              en={<>
                Every PLL / OLL / ZBLL / 1LLL probability sheet uses only a handful of values: 1/18, 1/36, 1/72…
                That is no accident — it is the <strong>orbit–stabiliser theorem</strong> at work. The remaining
                last-layer state is uniformly random, and the very definition of “the same case” hides a group
                action: turning the U layer before or after the scramble (pre / post AUF) leaves the case unchanged —
                an action of <TeX src={String.raw`\mathbb{Z}_4 \times \mathbb{Z}_4`} /> (16 elements).
                The more symmetric a case, the smaller its orbit and the rarer it appears. Every number on this
                page is verified by live enumeration in your browser.
              </>}
            />
          </p>

          <div className="prob-numbers">
            <div className="prob-num-card">
              <div className="prob-num">62,208</div>
              <div className="prob-num-label">{t('顶层状态(1LLL 全集)', 'last-layer states (1LLL universe)')}</div>
            </div>
            <div className="prob-num-card">
              <div className="prob-num">3,916</div>
              <div className="prob-num-label">{t('轨道 = case 数(含还原)', 'orbits = cases (incl. solved)')}</div>
            </div>
            <div className="prob-num-card">
              <div className="prob-num">16</div>
              <div className="prob-num-label">{t('AUF 群 Z4 × Z4 的大小', 'size of the AUF group Z4 × Z4')}</div>
            </div>
          </div>
        </section>

        <section className="prob-section">
          <h2 className="prob-h2">{t('一 全集:顶层还有多少种可能', '1 The universe: how many states remain')}</h2>
          <p className="prob-body">
            <T
              zh={<>
                底两层还原后,顶层还剩四个自由度:角朝向、棱朝向、角排列、棱排列。
                它们相乘再除以一个奇偶约束,就是「全集」—— 概率的分母。
                选择不同的解法体系,等于提前解决了其中几个自由度:ZZ 到达顶层时棱已定向(ZBLL 全集),
                CFOP 做完 OLL 时朝向全部解决(PLL 全集)。
              </>}
              en={<>
                With the first two layers done, four degrees of freedom remain: corner orientation, edge
                orientation, corner permutation, edge permutation. Multiply them, divide by one parity
                constraint, and you get the “universe” — the denominator of every probability. Different method
                choices pre-solve some freedoms: ZZ reaches the last layer with edges oriented (the ZBLL
                universe), CFOP finishes OLL with all orientation solved (the PLL universe).
              </>}
            />
          </p>
          <UniverseBuilder />
        </section>

        <section className="prob-section">
          <h2 className="prob-h2">{t('二 什么叫「同一个 case」:AUF 轨道', '2 What “the same case” means: AUF orbits')}</h2>
          <p className="prob-body">
            <T
              zh={<>
                打乱前把 U 层预转一下,或者打乱后把 U 层转回识别角度,你手里的公式照用不误 ——
                所以这 16 种「起手 × 收尾」变换连出来的所有状态,才算<em>一个</em> case。
                群论的说法:case = 状态集合在 <TeX src={String.raw`\mathbb{Z}_4 \times \mathbb{Z}_4`} /> 双边作用下的<strong>轨道</strong>。
                下面把任意一个 PLL 的 16 个像全画出来:
              </>}
              en={<>
                Pre-turn the U layer before the scramble, or adjust it afterwards for recognition — your
                algorithm still applies. So all states connected by these 16 pre × post transformations count
                as <em>one</em> case. In group-theoretic terms: a case is an <strong>orbit</strong> of the
                two-sided <TeX src={String.raw`\mathbb{Z}_4 \times \mathbb{Z}_4`} /> action. Below, all 16
                images of any PLL you pick:
              </>}
            />
          </p>
          <OrbitExplorer />
        </section>

        <section className="prob-section">
          <h2 className="prob-h2">{t('三 数 case:Burnside 引理', '3 Counting cases: Burnside’s lemma')}</h2>
          <p className="prob-body">
            <T
              zh={<>
                「PLL 有 21 个」「OLL 有 57 个」「ZBLL 有 472 个」—— 这些魔方常识本质上都是<strong>轨道计数</strong>。
                Burnside 引理说:轨道数 = 群里每个元素不动点数的平均值。下面对五个全集现场验证,
                你可以看到 3,916 这个数字(3,915 个 1LLL + 还原)是怎么从 62,208 个状态里数出来的。
              </>}
              en={<>
                “There are 21 PLLs”, “57 OLLs”, “472 ZBLLs” — each of these cubing facts is really an
                <strong> orbit count</strong>. Burnside’s lemma says: the number of orbits equals the average
                number of fixed points over the group. Below it is verified live for five universes — watch
                3,916 (3,915 one-look-LL cases + solved) fall out of 62,208 states.
              </>}
            />
          </p>
          <BurnsideLab />
        </section>

        <section className="prob-section">
          <h2 className="prob-h2">{t('四 概率公式与公式库对账', '4 The probability formula, audited against the database')}</h2>
          <TeXBlock src={String.raw`P(\text{case}) \;=\; \frac{|\text{orbit}|}{|\text{universe}|} \;=\; \frac{16 / c_n}{|\text{universe}|}
            \qquad c_n = |\text{stabiliser}| \in \{1, 2, 4\}`} />
          <p className="prob-body">
            <T
              zh={<>
                其中 <TeX src="c_n" /> 是 case 的旋转对称阶,就是公式库元数据里那个 C1 / C2 / C4。
                同一个 case 在不同全集下概率不同:一个无对称 ZBLL 在 ZBLL 全集里是 1/486,
                放进 1LLL 全集就摊薄成 1/3888(除以 8 份棱朝向)。
              </>}
              en={<>
                Here <TeX src="c_n" /> is the case’s rotational symmetry order — the C1 / C2 / C4 in the alg
                database metadata. The same case has different probabilities in different universes: an
                asymmetric ZBLL is 1/486 in the ZBLL universe, but dilutes to 1/3888 in the 1LLL universe
                (divided across the 8 edge-orientation classes).
              </>}
            />
          </p>
          <SetAccounting />
        </section>

        <section className="prob-section">
          <h2 className="prob-h2">{t('五 跳步速查表', '5 The skip lookup table')}</h2>
          <p className="prob-body">
            <T
              zh={<>
                「OLL 跳步是多少?」这类问题的答案全在下表,而且每一条都是现场从状态空间算出来的整数比,
                不是抄来的小数。顶层那一族直接在 62,208 里数;十字、2×2×2 块与 Roux 那三族要用容斥 ——
                同一个底色的几个目标会共用棱块,不能简单相加。
                最后一张表把任意一条概率放进二项分布:一轮 N 把里恰好跳几次、至少跳几次。
              </>}
              en={<>
                &quot;What are the odds of an OLL skip?&quot; — the whole family is below, and every row is an
                integer ratio computed from the state space rather than a transcribed decimal. The last-layer
                rows are counted directly inside the 62,208-state universe; the cross, 2×2×2 and Roux rows need
                inclusion-exclusion, because goals of the same family share pieces and cannot simply be added.
                The last table drops any of those probabilities into a binomial: how many skips in a round of N.
              </>}
            />
          </p>
          <SkipTable />
        </section>

        <section className="prob-section">
          <h2 className="prob-h2">{t('六 三个轴的坏棱不是各算各的', '6 Bad edges: the three axes are not independent')}</h2>
          <p className="prob-body">
            <T
              zh={<>
                一个打乱有三个 EO 轴,每个轴上都有一个「坏棱数」。人人都知道平均是 6 条 ——
                那是<strong>单个轴</strong>的平均。但 ZZ 选 EO 轴、DR 选方向时,看的是三个轴里最少的那个,
                而三个轴的联合分布并不是三次独立抽样:坏棱数必为偶数,三个数的极差还不能超过 8。
              </>}
              en={<>
                A scramble has three EO axes, each with its own bad-edge count. Everyone knows the average is
                six — that is the average for <strong>one axis</strong>. But choosing an EO axis in ZZ, or a
                direction in DR, means taking the best of the three, and the joint distribution is not three
                independent draws: every count is even, and the spread between them can never exceed eight.
              </>}
            />
          </p>
          <EoAxes />
        </section>

        <section className="prob-section">
          <h2 className="prob-h2">{t('七 斜转:棒、灯与首层', '7 Skewb: bars, lights and the first layer')}</h2>
          <p className="prob-body">
            <T
              zh={<>
                斜转只有 314 万个状态,所以这一节里没有一个数是估的 —— 全空间数一遍就完事。
                两个识别口径按术语表的原义:<strong>棒</strong>是两格连在一起同色(斜转上就是中心与同面的角块),
                <strong>灯</strong>是一条线去掉中间那个点(一条棱两端的两个角块)。
                另外一条值得记住:角块全好、只剩中心的那 359 个非还原态,最少也要 <strong>8 步</strong> ——
                「七步纯中心」并不存在。
              </>}
              en={<>
                A Skewb has only 3.1 million states, so nothing here is estimated — the whole space is simply
                counted. The two recognition terms follow the glossary: a <strong>bar</strong> is two connected
                stickers of one colour (on a Skewb, a centre and a corner on the same face), and
                a <strong>light</strong> is a line minus its middle dot (the two corners at the ends of one edge).
                One more thing worth remembering: of the 359 unsolved states whose corners are all done, the
                easiest still needs <strong>8 moves</strong> — a seven-move pure-centre case does not exist.
              </>}
            />
          </p>
          <SkewbOdds />
        </section>

        <section className="prob-section">
          <h2 className="prob-h2">{t('延伸阅读', 'Further reading')}</h2>
          <ul className="prob-refs">
            <li>
              <Link href="/math/group" className="prob-link">{t('魔方与群:群论长文(轨道、稳定子、Burnside 的完整推导)', 'Cube as a group: the long-form essay (orbits, stabilisers, Burnside in full)')}</Link>
            </li>
            <li>
              <Link href="/alg/3x3/zbll" className="prob-link">{t('ZBLL 公式库(每个 case 的弹窗都标了概率)', 'The ZBLL library (every case popup shows its probability)')}</Link>
            </li>
            <li>
              <Link href="/alg/3x3/pll" className="prob-link">{t('PLL 公式库', 'The PLL library')}</Link>
            </li>
          </ul>
        </section>
      </main>
    </div>
  );
}
