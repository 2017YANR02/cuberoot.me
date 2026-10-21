'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import BoolToggle from '@/components/BoolToggle';
import { SCRAMBLE_KINDS } from '@/lib/trainer-scramble';
import { ArrowDown, Layers, RotateCw } from '@app-foundation/icons/lucide';
import AppLink from '@/components/AppLink';
import CorpusStatistics from './CorpusStatistics';
import StatisticsOverview from './StatisticsOverview';
import { useStatisticsData, type Mode } from './useStatisticsData';
import HeaderToggles from '@/components/HeaderToggles';
import { useT } from '@/hooks/useT';
import './double-zbll-about.css';

const SingleStatistics = dynamic(() => import('./SingleStatistics'));

// Verified against the 18 face-turn generators and all 7,772 single-layer states.
const rotations = ['', 'y', 'y2', "y'", 'x2', 'y x2', 'y2 x2', "y' x2"];
const examples = ['U R2 F\'', 'U B2 R\'', 'U L2 B\'', 'U F2 L\'', 'D R2 B\'', 'D B2 L\'', 'D L2 F\'', 'D F2 R\''];
const number = (value: number) => value.toLocaleString('en-US');

export default function DoubleZbllAbout() {
  const t = useT();
  const [mode, setMode] = useState<Mode>('double-zbll');
  const [pll, setPll] = useState(false);
  const data = useStatisticsData(pll);
  const selectMode = (mode: Mode) => {
    setMode(mode);
    document.getElementById('dz-mode-details')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
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
      <div className="dz-about-topline"><span className="dz-about-eyebrow"><Layers size={18} /> ZBLL</span><HeaderToggles /></div>
      <h1>{t('ZBLL 打乱方式与统计', 'ZBLL scramble modes and statistics')}</h1>
      <p>{t('从双底 HTM 到逆 case、四种最优度量、COEP 和 csTimer：了解每种打乱如何产生，比较分布与极端情况。', 'Explore double ZBLL HTM, inverse case, four optimal metrics, COEP and csTimer: how each scramble is made, its distribution and its extremes.')}</p>
      <AppLink href="/alg/3x3/zbll/run" prefetch={false} className="dz-about-start">{t('开始 ZBLL 训练', 'Open ZBLL training')} →</AppLink>
    </header>

    <div className="dz-about-section-head dz-scope-control"><p>{t('统计范围：完整 ZBLL 题库', 'Scope: complete ZBLL corpus')}</p><BoolToggle label={t('统计包含 PLL', 'Include PLL in statistics')} value={pll} onChange={setPll} /></div>
    <StatisticsOverview pll={pll} data={data} selected={mode} onSelect={selectMode} />
    <section className="dz-about-guide" id="dz-mode-details">
      <h2>{t('模式明细与计步说明', 'Mode details and counting rules')}</h2>
      <p>{t('HTM：外层半转算一步，夹层转动折算为两个外层转动。STM：外层、宽转、夹层各算一步。QTM / SQTM 分别在 HTM / STM 基础上将半转算两步。整颗转体不计步；例如 M2 为 2 HTM、1 STM、4 QTM、2 SQTM。最短不等于最好拧，步数也不能直接预测还原时间。', 'HTM counts a face half turn as one and a slice turn as two face turns. STM counts face, wide and slice turns as one each. QTM / SQTM count half turns twice under HTM / STM respectively. Cube rotations cost zero: M2 is 2 HTM, 1 STM, 4 QTM and 2 SQTM. Shortest does not mean easiest to execute, and move count does not predict solve time.')}</p>
      <div className="dz-about-section-head">
        <label>{t('打乱方式', 'Scramble mode')} <select aria-label={t('打乱方式', 'Scramble mode')} className="dz-about-symmetry-select" value={mode} onChange={e => setMode(e.target.value as typeof mode)}>
          <option value="double-zbll">{t('双底 HTM', 'Double ZBLL HTM')}</option>
          {SCRAMBLE_KINDS.filter(k => k.id !== 'rand').map(k => <option key={k.id} value={k.id}>{k.label()}</option>)}
        </select></label>
      </div>
    </section>
    {mode !== 'double-zbll' ? <SingleStatistics kind={mode} data={data} /> : <>
    <p>{t('双底把两个 case 放在同一颗魔方的顶层和底层，一条打乱练两例。以下统计为每个有序配对选出的打乱；单层模式每题只有一个 case。', 'Double ZBLL places one case on each of two opposite layers, training two cases with one scramble. These statistics count selected scrambles per ordered pair; single-layer modes train one case per scramble.')}</p>
    <CorpusStatistics pll={pll} />

    <section className="dz-about-prose" aria-labelledby="dz-counts">
      <div className="dz-about-section-head">
        <h2 id="dz-counts">{t('从组合到代表状态', 'From combinations to representatives')}</h2>
      </div>
      <p className="dz-about-muted">{t('跟随上方「统计包含 PLL」开关。', 'Follows the “Include PLL in statistics” switch above.')}</p>
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

    <section className="dz-about-prose">
      <h2>{t('先选短，再选更好打的方向', 'Choose a short scramble, then a convenient orientation')}</h2>
      <p>{t('每对 case 在全部已保存的状态解法中，依次选择 HTM 最少、QTM 最少、不同转动面数量最少的一条。HTM 将半转算一步，QTM 将半转算两步；转动面数量只看用了几个面，例如 RU 是两个、RUF 是三个，不偏好具体字母。', 'For each case pair, saved state solutions are ranked by HTM, then QTM, then the number of distinct faces used. A half turn counts as one HTM move and two QTM moves. RU uses two faces and RUF uses three; this tie-breaker does not prefer particular face letters.')}</p>
      <p className="dz-about-muted">{t('每个状态保留了一个 HTM 最优解，并没有枚举该状态的全部 HTM 最优解。因此 QTM 和转动面数量是在已保存的候选中选优，不宣称全局 QTM 最优。所有原始结果保留。', 'One HTM-optimal solution was retained per state; not every HTM-optimal solution of that state was enumerated. QTM and distinct-face tie-breaking therefore choose among the saved candidates, without claiming global QTM optimality. All original results are retained.')}</p>
      <p>{t('出题时再比较 y 轴转体、z2 翻转及它们的组合，共八种方向，复用 Timer 求解器的朝向评分：先让 R＋L 最多，同分时让 F−B 最大，再让 R−L 最大。U、D 不参与评分，半转计一次，完全同分保留先出现的方向。只改变面转记号，HTM、QTM 和不同转动面数量都不变，最终公式不需要额外做转体。', 'When a case is drawn, eight orientations are compared using y rotations, a z2 flip and their combinations. The same ranking as the Timer solver maximizes R+L, then F−B, then R−L. U and D are neutral, half turns count once, and exact ties keep the first orientation. Relabeling preserves HTM, QTM and the number of distinct faces; the final scramble requires no extra cube rotations.')}</p>
      <div className="dz-about-equation" data-site-surface="panel">
        <code>F U F′</code>
        <ArrowDown size={18} aria-hidden />
        <code>R U R′</code>
        <span>{t('转动记号示例：步数不变，把 F 换成 R', 'Face relabeling example: replace F with R without changing the move count')}</span>
      </div>
      <p>{t('z2 会交换顶底，训练图示和 case 标记会同步交换，智能魔方也按变换后的打乱识别目标状态。这不会额外减少需要求解的状态数量：z2 和前面的 x2 只是同一组八种对称的不同写法。', 'A z2 flip exchanges the top and bottom, so case labels and diagrams swap accordingly. Smart-cube training uses the transformed scramble as its target. This does not further reduce the number of states to solve: z2 and the x2 notation above describe the same eight-element symmetry group.')}</p>
    </section>

    <section className="dz-about-prose dz-about-evidence">
      <h2>{t('验证与离线使用', 'Verification and offline use')}</h2>
      <p>{t('完整枚举 60,403,984 个不同配对，得到 7,555,446 个等价组，与上述公式一致；另核对了 62,176 次单层旋转和 144 次 HTM 面转映射。求解完成后，导出的 243,049 条打乱逐条验证了完整魔方状态与记录编码，并用哈希校验题库完整性。', 'Enumeration of all 60,403,984 distinct pairs produced 7,555,446 symmetry classes, matching the formula. The audit also checked 62,176 single-layer rotations and 144 HTM generator mappings. After solving, all 243,049 exported scrambles were checked against their full cube states and encoded records; hashes protect corpus integrity.')}</p>
      <p>{t('出题方向优化另外验证了八种方向下全部 18 种面转的状态等价性，以及顶底交换和智能魔方目标同步。浏览器只读取题库并转换记号，不重新运行最短解求解器。', 'The orientation optimization separately verifies state equivalence for all 18 face turns in each of the eight frames, along with layer swapping and smart-cube target consistency. The browser reads the corpus and relabels moves; it does not rerun the optimal solver.')}</p>
      <p>{t('联网进入双底模式后，会在后台自动缓存题库和训练页面，无需点击下载。缓存完成后可离线使用；题库或离线页面版本更新后会自动补齐，断网失败时在恢复联网或下次进入时重试。浏览器需支持离线存储，并保留该网站的数据。', 'Entering double ZBLL mode online automatically caches the corpus and training pages in the background. Offline use is available after caching completes. Corpus or offline-page updates are cached automatically, with failures retried on reconnection or the next visit. The browser must support offline storage and retain this site’s data.')}</p>
    </section>
    </>}
  </main>;
}
