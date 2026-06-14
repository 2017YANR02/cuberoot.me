'use client';

/**
 * 上帝之数证明的"分镜"动画:
 *   - Reid 1995 (下界 20):证 superflip 不能 ≤ 19
 *   - Rokicki 2008 → 2010 (上界 22 → 20):陪集 + 对称 + 集合覆盖
 *
 * 用户在两条证明之间切换,5-7 步 / 条,逐帧讲解:
 *   - 用一句话标题
 *   - 一段公式 / 文字
 *   - 一个简易图示(用 SVG 自绘,小到能在卡片内)
 *
 * 设计目标:把"5 段公开论文 + 1 个数据库 + 35 CPU-年"压成 12 帧。
 */
import { useState, type ReactElement } from 'react';
import { TeX, MathText } from './Tex';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import i18n from '@/i18n/i18n-client';

type ProofId = 'reid' | 'rokicki';

interface Frame {
  /** scene title — short noun phrase */
  zh: string; en: string;
  /** body text (KaTeX-friendly via MathText) */
  bodyZh: string; bodyEn: string;
  /** inline math under title */
  formula?: string;
  /** scene illustration */
  art: (props: { progress: number }) => ReactElement;
}

/* ─── illustration helpers ─────────────────────────────────────────── */

function CosetGrid({ rows, cols, highlight, color = 'var(--god-wca)' }:
  { rows: number; cols: number; highlight?: [number, number][]; color?: string }) {
  const cells: ReactElement[] = [];
  const SZ = 7, GAP = 2;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const isH = highlight?.some(([rr, cc]) => rr === r && cc === c) ?? false;
      cells.push(
        <rect key={`${r}-${c}`}
              x={10 + c * (SZ + GAP)} y={10 + r * (SZ + GAP)}
              width={SZ} height={SZ} rx={1.5}
              fill={isH ? color : 'var(--god-border)'}
              opacity={isH ? 0.95 : 0.35} />,
      );
    }
  }
  const W = 20 + cols * (SZ + GAP);
  const H = 20 + rows * (SZ + GAP);
  return <svg viewBox={`0 0 ${W} ${H}`} className="god-pa-art-svg">{cells}</svg>;
}

function SuperflipArt() {
  return (
    <svg viewBox="0 0 160 100" className="god-pa-art-svg">
      <g transform="translate(80,50)">
        {/* simple isometric 'flipped' cube — 12 edge slots all in alt color */}
        <polygon points="-30,-20 0,-35 30,-20 30,10 0,25 -30,10" fill="var(--god-surface)" stroke="var(--god-border-strong)" strokeWidth="1.2" />
        <line x1="-30" y1="-20" x2="0" y2="-5" stroke="var(--god-text-mute)" strokeWidth="0.8" />
        <line x1="30" y1="-20" x2="0" y2="-5" stroke="var(--god-text-mute)" strokeWidth="0.8" />
        <line x1="0" y1="-5" x2="0" y2="25" stroke="var(--god-text-mute)" strokeWidth="0.8" />
        {/* flipped edge markers */}
        {[ [-15,-27], [15,-27], [-30,-5], [30,-5], [0,-20], [-15,18], [15,18], [-30,10] ].map(([x,y],i) => (
          <circle key={i} cx={x} cy={y} r="2.5" fill="var(--god-warn)" />
        ))}
        <text x="0" y="46" fontSize="9" textAnchor="middle" fill="var(--god-text-sub)">12 edges flipped</text>
      </g>
    </svg>
  );
}

