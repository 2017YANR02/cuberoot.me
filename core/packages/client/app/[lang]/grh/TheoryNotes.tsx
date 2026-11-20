'use client';

import { useT } from '@/hooks/useT';
import styles from './explainer.module.css';

export default function TheoryNotes() {
  const t = useT();
  return (
    <section id="theory-value" aria-label={t('素数与方法', 'Primes and proof methods')}>
      <section className={styles.section} id="grh-primes" aria-labelledby="grh-primes-title">
        <h2 id="grh-primes-title">{t('黎曼猜想能把素数数得多准？', 'How accurately can we count primes?')}</h2>
        <p className={styles.intro}>{t(
          '一百万以内有 78,498 个素数。把素数的平均密度 1/log t 累积起来，对数积分 Li 给出的估计约为 78,628，差了约 130 个。换一个上限，误差也会变。黎曼猜想关心的是，这个误差随着上限增长，最大能有多大。',
          'There are 78,498 primes up to one million. The logarithmic integral Li, which accumulates the average density 1/log t, predicts about 78,628. The difference is about 130. Change the cutoff and the discrepancy changes. The Riemann Hypothesis would bound how large that discrepancy can grow.',
        )}</p>
        <h3>{t('为什么一个函数会知道素数的事？', 'How do primes get into the zeta function?')}</h3>
        <p>{t('每个大于 1 的整数都有唯一的素因数分解。欧拉利用这一点，把对所有正整数的求和改写成对所有素数的乘积。例如，展开乘积时，从素数 2 的那一项选出平方，从 3 的那一项选出一次幂，其余都选 1，就恰好得到整数 12 对应的项。',
          'Every integer greater than 1 factors uniquely into primes. Euler used this to rewrite a sum over all positive integers as a product over primes. To obtain the term for 12, take the second power from the factor for 2, the first power from the factor for 3, and 1 from every other factor.')}</p>
        <p className={styles.math}>ζ(s) = ∑<sub>n ≥ 1</sub> n<sup>−s</sup> = ∏<sub>p {t('为素数', 'prime')}</sub> (1 − p<sup>−s</sup>)<sup>−1</sup>, &nbsp; Re(s) &gt; 1</p>
        <p>{t('这个等式在 Re(s) > 1 时收敛。通过解析延拓，同一个函数可以在临界带中研究。黎曼的发现是，这里的零点反过来决定素数计数偏离平滑估计的方式。',
          'These expressions converge for Re(s) > 1. Analytic continuation carries the same function into the critical strip. Riemann showed how its zeros there enter the fluctuations of the prime count around a smooth estimate.')} <a href="https://dlmf.nist.gov/25.2">{t('ζ 函数的级数与欧拉乘积', 'The series and the Euler product')}</a></p>
        <h3>{t('误差能控制在什么范围？', 'What bound does RH give for the error?')}</h3>
        <p className={styles.math}>π(x) = Li(x) + O(√x log x)</p>
        <p>{t(
          'π(x) 是不超过 x 的素数个数。上式的精确含义是，存在一个固定常数 C，使得对每个足够大的 x，计数误差的绝对值都不超过 C√x log x。素数定理已知相对误差趋于零。这个更精细的误差界与经典黎曼猜想等价。黎曼的显式公式把素数计数围绕平滑估计的起伏与 ζ 函数的零点直接联系起来。',
          'Here π(x) counts the primes up to x. The formula says that a single constant C bounds the absolute error by C√x log x for every sufficiently large x. The prime number theorem already tells us the relative error tends to zero. This sharper bound is equivalent to the classical Riemann Hypothesis. Riemann’s explicit formula explains the connection by expressing fluctuations in prime counts in terms of the zeros of ζ.',
        )} <a href="https://www.claymath.org/wp-content/uploads/2022/05/riemann.pdf#page=4">{t('Bombieri 的说明，第 4 页', 'Bombieri’s account, p. 4')}</a>
          {' · '}<a href="https://www.claymath.org/collections/riemanns-1859-manuscript/">{t('黎曼 1859 年手稿', 'Riemann’s 1859 manuscript')}</a></p>
      </section>

      <section className={styles.section} id="grh-theory" aria-labelledby="grh-theory-title">
        <h2 id="grh-theory-title">{t('论证中有哪些想法值得学？', 'Which ideas can we learn from the argument?')}</h2>
        <h3 className={styles.stepTitle}>{t('从重根学到的计数办法', 'What repeated roots can tell us')}</h3>
        <p>{t(
          '在一个域上，12 次多项式最多有 12 个不同的根。如果每个根至少是三重根，最多就只有 4 个不同的根。斯捷潘诺夫在有限域上数曲线的点时，也利用了重数。他构造一个辅助函数，让每个待数的点都成为高重数的零点。这样就能用零点总重数的上界来约束点数。',
          'Over a field, a degree-12 polynomial has at most 12 distinct roots. If every root has multiplicity at least three, there can be at most four distinct roots. This illustrates how multiplicity helps in Stepanov’s method for counting points on curves over finite fields. One constructs an auxiliary function so that each point being counted uses up several of its allowed zeros.',
        )} <a href="https://doi.org/10.1070/IM1969v003n05ABEH000834">{t('斯捷潘诺夫的论文（1969）', 'Stepanov’s paper (1969)')}</a></p>
        <h3 className={styles.stepTitle}>{t('作者提出怎样把它用到整数上？', 'How does Alpöge propose to carry that idea over to integers?')}</h3>
        <p>{t(
          'Alpöge 说，他和 Claude 在一个简化模型中找到了新的傅里叶分析思路。到了整数上，他们用一串 θ 提升来模拟重数。一次 θ 提升把自守形式从一个群传到另一个群。在作者描述的方案中，要估计长度为 X 的冯·曼戈尔特加权和，所用提升次数 m 约为 √X。这个和用 log p 给素数 p 的每个正整数次幂加权。',
          'Alpöge describes Fourier-analytic ideas that he and Claude found in a simpler model and that he considers new. Over the integers, they propose to mimic multiplicity through a chain of theta lifts. A lift transfers an automorphic form from one group to another. For a von Mangoldt sum of length X, which weights positive powers of each prime p by log p, he proposes taking about √X lifts.',
        )} <a href="https://alpo.ge/remark.pdf#page=1">{t('作者公告，第 1 页', 'Alpöge’s announcement, p. 1')}</a></p>
        <p>{t(
          '这是否形成了可复用的新理论，还需独立研究。一个可动手的问题是，先写出两个全定酉群之间的第一步提升，再接上第二步。第二步究竟多给了什么整除性？范数增加了多少？如果能把这种得失写成对 m 一致的估计，就能解释为什么链长可随 X 增长，也能看清哪些条件值得在别的问题上尝试。作者的时间线把这些问题分别列在第 8 至 10 项和第 14 项。',
          'Whether this yields a reusable new theory remains open to independent study. One starting point is to write down a lift between two totally definite unitary groups and then compose it with a second lift. What extra divisibility does step two supply? How much does the norm grow? An estimate uniform in the number of lifts would explain how the chain could grow with X and identify hypotheses to try on another problem. These gains and costs appear in items 8–10 and 14 of the author’s timeline.',
        )} <a href="https://alpo.ge/remark.pdf#page=4">{t('方法时间线，第 4 页', 'Method timeline, p. 4')}</a></p>
        <p>{t(
          'Lean 能检查每个形式化推导是否符合规则。要把一个方法教给别人，还要指出起作用的假设，演示一次计算，并解释它在哪些情形下仍然有效。作者在公告中把这样一份可读的说明列为后续工作。',
          'Lean can check that the formal deductions follow its rules. Teaching the method takes a worked calculation, an account of which hypotheses do the work, and an explanation of where else they hold. Alpöge identifies a readable exposition as a further step.',
        )} <a href="https://alpo.ge/remark.pdf#page=2">{t('作者对后续写作的说明，第 2 页', 'Alpöge on the planned exposition, p. 2')}</a></p>
      </section>
    </section>
  );
}
