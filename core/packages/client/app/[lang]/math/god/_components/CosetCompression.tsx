'use client';

/**
 * 2010 Rokicki/Kociemba 证明的"压缩链"可视化:
 *
 *   4.32 × 10¹⁹ (|G|)
 *     ÷ |H| = 1.95 × 10¹⁰   →  2.22 × 10⁹  陪集    (Lagrange 定理)
 *     ÷ |S₄₈| ≈ 39.66        →  5.59 × 10⁷  对称类  (立方体对称 + 反对称)
 *     ÷ 集合覆盖 ≈ 7 × 10⁵   →  ~80         超陪集  (greedy set cover)
 *     × 每个超陪集 IDA* 求解  →  全部 ≤ 20 HTM       (verify)
 *
 * 用户拖滑块或点 stage 切换,看每阶段的 representative 数。
 * SVG 网格里 dot 数按 log10 缩放 + 颜色编码归属。
 */
import { useState } from 'react';
import { TeX, MathText } from './Tex';
import i18n from '@/i18n/i18n-client';
import { tr } from '@/i18n/tr';

type StageId = 0 | 1 | 2 | 3 | 4;

interface Stage {
  id: StageId;
  /** stage name */
  zh: string; en: string;
  /** count after this stage (in plain text + tex source) */
  countTex: string;
  countSci: string;
  /** ratio applied this stage (from previous) */
  ratioTex: string;
  /** what mathematical structure does the reduction */
  methodZh: string; methodEn: string;
  /** longer body (KaTeX-friendly) */
  bodyZh: string; bodyEn: string;
  /** for the grid viz: how many "groups" of how many representatives. We
   * cap visible cells at 256, mapping log10(count) → cell count. */
  visualGroups: number;
  visualPerGroup: number;
  /** color for the dots at this stage */
  color: string;
}