function BoundsBar({ proven, conj }: { proven: number; conj: number }) {
  return (
    <svg viewBox="0 0 200 40" className="god-pa-art-svg">
      <line x1="10" y1="20" x2="190" y2="20" stroke="var(--god-border-strong)" strokeWidth="2" />
      {[10, 15, 20, 25, 30].map((v) => (
        <g key={v}>
          <line x1={10 + (v / 35) * 180} y1="14" x2={10 + (v / 35) * 180} y2="26" stroke="var(--god-text-mute)" strokeWidth="1" />
          <text x={10 + (v / 35) * 180} y="38" fontSize="7" textAnchor="middle" fill="var(--god-text-mute)">{v}</text>
        </g>
      ))}
      <rect x={10 + (proven / 35) * 180}
            y={11} width={(conj - proven) / 35 * 180}
            height={18} fill="var(--god-warn)" opacity="0.35" />
      <circle cx={10 + (proven / 35) * 180} cy="20" r="5" fill="var(--god-accent)" />
      <text x={10 + (proven / 35) * 180} y="9" fontSize="7" textAnchor="middle" fill="var(--god-accent)">≥{proven}</text>
      <circle cx={10 + (conj / 35) * 180} cy="20" r="5" fill="var(--god-text-mute)" />
      <text x={10 + (conj / 35) * 180} y="9" fontSize="7" textAnchor="middle" fill="var(--god-text-sub)">≤{conj}</text>
    </svg>
  );
}

function CompressionFlow({ stage }: { stage: number }) {
  // stage 0..4 — show one filled square per stage
  return (
    <svg viewBox="0 0 200 60" className="god-pa-art-svg">
      {['10¹⁹', '10⁹', '10⁷', '10²', '✓'].map((label, i) => {
        const x = 16 + i * 40;
        const active = i <= stage;
        return (
          <g key={i}>
            <rect x={x - 14} y={18} width={28} height={20} rx={3}
                  fill={active ? 'var(--god-accent)' : 'var(--god-border)'}
                  opacity={active ? 0.85 : 0.3} />
            <text x={x} y={32} fontSize="8" textAnchor="middle"
                  fill={active ? 'var(--accent-foreground)' : 'var(--god-text-mute)'}
                  fontWeight={active ? 600 : 400}>
              {label}
            </text>
            {i < 4 && (
              <line x1={x + 14} y1={28} x2={x + 26} y2={28}
                    stroke={i < stage ? 'var(--god-accent)' : 'var(--god-border)'}
                    strokeWidth="1.5" markerEnd="url(#god-arrow)" />
            )}
            <text x={x} y={52} fontSize="6.5" textAnchor="middle" fill="var(--god-text-mute)">
              {['G', '÷H', '÷S₄₈', '÷cover', 'verify'][i]}
            </text>
          </g>
        );
      })}
      <defs>
        <marker id="god-arrow" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="4" markerHeight="4" orient="auto">
          <path d="M 0 0 L 8 4 L 0 8 z" fill="var(--god-accent)" />
        </marker>
      </defs>
    </svg>
  );
}

/* ─── frames ────────────────────────────────────────────────────────── */

