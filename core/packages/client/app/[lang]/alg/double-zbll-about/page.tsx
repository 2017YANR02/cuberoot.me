'use client';

import { useState } from 'react';
import { ArrowDown, Layers, RotateCw } from 'lucide-react';
import AppLink from '@/components/AppLink';
import BoolToggle from '@/components/BoolToggle';
import HeaderToggles from '@/components/HeaderToggles';
import { useT } from '@/hooks/useT';
import './double-zbll-about.css';

// Verified against the 18 face-turn generators and all 7,772 single-layer states.
const rotations = ['', 'y', 'y2', "y'", 'x2', 'y x2', 'y2 x2', "y' x2"];
const examples = ['U R2 F\'', 'U B2 R\'', 'U L2 B\'', 'U F2 L\'', 'D R2 B\'', 'D B2 L\'', 'D L2 F\'', 'D F2 R\''];
const number = (value: number) => value.toLocaleString('en-US');

export default function DoubleZbllAbout() {
  const t = useT();
  const [pll, setPll] = useState(true);
  const [rotation, setRotation] = useState(0);
  const cases = pll ? 493 : 472;
  const states = pll ? 7772 : 7488;
  const quarterFixed = pll ? 4 : 0;
  const halfFixed = pll ? 92 : 64;
  const raw = cases ** 2 * 256;
  const unique = states ** 2;
  const orbits = (unique + 2 * quarterFixed ** 2 + halfFixed ** 2 + 4 * states) / 8;
  return <main className="dz-about">
    <header className="dz-about-hero">
      <div className="dz-about-topline"><span className="dz-about-eyebrow"><Layers size={18} /> ZBLL × 2</span><HeaderToggles /></div>
      <h1>{t('换个方向，同样最短', 'A different orientation. The same shortest solution.')}</h1>
      <p>{t('把顶层和底层的两个 case 放在同一颗魔方上。利用对称，只计算每组等价状态中的一个，再把解法转换回来。', 'Combine two cases on opposite layers. Solve one representative from each symmetry class, then transform its solution back to the requested state.')}</p>
      <AppLink href="/alg/3x3/zbll/run" prefetch={false} className="dz-about-start">{t('开始双底训练', 'Open double ZBLL training')} →</AppLink>
    </header>

    <section aria-labelledby="dz-counts">
      <div className="dz-about-section-head">
        <h2 id="dz-counts">{t('从组合到代表状态', 'From combinations to representatives')}</h2>
        <BoolToggle label={t('计数包含 PLL', 'Include PLL in this calculation')} value={pll} onChange={setPll} />
      </div>
      <p className="dz-about-muted">{t('这里的开关用于比较理论数量，不会修改你的训练设置。', 'This switch compares the counts; it does not change your training settings.')}</p>
      <div className="dz-about-counts">
        <article data-site-surface="panel"><span>01 · {t('原始组合', 'Raw combinations')}</span><strong>{number(raw)}</strong><code>{cases}² × 16²</code></article>
        <article data-site-surface="panel"><span>02 · {t('不同状态', 'Distinct states')}</span><strong>{number(unique)}</strong><code>{number(states)}²</code></article>
        <article data-site-surface="panel" className="dz-about-result"><span>03 · {t('需要求解', 'Representatives to solve')}</span><strong>{number(orbits)}</strong><code>{t('比原始组合减少', 'Fewer than the raw count:')} {(100 * (1 - orbits / raw)).toFixed(2)}%</code></article>
      </div>
    </section>

    <section className="dz-about-prose">
      <h2>{t('第一步：相同的状态只留一次', 'Step 1: keep each distinct state once')}</h2>
      <p>{t('每个单层 case 的前、后各有 4 种 U 层调整：不转、U、U2、U′，因此先列出 4 × 4 = 16 种。顶底独立组合，就有 16 × 16 = 256 种。这里不是只给顶、底各加一次 AUF 的 16 种。', 'Each layer has four U-layer adjustments before its setup and four after: no turn, U, U2 and U′. That gives 16 variants per layer and 256 per pair. This includes both pre- and post-adjustments, not just one AUF on each layer.')}</p>
      <p>{t('但对称 case 会重复。472 个 ZBLL 中，464 个各有 16 个不同状态，8 个 H 组 case 各有 8 个，共 7,488 个。21 个 PLL 额外提供 284 个，因此包含 PLL 时共 7,772 个单层状态。', 'Symmetric cases produce duplicates. Among the 472 ZBLL cases, 464 have 16 distinct variants and eight H cases have eight, giving 7,488 states. The 21 PLL cases add 284 states, for 7,772 single-layer states including PLL.')}</p>
      <div className="dz-about-equation" data-site-surface="panel"><code>464 × 16 + 8 × 8 = 7,488</code><code>16 × 16 + 2 × 8 + 3 × 4 = 284</code><code>7,488 + 284 = 7,772</code></div>
      <p className="dz-about-muted">{t('PLL 中 E、Z 各有 8 个变体，H、Na、Nb 各有 4 个，其余各有 16 个。不包含已还原的单层状态。', 'PLL E and Z each have eight variants; H, Na and Nb each have four; the remaining cases each have 16. The solved single-layer state is excluded.')}</p>
    </section>

    <section className="dz-about-prose">
      <h2>{t('第二步：八种朝向，共用一个最短解', 'Step 2: eight orientations share a shortest solution')}</h2>
      <p>{t('保持顶底轴不变，有四种绕轴方向；再加上顶底互换后的四种方向，共八种。对状态和解法做同一套转动记号转换，就能复用计算结果。', 'There are four orientations around the top–bottom axis, plus four with the top and bottom exchanged. Applying the same face-turn relabeling to the state and its solution lets them share the computed result.')}</p>
      <div className="dz-about-demo" data-site-surface="panel">
        <label>{t('选择对称变换', 'Choose a symmetry')}
          <select className="dz-about-symmetry-select" value={rotation} onChange={e => setRotation(Number(e.target.value))}>
            {rotations.map((r, i) => <option key={i} value={i}>{r || t('原方向', 'Original orientation')}</option>)}
          </select>
        </label>
        <div className="dz-about-turns"><code>U R2 F′</code><RotateCw size={22} aria-hidden /><code>{examples[rotation].replaceAll("'", '′')}</code></div>
        <p>{t('这是三步记号转换示例，不是一条完整的双底解法。变换后仍是三步；翻转时 U 和 D 也会互换。', 'This is a three-move relabeling example, not a complete double ZBLL solution. It remains three moves long; a flip also exchanges U and D.')}</p>
      </div>
      <h3>{t('为什么最优性不变？', 'Why does optimality survive?')}</h3>
      <p>{t('HTM 中，U、U′、U2 等 18 种面转都各算一步。这些对称变换把每种面转一一对应到另一种面转，不增减步数。如果转换后还有更短解，把它反向转换就能得到原状态的更短解，与原解最优矛盾。因此两者最短步数相等。', 'HTM counts each of the 18 face turns, including half turns, as one move. Each symmetry maps those turns bijectively onto themselves, preserving length. A shorter solution to the transformed state would transform back to a shorter solution to the original, contradicting its optimality.')}</p>
      <p className="dz-about-muted">{t('这里使用的是状态的旋转共轭和面转重命名，不是在打乱两端额外加几个免费转动。任意 AUF 也不能免费省略，仍须求解它对应的准确状态。', 'This uses rotational conjugation and face relabeling, not extra free turns at the ends of a scramble. An arbitrary AUF cannot be discarded for free: its exact resulting state still has to be solved.')}</p>
    </section>

    <section className="dz-about-prose">
      <h2>{t('为什么不能直接除以八？', 'Why not simply divide by eight?')}</h2>
      <p>{t('少数状态旋转后仍然是自己，等价组不足八个成员。Burnside 引理会把这部分修正回来：统计每一种变换固定住多少状态，再取平均。', 'Some states remain unchanged under a rotation, so their symmetry class has fewer than eight members. Burnside’s lemma accounts for these exceptions: count the states fixed by each symmetry, then take the average.')}</p>
      <div className="dz-about-equation" data-site-surface="panel">
        <code>({number(states)}² + {quarterFixed}² + {halfFixed}² + {quarterFixed}² + 4 × {number(states)}) ÷ 8</code>
        <ArrowDown size={18} aria-hidden /><strong>{number(orbits)}</strong>
      </div>
      <p>{t('四种不互换顶底的变换，固定状态数分别来自单层固定数的平方；四种互换顶底的变换，各固定一个单层状态数那么多的配对。', 'For the four symmetries that do not exchange layers, the fixed pair counts are the squares of the single-layer fixed counts. Each of the four layer-exchanging symmetries fixes as many pairs as there are single-layer states.')}</p>
      <p>{t('我们只使用保持顶底轴的这八种对称。整颗魔方虽有 24 种空间朝向，另外 16 种会改变这条轴，本方案没有把它们计入节省量。', 'This method uses only the eight symmetries preserving the top–bottom axis. A cube has 24 spatial orientations, but the other 16 change that axis and are not included in the savings claimed here.')}</p>
    </section>

    <section className="dz-about-prose dz-about-evidence">
      <h2>{t('已验证什么，接下来算什么', 'What is verified, and what remains to compute')}</h2>
      <p>{t('已完整枚举 60,403,984 个不同配对，得到 7,555,446 个等价组，并与上述公式一致；另核对了 62,176 次单层旋转和 144 次 HTM 面转映射。这个数量是求解任务规模，不代表这些最短解已经全部算完。', 'Enumerating all 60,403,984 distinct pairs produced 7,555,446 symmetry classes, matching the formula. The audit also checked 62,176 single-layer rotations and 144 HTM generator mappings. This is the size of the solving task, not a claim that all shortest solutions have already been computed.')}</p>
      <p>{t('已有解法会先转换、验证后复用。后续只求解缺失的代表状态，再把得到的更短打乱更新到训练题库。每对 case 仍可覆盖多种状态；网站只需保存经验证的训练打乱，不必让浏览器重跑求解器。', 'Existing solutions will be transformed, verified and reused first. Only missing representatives need solving, and shorter verified scrambles can then update the training corpus. Each case pair can still represent multiple states; the website can serve verified scrambles without rerunning the solver in your browser.')}</p>
    </section>
  </main>;
}
