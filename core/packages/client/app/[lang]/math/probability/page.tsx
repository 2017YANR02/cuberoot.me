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

const UniverseBuilder = dynamic(() => import('./_components/UniverseBuilder'), { ssr: false });
const OrbitExplorer = dynamic(() => import('./_components/OrbitExplorer'), { ssr: false });
const BurnsideLab = dynamic(() => import('./_components/BurnsideLab'), { ssr: false });
const SetAccounting = dynamic(() => import('./_components/SetAccounting'), { ssr: false });

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