const REID: Frame[] = [
  {
    zh: '出发:观察 superflip 的对称性',
    en: 'Setup: observe the symmetry of superflip',
    bodyZh: 'Superflip = 12 个棱块全部翻 180° (位置不变),8 个角块全在原位。它在立方体对称群 S₄₈ 下被一整类对称保持 (axes through opposite faces),这一对称将极大缩小要验证的状态。',
    bodyEn: 'Superflip = all 12 edges flipped 180° in place, 8 corners untouched. It\'s stabilised by a large subgroup of S₄₈ (axes through opposite faces), shrinking the verification set.',
    art: () => <SuperflipArt />
},
  {
    zh: '声明:若解 ≤ 19,则存在某段被算法穷尽',
    en: 'Claim: if a ≤19 solution exists, an algorithm finds it',
    formula: 'd(\\text{superflip}) \\le 19 \\implies \\exists\\, w \\in S^{*},\\ |w| \\le 19,\\ w \\cdot \\text{superflip} = e',
    bodyZh: '反证法:假设存在 ≤ 19 HTM 的解 w。Reid 写了一个 IDA* 求解器枚举所有 ≤ 19 步序列(去同轴 + 对称等价),只需检查 superflip 是否被覆盖。',
    bodyEn: 'Proof by contradiction: assume a ≤19 HTM solution w exists. Reid wrote an IDA* enumerator covering all ≤19-move sequences (same-axis pruning + symmetry equivalence) and checked whether superflip is reached.',
    art: () => (
      <svg viewBox="0 0 160 80" className="god-pa-art-svg">
        <text x="80" y="20" fontSize="10" textAnchor="middle" fill="var(--god-text-sub)">enumerate all ≤19-HTM seqs</text>
        <text x="80" y="40" fontSize="14" textAnchor="middle" fill="var(--god-text-mute)" fontFamily="monospace">∑ N · M^(d-1) {' '}</text>
        <text x="80" y="58" fontSize="9" textAnchor="middle" fill="var(--god-text-mute)" fontFamily="monospace">d=1..19</text>
        <text x="80" y="74" fontSize="8" textAnchor="middle" fill="var(--god-text-mute)">≈ 6 × 10¹⁹ raw → ÷ S₄₈ → ~10¹⁸</text>
      </svg>
    )
},
  {
    zh: '机器穷举:90 CPU-小时 (1995 的硬件)',
    en: 'Machine enumeration: 90 CPU-hours (1995 hardware)',
    bodyZh: 'Reid 用 SGI Indigo 工作站约 90 小时跑完。结果:没有任何 ≤ 19 步序列把 superflip 解掉。结合"显式 20 步解的存在" ⇒ d(superflip) = 20.',
    bodyEn: 'Reid ran an SGI Indigo for ~90 hours. Result: no ≤19-move sequence solves superflip. Combined with an explicit 20-move solution ⇒ d(superflip) = 20 exactly.',
    formula: 'd(\\text{superflip}) = 20',
    art: () => <BoundsBar proven={20} conj={20} />
},
  {
    zh: '推论:三阶上帝之数 ≥ 20',
    en: 'Corollary: 3×3 God\'s number ≥ 20',
    bodyZh: 'Cayley 图直径 = max_g d(g) ≥ d(superflip) = 20。这是 15 年内三阶下界的精确值,直到 2010 年的上界证明把上下界合拢。',
    bodyEn: 'Diameter of the Cayley graph = max_g d(g) ≥ d(superflip) = 20. The exact lower bound for the next 15 years, until the 2010 upper-bound proof closed the gap.',
    art: () => <BoundsBar proven={20} conj={22} />
},
];