const STAGES: Stage[] = [
  {
    id: 0,
    zh: '全状态空间 G',
    en: 'Full state space G',
    countTex: '|G| = 4.32 \\times 10^{19}',
    countSci: '4.32 × 10¹⁹',
    ratioTex: '',
    methodZh: '原始 Rubik 群',
    methodEn: 'Raw Rubik group',
    bodyZh:
      '所有合法的三阶状态。由 Lagrange 定理可拆为子群 H 的陪集,这是后续所有压缩的起点。要"暴力" BFS 整张图,1 字节存一格距离也需 43 EB——物理上不可能。',
    bodyEn:
      'All legal 3×3 states. Lagrange\'s theorem lets us partition by a subgroup H — that\'s the starting point for everything below. A brute-force BFS storing 1 byte/state needs 43 EB; physically impossible.',
    visualGroups: 16,
    visualPerGroup: 16,
    color: 'var(--god-text-sub)'
},
  {
    id: 1,
    zh: '陪集分解 (Lagrange)',
    en: 'Coset decomposition (Lagrange)',
    countTex: '|G/H| = 2{,}217{,}093{,}120',
    countSci: '2.22 × 10⁹',
    ratioTex: '\\div\\, |H| = 1.95 \\times 10^{10}',
    methodZh: 'H = ⟨U, D, L², R², F², B²⟩',
    methodEn: 'H = ⟨U, D, L², R², F², B²⟩',
    bodyZh:
      'Kociemba 的二阶段算法选 H = ⟨U,D,L²,R²,F²,B²⟩——12 个角朝向都恢复、12 个棱朝向都恢复、4 个 M-slice 棱归位 后的子群。|H| = 19,508,428,800;陪集数 |G/H| = 22.17 亿。把求解切成"先用 ≤ 12 步进 H"+"在 H 里 ≤ 18 步还原"。',
    bodyEn:
      'Kociemba\'s two-phase algorithm picks H = ⟨U,D,L²,R²,F²,B²⟩ — the subgroup of states with all corner-orientation reset, all edge-orientation reset, and M-slice edges back in the M-slice. |H| = 19,508,428,800; so |G/H| = 2.22 billion cosets. Solving splits into "≤ 12 moves to enter H" + "≤ 18 moves to solve inside H".',
    visualGroups: 14,
    visualPerGroup: 8,
    color: 'var(--god-wca)'
},
  {
    id: 2,
    zh: '对称 + 反对称商',
    en: 'Symmetry + antisymmetry quotient',
    countTex: '|G/H|/|S_{48} \\cdot \\sigma| \\approx 5.59 \\times 10^{7}',
    countSci: '55,882,296',
    ratioTex: '\\div\\, |S_{48} \\cdot \\sigma| = 96',
    methodZh: '24 旋转 × 2 镜像 × 2 反演 = 96',
    methodEn: '24 rotations × 2 mirror × 2 inverse = 96',
    bodyZh:
      '立方体的几何对称群 S₄₈ 有 48 个元素 (24 旋转 + 24 镜像旋转,记 O_h 群)。再叠加"逆元等价" (一个状态与它的逆距离相同),共 96 倍压缩。两个陪集若在某对称 σ 下相关,σ(coset_A) = coset_B,则它们距离相等——只需算一个。22.17 亿 ÷ 96 ≈ 2310 万,但因为某些陪集自带对称固定点,实际剩 55,882,296。',
    bodyEn:
      'The cube\'s geometric symmetry group S₄₈ has 48 elements (24 rotations + 24 mirror-rotations, the O_h point group). Combined with "inverse equivalence" (a state and its inverse have the same distance) we get a 96-fold compression. Two cosets related by some σ, σ(coset_A) = coset_B, share the same distance — compute one. 2.22B ÷ 96 ≈ 23M, but some cosets have self-symmetries (orbit-stabiliser), so the exact reduced count is 55,882,296.',
    visualGroups: 11,
    visualPerGroup: 6,
    color: 'var(--god-accent)'
},
  {
    id: 3,
    zh: '集合覆盖压缩',
    en: 'Set-cover compression',
    countTex: '\\#\\,\\text{super-cosets} \\approx 80',
    countSci: '~80',
    ratioTex: '\\div\\, 7 \\times 10^{5}',
    methodZh: 'Greedy set cover + IDA* 邻域批解',
    methodEn: 'Greedy set cover + IDA* batch solve',
    bodyZh:
      'Rokicki 团队观察:每跑一次 IDA*,顺手能给"附近"几千个状态都生成解。把陪集打包成"super-coset"——一次 IDA* 调用同时解 ~70 万个状态。贪心 set cover 把 5588 万对称类压成约 80 个 super-coset 调度任务,每个 super-coset 跑 ~30 分钟。',
    bodyEn:
      'Rokicki et al. observed: one IDA* call gives optimal solutions for thousands of "nearby" states. Pack cosets into super-cosets — one call solves ~700k states at once. Greedy set cover collapses the 55.88M symmetry-classes into ~80 super-coset jobs, each ~30 min CPU.',
    visualGroups: 8,
    visualPerGroup: 4,
    color: 'var(--god-warn)'
},
  {
    id: 4,
    zh: '逐 super-coset 求解',
    en: 'Solve each super-coset',
    countTex: '\\forall\\, s \\in G,\\; d(s) \\le 20',
    countSci: '0 反例',
    ratioTex: '\\to\\, \\text{verify } d \\le 20',
    methodZh: 'IDA* + 1.5 GB pruning DB',
    methodEn: 'IDA* + 1.5 GB pruning DB',
    bodyZh:
      '每个 super-coset 上跑 IDA* (1.5 GB 角块 + 边块 pattern-database 启发,admissible),给出所有 ~70 万个状态的最优解。要求每个解 ≤ 20 步。35 CPU-年算下来,没找到任何 d ≥ 21 的反例 → 上界 20 证毕。结合 Reid 1995 superflip 下界 20,合拢 ⇒ 直径 = 20 HTM。',
    bodyEn:
      'For each super-coset run IDA* (1.5 GB admissible pattern-DB: corners + edges) → optimal solutions for all ~700k states. Assert each ≤ 20. 35 CPU-years, zero counterexamples → upper bound 20 proven. Combined with Reid 1995\'s lower bound 20 ⇒ diameter = 20 HTM exactly.',
    visualGroups: 5,
    visualPerGroup: 2,
    color: 'color-mix(in srgb, var(--god-warn) 70%, var(--god-accent))'
},
];

