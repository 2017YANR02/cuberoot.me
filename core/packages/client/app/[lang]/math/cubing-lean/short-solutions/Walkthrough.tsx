'use client';

import { useState } from 'react';
import { ArrowRight, ArrowUpRight } from '@app-foundation/icons/lucide';
import CubeModel from './CubeModel';
import AppLink from '@/components/AppLink';
import { useT } from '@/hooks/useT';
import { CUBE_FILL } from '@/lib/cube-colors';
import { faces, notation, reduce } from './reduction';
import s from './demo.module.css';

const size = 16;
const layer = 10;
const move = { face: 'D' as const, layer, suffix: "'" };
const example = reduce(size, 1, [move]);
const small = example.small!;
const restored = reduce(size, 1, [move, { ...move, suffix: '' }]);
const newSize = small.kept.length;
const newLayer = small.kept.indexOf(layer - 1) + 1;
const front = 2;
const removed = Array.from({ length: size }, (_, i) => i + 1).filter(i => !small.kept.includes(i - 1));

function FrontFace({ step }: { step: number }) {
  const t = useT();
  const packed = step >= 2;
  const n = packed ? newSize : size;
  const row = packed ? newLayer : layer;
  const cell = 224 / n;
  const markY = (n - row + .5) * cell;
  // Keep each original sticker mounted as the gaps close, so the stripe can be followed by eye.
  const rank = (i: number) => small.kept.filter(v => v < i).length;
  return <figure className={s.front}>
    <figcaption>{t(`${n} 阶魔方正面`, `${n} × ${n} cube · front face`)}</figcaption>
    <svg width="100%" style={{maxWidth: 340}} viewBox="-48 -5 279 240" role="img"
      aria-label={t(`从底面数第 ${row} 层，${step === 3 ? '正面全绿' : '这一排变成了红色'}`, `Layer ${row} from the bottom. ${step === 3 ? 'The front is all green.' : 'This row is red.'}`)}>
      {example.original[front].map((colour, i) => {
        const x = i % size, y = Math.floor(i / size);
        const dropped = removed.includes(x + 1) || removed.includes(y + 1);
        const col = packed ? rank(x) : x, line = packed ? rank(y) : y;
        return <rect key={i} width={.91} height={.91} rx={.09}
          fill={CUBE_FILL[faces[step === 3 ? restored.original[front][i] : colour]]}
          className={s.sticker}
          style={{opacity: dropped && step >= 1 ? (packed ? 0 : .13) : 1,
            transform: `translate(${(col+.045)*cell}px, ${(line+.045)*cell}px) scale(${cell})`}} />;
      })}
      <g className={s.rowPointer} transform={`translate(0 ${markY})`}>
        <text x="-15" y="0" textAnchor="end" dominantBaseline="central">{row}</text>
        <path d="M -12 0 h 9 m -4 -3 l 4 3 -4 3" fill="none" stroke="currentColor" strokeWidth="1.5"/>
      </g>
    </svg>
    <small>{t('层号从底面往上数 ↑', 'Count layers up from the bottom ↑')}</small>
  </figure>;
}

