'use client';

import MoreToggle from '@/components/MoreToggle';
import { useT } from '@/hooks/useT';
import { MathProse, TeXBlock } from './Math';
import styles from './explainer.module.css';

const source = 'https://github.com/Deicyde/riemann-hypothesis/blob/40e56bab026552e089d7afcfeff08d2defb9c005/src';
const arithmetic = source + '/Development/AutomorphicArithmetic';
const boxes = arithmetic + '/CharacterBoxes';
const theta = arithmetic + '/ThetaCorrespondence/ThetaPairLifts/ThirdPlaceSeries';
const remark = 'https://alpo.ge/remark.pdf';

export default function ProofRoute() {
  const t = useT();

  return (
    <section id="proof-route" aria-labelledby="proof-route-title" className={styles.section}>
      <h2 id="proof-route-title">{t('这份证明怎样排除偏离临界线的零点？', 'How does the proof rule out zeros off the line?')}</h2>
      <p className={styles.intro}>{t(
        'Alpöge 选择同时控制一整族与素数分布有关的函数。这个目标比经典黎曼猜想更强。公告讲述他和 Claude 如何找到这条路线，Lean 源码则写出了需要逐项成立的数学命题。',
        'Alpöge aims to control an entire family of functions that encode the distribution of primes. This is a stronger target than classical RH. His announcement recounts how he and Claude arrived at the approach. The Lean files give the mathematical statements on which it depends.',
      )}</p>
      <ol className={styles.steps}>
        <li>
          <h3 className={styles.stepTitle}>{t('从素数的加权和寻找重数', 'Looking for multiplicity in a weighted prime sum')}</h3>
          <p><MathProse>{t(
            String.raw`把每个素数 \(p\) 的幂都赋予权重 \(\log p\)，其余正整数赋予零，就得到冯·曼戈尔特函数 \(\Lambda\)。作者的时间线记载，10 月 20 日，他把注意力转到一个平滑的 \(\Lambda\) 加权和。权重随 \(n\) 增大而下降，直到截止点 \(X\) 变为零。`,
            String.raw`Give each power of a prime \(p\) the weight \(\log p\) and every other positive integer weight zero. This is the von Mangoldt function \(\Lambda\). Alpöge dates his switch to a smoothed sum of \(\Lambda\) to October 20. The factor multiplying \(\Lambda(n)\) decreases as \(n\) approaches the cutoff \(X\) and vanishes there.`,
          )}</MathProse></p>
          <p className={styles.math}><TeXBlock src={String.raw`\sum_{n\le X}\Lambda(n)\left(\frac{X}{n}-1\right)`} /></p>
          <p><MathProse>{t(
            String.raw`在 Stepanov 的函数域方法里，可以让辅助函数在许多点有高重数的零点。作者想在整数问题里获得类似的约束。他在 11 月 15 日的记录中提出，在一串全定酉群之间作 \(m\) 次 \(\theta\) 提升，每升一次积累一重，令 \(m\) 与 \(\sqrt X\) 同阶。这里的 \(\theta\) 提升把一个群上的自守表示传到另一个群上。`,
            String.raw`In Stepanov’s function-field method an auxiliary function can be made to vanish to high order at many points. Alpöge sought a comparable constraint over the integers. His November 15 entry describes a chain of \(m\) theta lifts between totally definite unitary groups. Each lift transfers an automorphic representation to another group. He proposes gaining one unit of multiplicity per lift, with \(m\) on the scale of \(\sqrt X\).`,
          )}</MathProse></p>
          <details className={styles.detail}>
            <MoreToggle as="summary">{t('主项、周期与整除性', 'Main terms, periods and divisibility')}</MoreToggle>
            <p><MathProse>{t(
              String.raw`公告第 3 页从这个和中扣除 \(X\log X\)，再加回 \((1+\gamma)X\)，其中 \(\gamma\) 为欧拉常数。第 4 页记下了延长提升链的代价。每次提升都会影响范数和层级。作者描述了如何用跷跷板恒等式将迭代提升的周期表示成与 Hecke 特征无关的 Bessel 周期，并在不同特征之间拼接整结构以取得额外整除性。他把结论记在 11 月 16 日。这些日期和思路来自作者的回顾。`,
              String.raw`Page 3 subtracts \(X\log X\) from the displayed sum and adds back \((1+\gamma)X\), with \(\gamma\) denoting Euler’s constant. Page 4 describes the cost of a long chain in terms of the norms and levels of its lifts. The author describes a seesaw identity expressing the iterated period as a Bessel period independent of the Hecke characters, then gluing integral structures across characters to obtain extra divisibility. His retrospective dates the conclusion to November 16.`,
            )}</MathProse></p>
          </details>
          <div className={styles.sources}><a href={remark + '#page=3'}>{t('作者时间线，第 3 页', 'Author’s timeline, p. 3')}</a><a href={remark + '#page=4'}>{t('迭代提升，第 4 页', 'Iterated lifts, p. 4')}</a></div>
        </li>
        <li>
          <h3 className={styles.stepTitle}>{t('在一整段尺度上控制算术误差', 'Bounding an arithmetic contribution across a range of scales')}</h3>
          <p><MathProse>{t(
            String.raw`源码有一处可以精确核对的要求，名叫 VWin。对每个本原狄利克雷特征，证明需要找到一段从 \(Y\) 到 \(Y^2\) 的尺度，使其中每个 \(x\) 都满足同一个上界。控制的是一批上同调群的大小，这些群记录了局部条件尚未排除的算术类。`,
            String.raw`The source makes one requirement precise under the name VWin. For each primitive Dirichlet character it calls for an interval from \(Y\) to \(Y^2\) on which a bound holds at every scale \(x\). It controls the size of groups of cohomology classes that survive specified local conditions.`,
          )}</MathProse></p>
          <details className={styles.detail}>
            <MoreToggle as="summary">{t('VWin 的量词与 Galois 表示的作用', 'The quantifiers in VWin and the Galois representation input')}</MoreToggle>
            <p><MathProse>{t(
              String.raw`固定 \(0<\varepsilon<\tfrac{1}{52}\)，并按 PageN 选定尺度参数。对充分大的 \(X\) 和满足 WinPair 的辅助素数 \(q\)、\(d\)，VWin 要求存在这样的区间。对指定的分圆子域、任何有限素数集 \(S\)，把每个素数 \(\ell\) 上各扭次的 shaLen 相加，再以 \(\log\ell\) 加权。扭次从 1 到 \(\lfloor x^{401}\rfloor\) 之前，总和至多为 \(\exp\!\left(\tfrac{x^{\varepsilon}}{2}\right)\)。shaLen 是相应局部化核作为 \(\ell\) 进整数环上模的长度。`,
              String.raw`Fix \(0<\varepsilon<\tfrac{1}{52}\) and a choice of scale parameters satisfying PageN. For sufficiently large \(X\) and auxiliary primes \(q\) and \(d\) satisfying WinPair, VWin requires such an interval. Over the prescribed cyclotomic subfields, sum shaLen over twists from 1 up to, but excluding, \(\lfloor x^{401}\rfloor\). Weight each prime \(\ell\) by \(\log\ell\) and sum over any finite set of primes. The required bound is \(\exp\!\left(\tfrac{x^{\varepsilon}}{2}\right)\). Here shaLen is the length over the \(\ell\)-adic integers of the relevant localization kernel.`,
            )}</MathProse></p>
            <p><MathProse>{t(
              String.raw`vwin_of_row 从 Row0b 得到这个区间估计。Row0b 要求给 CM 数域上满足正则代数性和极化条件的尖点表示配上连续半单的 \(\ell\) 进 Galois 表示，并规定局部相容性与权。在 RowSrc 中，源码把一个 \(\theta\) 提升结果传给 galoisRepresentations_of_thetaLift，得到最终调用的 Row0b。`,
              String.raw`The declaration vwin_of_row takes Row0b as an input. Row0b attaches a continuous semisimple \(\ell\)-adic Galois representation to a regular algebraic polarized cuspidal pair over a CM field, with conditions on its local parameters and weights. In RowSrc, the source supplies a theta-lift result to galoisRepresentations_of_thetaLift to produce the required instance of Row0b.`,
            )}</MathProse></p>
          </details>
          <div className={styles.sources}>
            <a href={boxes + '/ExistsPageN.lean#L11-L49'}>{t('区间与上界的定义', 'Window and bound')}</a>
            <a href={source + '/Formalism/GaloisCohomology/Statement.lean#L65-L78'}>shaLen</a>
            <a href={arithmetic + '/Foundations/GaloisRepresentations/TypeConditions/WeightsConjBis.lean#L54-L73'}>Row0b</a>
            <a href={arithmetic + '/Foundations/GaloisRepresentations/IntegralStructures/RowSrc.lean#L1-L6'}>RowSrc</a>
            <a href={arithmetic + '/AutomorphicVarieties/ModularityArgument/ThresholdArguments/DenseThresholdCases/VwinOfRow.lean#L1-L5'}>vwin_of_row</a>
          </div>
        </li>
        <li>
          <h3 className={styles.stepTitle}>{t('对每个狄利克雷特征排除零点', 'Excluding zeros for every Dirichlet character')}</h3>
          <p><MathProse>{t(
            String.raw`这个区间估计只是源码所需的一项输入。另一个引理把 VWin、\(\theta\) 积分相等、局部匹配、余体积上界等条件合在一起，结论是 EveryCharacter。它说，对一切正模数和特征 \(\chi\)，只要 \(\operatorname{Re}(s)>\tfrac12\)，\(L(s,\chi)\) 就不为零，其中排除平凡特征在 \(s=1\) 的情形。`,
            String.raw`The window estimate supplies one input. A further lemma combines it with equality of theta integrals, local matching, a covolume bound and other inputs to reach EveryCharacter. This asserts that for every positive modulus and every character \(\chi\), \(L(s,\chi)\) is nonzero when \(\operatorname{Re}(s)>\tfrac12\), with the principal character at \(s=1\) excluded.`,
          )}</MathProse></p>
          <p>{t(
            '可以在 MainConclusion 读到这些前提如何接上。everyCharacter_of_row 用同一个 Galois 表示结果填入两个前提，另传入局部 Langlands 参数的存在性和区间估计。下一条声明再传入 RowSrc 给出的证明。因此最终声明的类型里没有这些前提，检验其证明仍须检查被引用的声明。',
            'MainConclusion shows how the remaining hypotheses are supplied. The proof of everyCharacter_of_row uses the same Galois representation result for two fields of a record, supplies existence of local Langlands parameters for the third, and passes in the window estimate. The next declaration supplies the proof from RowSrc. This gives everyCharacter an unconditional type whose proof depends on those earlier declarations.',
          )}</p>
          <div className={styles.sources}>
            <a href={theta + '/SiegelEisensteinSecondTermHypotheses.lean#L69-L73'}><MathProse>{t(
              String.raw`\(\theta\) 积分与局部匹配`,
              String.raw`Theta integrals and local matching`,
            )}</MathProse></a>
            <a href={theta + '/EveryCharacterOfLiteratureOfVWin.lean#L810-L813'}>{t('合并条件的引理', 'Combining the inputs')}</a>
            <a href={boxes + '/MainConclusion.lean#L7-L14'}>MainConclusion</a>
          </div>
        </li>
        <li>
          <h3 className={styles.stepTitle}>{t('取模 1 的特征，回到经典黎曼猜想', 'Specializing to the Riemann zeta function')}</h3>
          <p><MathProse>{t(
            String.raw`模 1 的平凡特征给出的 L 函数正是 \(\zeta\) 函数。取这个特例，再用函数方程反射零点，就得到经典黎曼猜想。本次单独运行的 checked_reduction 已在 Lean 中验证了这条蕴含，右半平面无零点是它的显式前提。本次完整核验也检查了给出这一前提的证明。`,
            String.raw`For the trivial character modulo 1 the L-function is \(\zeta\) itself. Taking that case and reflecting zeros with the functional equation yields classical RH. Our separate Lean check of checked_reduction verified this implication with right-half-plane nonvanishing as an explicit premise. The full kernel replay also checked the proof that supplies that premise.`,
          )}</MathProse></p>
          <div className={styles.sources}><a href={source + '/Formalism/GammaFactorNonvanishing/CritLine.lean#L29-L32'}>rh_of_every</a><a href={source + '/Formalism/GammaFactorNonvanishing/RhOfRight.lean#L5-L62'}>rh_of_right</a><a href={source + '/Main.lean#L4-L12'}>{t('发布的最终声明', 'Released theorem statements')}</a></div>
        </li>
      </ol>
    </section>
  );
}