const ROKICKI: Frame[] = [
  {
    zh: '2008 起点:上界 22, 下界 20',
    en: '2008 starting point: ≤22, ≥20',
    bodyZh: 'Reid 1995 已证下界 20 + 上界 22。2008 年 Rokicki 用 Kociemba 子群 H + 部分陪集分析,把上界压到 22。还差 2 步合拢。',
    bodyEn: 'Reid 1995 had lower 20 + upper 22. In 2008 Rokicki used Kociemba subgroup H + partial coset analysis to drop upper to 22. Still a 2-move gap.',
    art: () => <BoundsBar proven={20} conj={22} />
},
  {
    zh: '陪集分解:|G| → |G/H|',
    en: 'Coset decomposition: |G| → |G/H|',
    formula: '|G/H| = \\frac{|G|}{|H|} = \\frac{4.32 \\times 10^{19}}{1.95 \\times 10^{10}} \\approx 2.22 \\times 10^{9}',
    bodyZh: 'Lagrange 定理 + Kociemba\'s H = ⟨U,D,L²,R²,F²,B²⟩ ⇒ 22.17 亿个陪集。每个陪集"代表"一族距离相等的状态。',
    bodyEn: 'Lagrange + Kociemba\'s H = ⟨U,D,L²,R²,F²,B²⟩ ⇒ 2.22 billion cosets. Each coset "represents" a family of states sharing the same distance class.',
    art: () => <CompressionFlow stage={1} />
},
  {
    zh: '对称商:|G/H| → 5588 万对称类',
    en: 'Symmetry quotient: |G/H| → 55.88M classes',
    formula: '|G/H| \\;/\\; |S_{48} \\cdot \\sigma| \\approx \\frac{2.22 \\times 10^{9}}{96}',
    bodyZh: '立方体几何对称群 S₄₈ (24 旋 + 24 镜旋 = O_h 点群) + 逆元等价 = 96 倍压缩。两个对称等价陪集距离相等,只算其一。最终 55,882,296 个对称类。',
    bodyEn: 'Cube geometric symmetry group S₄₈ (24 rotations + 24 mirror = O_h) + inverse equivalence = 96× compression. Cosets equivalent under symmetry share their distance; compute one. Final: 55,882,296 symmetry classes.',
    art: () => <CompressionFlow stage={2} />
},
  {
    zh: '集合覆盖:5588 万 → 80 super-cosets',
    en: 'Set cover: 55.88M → ~80 super-cosets',
    bodyZh: 'Rokicki 观察:跑一次 IDA* 时,顺手能解附近 ~70 万状态。把对称类打包成 super-coset—每个 super-coset 一次 IDA* 调用。Greedy set cover 把 5588 万压成约 80 个 super-coset 作业。',
    bodyEn: 'Rokicki: one IDA* call optimally solves ~700k nearby states. Pack symmetry classes into super-cosets; greedy set cover collapses 55.88M into ~80 super-coset jobs.',
    art: () => <CompressionFlow stage={3} />
},
  {
    zh: 'IDA* + 1.5 GB PDB:跑 35 CPU-年',
    en: 'IDA* + 1.5 GB PDB: 35 CPU-years',
    formula: 'h(s) = \\max\\bigl(\\text{corner-PDB}(s),\\ \\text{edge-6-PDB}(s)\\bigr)',
    bodyZh: 'Google 集群,每个 super-coset 跑 ~30 分钟。Korf 启发 = max(角块 PDB 88 MB,两个 6-edge PDB 各 ~700 MB,共 1.5 GB)。35 CPU-年总算力。',
    bodyEn: 'Google cluster, each super-coset ~30 min. Korf heuristic = max(corner-PDB 88 MB, two 6-edge PDBs ~700 MB each, total 1.5 GB). 35 CPU-years total.',
    art: () => (
      <CosetGrid rows={6} cols={20}
                 highlight={Array.from({ length: 30 }).map((_, i) => [Math.floor(i / 6) % 5 + 1, (i * 5) % 20] as [number, number])}
                 color="var(--god-warn)" />
    )
},
  {
    zh: '结果:全部 super-coset 都 ≤ 20 步',
    en: 'Result: every super-coset solves in ≤ 20',
    bodyZh: '所有 ~80 个 super-coset 都验证通过:对每个成员状态,IDA* 都返回长度 ≤ 20 的解。没有反例 ⇒ 上界 20 证毕。结合 Reid 1995 下界 20 ⇒ 直径 = 20.',
    bodyEn: 'All ~80 super-cosets verified: for every member state, IDA* returns a solution of length ≤ 20. Zero counterexamples ⇒ upper bound 20. Combined with Reid 1995 lower bound ⇒ diameter = 20.',
    formula: 'D(G, S_{\\text{HTM}}) = 20',
    art: () => <CompressionFlow stage={4} />
},
  {
    zh: '公布日期:2010-07-13',
    en: 'Announcement: 2010-07-13',
    bodyZh: '由 Tomas Rokicki, Herbert Kociemba, Morley Davidson, John Dethridge 联合公布,cube20.org 同步开放数据。2014 年发表于 SIAM J. Discrete Math (peer-reviewed)。',
    bodyEn: 'Announced jointly by Tomas Rokicki, Herbert Kociemba, Morley Davidson, John Dethridge; cube20.org released data. Published in SIAM J. Discrete Math 2014 (peer-reviewed).',
    art: () => <BoundsBar proven={20} conj={20} />
},
];

