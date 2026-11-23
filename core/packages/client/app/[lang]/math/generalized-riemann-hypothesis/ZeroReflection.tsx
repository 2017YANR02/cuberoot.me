'use client';

import { useState } from 'react';
import { useT } from '@/hooks/useT';
import { TeX, MathProse } from './Math';
import styles from './explainer.module.css';

export default function ZeroReflection() {
  const t = useT();
  const [hundredths, setHundredths] = useState(30);
  const beta = (hundredths / 100).toFixed(2);
  const reflected = (1 - hundredths / 100).toFixed(2);
  const conclusion = hundredths < 50
    ? t('假想的零点在左半边，对称零点落到了右半边。如果右半边无零点，这个假设就会产生矛盾。',
        'The hypothetical zero is on the left. Its partner would be on the right, contradicting a zero-free right half.')
    : hundredths > 50
      ? t('假想的零点本身就在右半边。如果能证明那里无零点，就直接排除了这个位置。',
          'The hypothetical zero itself lies on the right. A proof that this region is zero-free would rule it out directly.')
      : t(String.raw`两个实部都等于 \(\tfrac12\)。即使排除了右半边的所有零点，临界线上的零点仍然可以存在。`,
          String.raw`Both real parts are \(\tfrac12\). Ruling out zeros on the right still allows zeros on the critical line.`);

  return <section id="symmetry" className={styles.exercise} aria-labelledby="grh-reflection-title">
    <div className={styles.exerciseText}>
      <h3 id="grh-reflection-title">{t('试着放置一个偏离临界线的零点', 'Try placing a zero off the critical line')}</h3>
      <p><MathProse>{t(String.raw`这里取黎曼 \(\zeta\) 函数。用滑块假设它在临界带内有个零点 \(s\)，实部是 \(\beta\)。函数方程要求 \(1-s\) 也是零点，它的实部便是 \(1-\beta\)。图中只画实部。`,
        String.raw`For the Riemann \(\zeta\) function, suppose there were a zero \(s\) in the critical strip with real part \(\beta\). The functional equation gives another zero at \(1-s\), with real part \(1-\beta\). Only the real parts are drawn here.`)}</MathProse></p>
    </div>
    <div className={styles.experiment}>
      <label htmlFor="grh-beta">{t('假想零点的实部', 'Real part of hypothetical zero')} <strong><TeX src={String.raw`\beta = ${beta}`} /></strong></label>
      <input className={styles.realPartSlider} id="grh-beta" type="range" min="5" max="95" step="5" value={hundredths}
        aria-valuetext={beta} onChange={event => setHundredths(Number(event.target.value))} />
      <div className={styles.axis} aria-hidden="true"><TeX src="0" /><TeX src={String.raw`\tfrac12`} /><TeX src="1" /></div>
      <div className={styles.pairPlot} aria-hidden="true">
        <div><i style={{ left: hundredths + '%' }} /></div>
        <div><i className={styles.partnerDot} style={{ left: (100 - hundredths) + '%' }} /></div>
      </div>
      <div className={styles.legend}>
        <span><i /><TeX src={String.raw`\operatorname{Re}(s) = ${beta}`} /></span>
        <span><i className={styles.partnerDot} /><TeX src={String.raw`\operatorname{Re}(1-s) = ${reflected}`} /></span>
      </div>
      <p aria-live="polite" className={styles.result}><MathProse>{conclusion}</MathProse></p>
    </div>
    <p className={styles.exerciseFoot}>{t('图中展示的是从右半边无零点推出黎曼猜想的这一步。完整证明还给出了右半边无零点的论证。', 'This diagram shows how a zero-free right half implies the Riemann hypothesis. The full proof also establishes that zero-free region.')} <a href="https://github.com/Deicyde/riemann-hypothesis/blob/40e56bab026552e089d7afcfeff08d2defb9c005/src/Formalism/GammaFactorNonvanishing/RhOfRight.lean">{t('查看该引理', 'Read the lemma')}</a></p>
  </section>;
}
