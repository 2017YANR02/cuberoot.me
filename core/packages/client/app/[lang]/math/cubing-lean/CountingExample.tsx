'use client';

import { useState } from 'react';
import { ChartNoAxesColumnIncreasing, ChevronDown } from '@app-foundation/icons/lucide';
import { useT } from '@/hooks/useT';
import s from './research.module.css';

const factorial = (n: number) => {
  let product = 1n;
  for (let i = 2; i <= n; i++) product *= BigInt(i);
  return product;
};
const layouts = factorial(24) / factorial(4) ** 6n;

export default function CountingExample() {
  const t = useT();
  const [n, setN] = useState(8);
  const [k, setK] = useState(45);
  const depths = Math.floor((n - 2) / 2);
  const orbits = depths * (depths - 1);
  const reachable = layouts ** BigInt(orbits);
  const words = BigInt(9 * n + 1) ** BigInt(k);
  const stateBits = Math.log2(Number(layouts)) * orbits;
  const wordBits = Math.log2(9 * n + 1) * k;
  const maximum = Math.max(1, stateBits, wordBits);
  const bars = [
    { label: t('已知可达状态数的下界', 'Lower bound on reachable states'), bits: stateBits },
    { label: t('预算内走法数的上界', 'Upper bound on move sequences'), bits: wordBits },
  ];
  return <details className={s.experiment}>
    <summary><ChartNoAxesColumnIncreasing size={19} /><span>{t('计数实验', 'Counting experiment')}</span>
      <span className={s.summaryHint}>{t('调节阶数与步数', 'Vary size and move budget')}</span><ChevronDown size={16} className={s.chevron} /></summary>
    <div className={s.experimentBody}>
      <p>{t('如果可达状态比步数限制内的转法还多，就一定有状态需要更多步才能复原。', 'If reachable states outnumber the available move sequences, at least one state needs more moves.')}</p>
      <div className={s.sliders}>
        <label htmlFor="counting-cube-size"><span>{t('魔方阶数', 'Cube size')} <output>n = {n}</output></span><input className={s.countingSlider} id="counting-cube-size" type="range" min={4} max={16} value={n} onChange={e => setN(Number(e.target.value))} /></label>
        <label htmlFor="counting-move-budget"><span>{t('步数预算', 'Move budget')} <output>k = {k}</output></span><input className={s.countingSlider} id="counting-move-budget" type="range" min={0} max={320} value={k} onChange={e => setK(Number(e.target.value))} /></label>
      </div>
      <figure className={s.bars}>
        {bars.map(({ label, bits }) => <div key={label}>
          <div className={s.barLabel}><span>{label}</span><span>{bits.toFixed(1)} bit</span></div>
          <svg aria-hidden="true" viewBox="0 0 100 2" preserveAspectRatio="none"><rect width={100} height={2} className={s.track} /><rect width={100*bits/maximum} height={2} /></svg>
        </div>)}
        <figcaption>{t('条长表示数量的二进制对数，结论按整数精确比较。', 'Lengths show base-2 logarithms. The verdict uses exact integer counts.')}</figcaption>
      </figure>
      <p>{t(`此时有 ${orbits} 组独立中心，每组有 24!/(4!)⁶ 种配色。每步有 ${9*n} 种转法，加一次空操作可将所有走法补齐到 k 步。`, `There are ${orbits} independent orbits, each with 24!/(4!)⁶ colourings. Each slot allows ${9*n} moves or one idle action to pad a shorter sequence.`)}</p>
      <p className={s.verdict} aria-live="polite">{reachable > words
        ? t(`至少有一个 ${n} 阶魔方状态需要 ${k+1} 步或更多。`, `Some ${n}×${n}×${n} position needs at least ${k+1} moves.`)
        : t(`这两个计数尚不足以证明有状态需要超过 ${k} 步。`, `These counts do not establish that any position needs more than ${k} moves.`)}</p>
    </div>
  </details>;
}