interface Props { isZh: boolean; }

export default function CosetCompression({ isZh }: Props) {
  const t = (zh: string, en: string) => (isZh ? zh : en);
  const [stage, setStage] = useState<StageId>(0);
  const S = STAGES[stage];

  return (
    <div className="god-coset-wrap">
      {/* stage selector */}
      <div className="god-coset-tabs">
        {STAGES.map((s) => (
          <button key={s.id}
                  className={`god-coset-tab ${stage === s.id ? 'is-on' : ''}`}
                  onClick={() => setStage(s.id)}>
            <span className="god-coset-tab-n">{s.id}</span>
            <span className="god-coset-tab-l">{tr(s)}</span>
          </button>
        ))}
      </div>

      {/* counts */}
      <div className="god-coset-counts">
        <div className="god-coset-count-cell">
          <div className="god-coset-count-l">{t('当前规模', 'Current scale')}</div>
          <div className="god-coset-count-tex">
            <TeX src={S.countTex} />
          </div>
        </div>
        {S.ratioTex && (
          <div className="god-coset-count-cell">
            <div className="god-coset-count-l">{t('本阶段压缩', 'Compression at this step')}</div>
            <div className="god-coset-count-tex">
              <TeX src={S.ratioTex} />
            </div>
          </div>
        )}
        <div className="god-coset-count-cell">
          <div className="god-coset-count-l">{t('结构', 'Structure')}</div>
          <div className="god-coset-count-tex god-coset-method">
            {(isZh ? S.methodZh : S.methodEn)}
          </div>
        </div>
      </div>

      {/* visual grid */}
      <div className="god-coset-grid" aria-hidden>
        {Array.from({ length: S.visualGroups }).map((_, gi) => (
          <div key={gi} className="god-coset-group" style={{ borderColor: S.color }}>
            {Array.from({ length: S.visualPerGroup }).map((__, ci) => (
              <i key={ci} className="god-coset-dot" style={{ background: S.color }} />
            ))}
          </div>
        ))}
        {/* group-count overlay */}
        <div className="god-coset-grid-foot">
          {S.visualGroups} {t('组', 'groups')} × {S.visualPerGroup} ={' '}
          <b>{S.visualGroups * S.visualPerGroup}</b> {t('图示', 'shown')}{' '}
          <span style={{ color: 'var(--god-text-mute)' }}>
            ({t('实际 ', 'actual ')}{S.countSci})
          </span>
        </div>
      </div>

      {/* body text */}
      <p className="god-coset-body">
        <MathText>{(isZh ? S.bodyZh : S.bodyEn)}</MathText>
      </p>

      {/* compression-ratio bar showing total reduction so far */}
      <div className="god-coset-bar-wrap">
        <div className="god-coset-bar-label">
          {t('从 |G| 起累计压缩', 'Cumulative compression vs |G|')}:{' '}
          <b style={{ color: S.color }}>
            {stage === 0 ? '1×' :
              stage === 1 ? '1.95 × 10¹⁰ ×' :
              stage === 2 ? '7.7 × 10¹¹ ×' :
              stage === 3 ? '5.4 × 10¹⁷ ×' :
              '4.3 × 10¹⁹ × (全覆盖)'}
          </b>
        </div>
        <div className="god-coset-bar-bg">
          <div className="god-coset-bar-fill"
               style={{ width: `${(stage / 4) * 100}%`, background: S.color }} />
        </div>
      </div>

      <p className="god-coset-aside">
        <MathText>{t(
          '总耗时 ≈ 35 CPU-年 (2010 年 Google 集群)。最大瓶颈不是 CPU 时间,而是把 5588 万对称类的"邻域结构"装进集合覆盖里——这是数学+工程的混合突破。',
          'Total ≈ 35 CPU-years (2010 Google cluster). The bottleneck wasn\'t CPU but packing the 55.88M symmetry-classes\' neighbourhood structure into the set cover — a math + engineering blend.'
        )}</MathText>
      </p>
    </div>
  );
}
