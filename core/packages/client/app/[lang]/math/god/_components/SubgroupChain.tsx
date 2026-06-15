'use client';

/**
 * Thistlethwaite 4 阶段 / Kociemba 2 阶段子群链可视化。
 *
 * 用嵌套环显示 G0 ⊃ G1 ⊃ ... ⊃ {e},每一层标注 |Gi| 和到下一层的"陪集数"|Gi/Gi+1|。
 * tab 切两个算法。点某一层显示生成元集 + 最大步数。
 */
import { useState } from 'react';
import { TeX, MathText } from './Tex';
import i18n from '@/i18n/i18n-client';
import { tr } from '@/i18n/tr';

type AlgoKey = 'thistlethwaite' | 'kociemba';

interface Layer {
  /** "G0" / "G1" ... 名称 */
  label: string;
  /** 子群生成元简记 */
  gens: string;
  /** |Gi| */
  order: string;
  /** |G(i-1)/Gi| 陪集数(本层是 Gi → Gi-1 的指数) */
  cosetsToParent?: string;
  /** 本层"求解到下一层"的最大移动步数(HTM)。 */
  maxMoves?: number;
  /** 中文 / 英文短描述 */
  zh: string; en: string;
}

const THISTLETHWAITE: Layer[] = [
  {
    label: 'G₀',
    gens: '⟨U, D, L, R, F, B⟩',
    order: '4.32 × 10¹⁹',
    zh: '全群:所有 90° / 180° 面转',
    en: 'Full group: all 90° / 180° face turns'
},
  {
    label: 'G₁',
    gens: '⟨U, D, L, R, F², B²⟩',
    order: '2.11 × 10¹⁵',
    cosetsToParent: '2,048 = 2¹¹',
    maxMoves: 7,
    zh: '阶段 1:消除棱块朝向(F/B 只允许 180°)',
    en: 'Phase 1: kill edge orientation (F/B restricted to 180°)'
},
  {
    label: 'G₂',
    gens: '⟨U, D, L², R², F², B²⟩',
    order: '1.95 × 10¹⁰',
    cosetsToParent: '1,082,565',
    maxMoves: 13,
    zh: '阶段 2:消除角块朝向 + 把 M-slice 棱块归位 (L/R 也限 180°)',
    en: 'Phase 2: kill corner orientation + M-slice edges to M-slice (L/R also 180°)'
},
  {
    label: 'G₃',
    gens: '⟨U², D², L², R², F², B²⟩',
    order: '6.63 × 10⁵',
    cosetsToParent: '29,400',
    maxMoves: 15,
    zh: '阶段 3:全部限为 180° 转;残余只是块块对换',
    en: 'Phase 3: only 180° turns; remaining state is just pair swaps'
},
  {
    label: '{e}',
    gens: '∅',
    order: '1',
    cosetsToParent: '663,552',
    maxMoves: 17,
    zh: '阶段 4:还原',
    en: 'Phase 4: identity'
},
];

const KOCIEMBA: Layer[] = [
  {
    label: 'G₀',
    gens: '⟨U, D, L, R, F, B⟩',
    order: '4.32 × 10¹⁹',
    zh: '全群',
    en: 'Full group',
  },
  {
    label: 'G₁ (Kociemba P1)',
    gens: '⟨U, D, L², R², F², B²⟩',
    order: '1.95 × 10¹⁰',
    cosetsToParent: '2,217,093,120',
    maxMoves: 12,
    zh: '阶段 1:消除角朝向 + 棱朝向 + 把 M-slice 棱归位',
    en: 'Phase 1: kill corner orientation + edge orientation + place M-slice edges'
},
  {
    label: '{e}',
    gens: '∅',
    order: '1',
    cosetsToParent: '19,508,428,800',
    maxMoves: 18,
    zh: '阶段 2:在限制群里求解',
    en: 'Phase 2: solve within the restricted group'
},
];

const ALGOS: Record<AlgoKey, { name: string; chain: Layer[]; max: number; status: string; year: number; by: string }> = {
  thistlethwaite: {
    name: 'Thistlethwaite (1981)',
    chain: THISTLETHWAITE,
    max: 52,
    status: '上界 52(实践常 45-50)',
    year: 1981,
    by: 'Morwen Thistlethwaite',
  },
  kociemba: {
    name: 'Kociemba (1992)',
    chain: KOCIEMBA,
    max: 30,
    status: '上界 30(实践常 20-22)',
    year: 1992,
    by: 'Herbert Kociemba',
  },
};