export default function Walkthrough({ onExplore }: { onExplore: () => void }) {
  const t = useT();
  const [step, setStep] = useState(0);
  const stages = [
    { tab: t('看打乱', 'Scramble'), title: t('只转过第 10 层', 'Only layer ten has moved'),
      body: t('把绿面朝前。从底面数第 10 层转了 90°，原本在右面的红色贴纸就到了正面。现在要判断的就是它能不能一步复原。', 'Face the green side toward you. A quarter turn of layer ten brought a red stripe around from the right. Can this position be solved in one move?'),
      action: t('标出可以删的层', 'Mark the removable layers') },
    { tab: t('标出层', 'Mark layers'), title: t('六对可以互换，留三对、删三对', 'Six interchangeable pairs: keep three, drop three'),
      body: t('第 7、10 层是一对，第 10 层有红线，这一对保留。其余六对内层中，任选两对，在三个方向同时交换它们，六面贴纸的颜色都不变。程序从外往里留下前三对，删掉 (5,12)、(6,11)、(8,9)。图中淡掉的是这些层对应的行和列。',
        'Layers 7 and 10 form a mirror pair. Layer 10 carries the stripe, so that pair stays. Any two of the other six inner pairs can trade places on all three axes without changing a single sticker colour. The program keeps the outermost three of those six and drops (5,12), (6,11) and (8,9). Their rows and columns are faded.'),
      action: t('删层，看红线的位置', 'Remove layers and follow the stripe') },
    { tab: t('缩到 10 阶', 'Reduce to 10'), title: t('第 10 层变成了第 6 层', 'Layer ten becomes layer six'),
      body: t('六个面都删去相同编号的行和列，剩下的贴纸按原顺序靠拢。红线下面只剩 5 排，所以在小魔方上，从底面数到第 6 层就能找到它。', 'Remove the same rows and columns on every face, then close the gaps. Five rows remain beneath the stripe, so the turn is now on layer six from the bottom.'),
      action: t('把两个魔方各转回一步', 'Turn each cube back one move') },
    { tab: t('验证复原', 'Verify'), title: t('两个魔方都能一步复原', 'Both cubes solve in one move'),
      body: t('小魔方转回第 6 层，大魔方转回第 10 层。六个面都复原了。在这个例子里，只看 10 阶魔方就能回答原来 16 阶魔方的问题。', 'Turn layer six back on the small cube and layer ten back on the original. All six faces are solved. The 10 × 10 cube answers the one-move question for the 16 × 16 cube.'),
      action: t('试一个三步打乱', 'Try a three-move scramble') },
  ];
  return <section aria-label={t('分步演示', 'Guided example')} className={s.lesson} data-site-surface="panel">
    <div className={s.steps}>{stages.map((stage, i) => <button key={i} aria-pressed={step === i} onClick={() => setStep(i)}>{stage.tab}</button>)}</div>
    <div className={s.diagrams}>
      <figure className={s.model}><figcaption>{t('原来的 16 阶魔方', 'Original 16 × 16 cube')}</figcaption>
        <div className={s.modelCanvas}><CubeModel n={size} alg={step === 3 ? "10D' 10D" : "10D'"}/></div>
        <small>{t('拖动可旋转视角', 'Drag to rotate the view')}</small>
      </figure>
      <FrontFace step={step}/>
    </div>
    <div className={s.lessonText}>
      <div aria-live="polite" aria-atomic="true"><h2>{stages[step].title}</h2><p>{stages[step].body}</p>
        {step === 1 && <details><summary>{t('为什么要留三对？可以换三对留吗？', 'Why keep three? Which three can stay?')}</summary>
          <p>{t('这组六对中，留哪三对都可以。数量按复原步数上限 k 来定，通用算法留 k + 2 对。本例 k = 1，一步最多用到一对，留下三对就至少有两对没用过。', 'Any three of the six can stay. The general rule keeps k + 2 pairs for a limit of k moves. Here k = 1. One move can touch at most one pair, leaving at least two of the three untouched.')}</p>
          <p>{t('为什么是两对？每张贴纸有行、列两个坐标，可能对应两个不同的深度。证明用这两对分别代替被删掉的深度，核对小魔方的解法搬回大魔方后，每张贴纸都能复原。这个数量足以保证结论，论文没有证明它最少。', 'A sticker has a row and a column, which may lie at different depths. The proof uses the two untouched pairs to stand in for missing depths when checking that the lifted solution restores every sticker. This is a sufficient count; the paper does not claim it is minimal.')}</p>
        </details>}
      </div>
      <button className={s.next} onClick={() => step === 3 ? onExplore() : setStep(step+1)}>{stages[step].action}<ArrowRight size={16}/></button>
    </div>
    {step === 3 && <div className={s.simLinks}>{[[size, notation([move]), layer], [newSize, notation(small.projected), newLayer]].map(([n, alg, l]) =>
      <AppLink key={n} href={'/sim?' + new URLSearchParams({puzzle: String(n), setup: String(alg), alg: l+'D'})}>
        {t(`在模拟器重播 ${n} 阶`, `Replay the ${n} × ${n} solve in /sim`)}<ArrowUpRight size={14}/></AppLink>)}</div>}
  </section>;
}