const PROOFS: Record<ProofId, { name: { zh: string; en: string
 }; frames: Frame[]; meta: { zh: string; en: string
 } }> = {
  reid: {
    name: { zh: 'Reid 1995 — 下界 = 20', en: 'Reid 1995 — lower bound = 20' },
    frames: REID,
    meta: { zh: '4 帧 · 90 CPU-小时 (SGI Indigo 1995)', en: '4 frames · 90 CPU-hours (SGI Indigo, 1995)'
    },
  },
  rokicki: {
    name: { zh: 'Rokicki 2008→2010 — 上界 = 20', en: 'Rokicki 2008→2010 — upper bound = 20' },
    frames: ROKICKI,
    meta: { zh: '7 帧 · 35 CPU-年 (Google 集群 2010)', en: '7 frames · 35 CPU-years (Google cluster, 2010)'
    },
  },
};

interface Props { isZh: boolean; }

export default function ProofAnimator({ isZh }: Props) {
  const t = (zh: string, en: string) => (isZh ? zh : en);
  const [proof, setProof] = useState<ProofId>('rokicki');
  const [frame, setFrame] = useState(0);

  const P = PROOFS[proof];
  const F = P.frames[frame];
  const total = P.frames.length;

  const prev = () => setFrame((f) => Math.max(0, f - 1));
  const next = () => setFrame((f) => Math.min(total - 1, f + 1));

  return (
    <div className="god-pa-wrap">
      {/* proof selector */}
      <div className="god-pa-tabs">
        {(['reid', 'rokicki'] as ProofId[]).map((p) => (
          <button key={p}
                  className={`god-pa-tab ${proof === p ? 'is-on' : ''}`}
                  onClick={() => { setProof(p); setFrame(0); }}>
            <div className="god-pa-tab-name">{((i18n.language.startsWith('zh') ? PROOFS[p].name.zh : PROOFS[p].name.en))}</div>
            <div className="god-pa-tab-meta">{((i18n.language.startsWith('zh') ? PROOFS[p].meta.zh : PROOFS[p].meta.en))}</div>
          </button>
        ))}
      </div>

      {/* frame */}
      <div className="god-pa-frame">
        <div className="god-pa-frame-l">
          <div className="god-pa-art">{F.art({ progress: frame / Math.max(1, total - 1) })}</div>
        </div>
        <div className="god-pa-frame-r">
          <div className="god-pa-frame-h">
            <span className="god-pa-frame-i">{frame + 1} / {total}</span>
            <h3 className="god-pa-frame-title">{((i18n.language.startsWith('zh') ? F.zh : F.en))}</h3>
          </div>
          {F.formula && (
            <div className="god-pa-frame-formula">
              <TeX src={F.formula} />
            </div>
          )}
          <p className="god-pa-frame-body">
            <MathText>{(isZh ? F.bodyZh : F.bodyEn)}</MathText>
          </p>
        </div>
      </div>

      {/* navigation */}
      <div className="god-pa-nav">
        <button className="god-btn-secondary" onClick={prev} disabled={frame === 0}>
          <ChevronLeft size={16} /> {t('上一帧', 'prev')}
        </button>
        <div className="god-pa-dots">
          {P.frames.map((_, i) => (
            <button key={i}
                    className={`god-pa-dot ${i === frame ? 'is-on' : ''} ${i < frame ? 'is-past' : ''}`}
                    onClick={() => setFrame(i)}
                    aria-label={`frame ${i + 1}`} />
          ))}
        </div>
        <button className="god-btn-secondary" onClick={next} disabled={frame === total - 1}>
          {t('下一帧', 'next')} <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