interface Props { isZh: boolean; }

export default function SubgroupChain({ isZh }: Props) {
  const t = (zh: string, en: string) => (isZh ? zh : en);
  const [algo, setAlgo] = useState<AlgoKey>('kociemba');
  const [active, setActive] = useState<number | null>(null);

  const A = ALGOS[algo];
  const chain = A.chain;

  return (
    <div className="god-chain-wrap">
      <div className="god-chain-tabs">
        {(['kociemba', 'thistlethwaite'] as AlgoKey[]).map((k) => (
          <button key={k}
                  className={`god-metric-tab ${algo === k ? 'is-on' : ''}`}
                  onClick={() => { setAlgo(k); setActive(null); }}>
            {ALGOS[k].name}
          </button>
        ))}
      </div>

      <div className="god-chain-meta">
        <span>{t('总步数上界', 'Total upper bound')}: <b>{A.max}</b> HTM</span>
        <span>{t('阶段数', 'Phases')}: <b>{chain.length - 1}</b></span>
        <span>{t('实践范围', 'Typical')}: <b>{A.status}</b></span>
      </div>

      <div className="god-chain-flow">
        {chain.map((l, i) => {
          const parentIdx = i - 1;
          const selfIdx = i === chain.length - 1 ? i - 1 : i;
          return (
            <div key={l.label} className={`god-chain-layer ${active === i ? 'is-active' : ''}`}
                 onClick={() => setActive(active === i ? null : i)}>
              <div className="god-chain-layer-head">
                <span className="god-chain-layer-label">{l.label}</span>
                <span className="god-chain-layer-order"><MathText>{`|${l.label}| = ${l.order}`}</MathText></span>
              </div>
              <div className="god-chain-layer-gens"><MathText>{l.gens}</MathText></div>
              <div className="god-chain-layer-desc"><MathText>{tr(l)}</MathText></div>
              {l.cosetsToParent && (
                <div className="god-chain-layer-cosets">
                  {t('陪集数', 'Coset count')} <TeX src={`\\bigl|G_{${parentIdx}}/G_{${selfIdx}}\\bigr| = ${l.cosetsToParent.replace(/,/g, '{,}')}`} />
                  {l.maxMoves != null && (
                    <span className="god-chain-layer-mv">
                      · {t('阶段最大', 'phase max')}: <b>{l.maxMoves}</b> HTM
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="god-chain-caption">
        {algo === 'kociemba' ? (
          <MathText>{t(
            'Kociemba 两阶段:用 G₁ = ⟨U,D,L²,R²,F²,B²⟩ 把 4.3×10¹⁹ 状态切成 2.2 × 10⁹ 个陪集。阶段 1 把"在哪个陪集"解决(最多 12 步),阶段 2 在那个陪集里求解(最多 18 步)。Rokicki 2008 把上界压到 22;2010 引入对称 + 集合覆盖压到 20 —— 上界与下界(superflip 已知 20)相遇,直径 = 20 证毕。',
            'Kociemba two-phase: G₁ = ⟨U,D,L²,R²,F²,B²⟩ partitions the 4.3×10¹⁹ states into 2.2 × 10⁹ cosets. Phase 1 finds the coset (≤ 12 moves); Phase 2 solves inside it (≤ 18 moves). Rokicki 2008 tightened to 22; 2010 added symmetry + set cover to reach 20 — meeting the lower bound (superflip needs 20), proving diameter = 20.'
          )}</MathText>
        ) : (
          <MathText>{t(
            'Thistlethwaite 四阶段:每个阶段把一个对称性"冻结"(先棱朝向、再角朝向 + M-slice、再 180°-only、最后还原)。每个阶段的子问题足够小可以预计算查表。给出 ≤ 52 HTM 上界,1981 年第一个 < 100 步的可计算解法。',
            'Thistlethwaite four-phase: each phase freezes one symmetry (first edge orientation, then corner orientation + M-slice, then 180°-only, then identity). Each sub-problem is small enough to tabulate. Gives ≤ 52 HTM, the first sub-100 algorithmic bound (1981).'
          )}</MathText>
        )}
      </p>
    </div>
  );
}
