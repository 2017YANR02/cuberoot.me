'use client';

/**
 * Open Problems — 未解之谜:4×4 / 5×5 / 6×6 / 7×7 / Megaminx 各自的精确直径未知。
 * 每个 panel 给出 gap + 收紧方向 + 可能的"赏金"工作量。
 */
import { MathText } from './Tex';

interface Problem {
  id: string;
  name: { zh: string; en: string };
  states: string;
  lower: number;
  upper: number;
  metric: string;
  whyHard: { zh: string; en: string };
  toClose: { zh: string; en: string };
  estimate?: { zh: string; en: string };
}

const PROBLEMS: Problem[] = [
  {
    id: '444',
    name: { zh: '4×4 直径', en: '4×4 diameter' },
    states: '7.40 × 10⁴⁵',
    lower: 35,
    upper: 57,
    metric: 'OBTM',
    whyHard: {
      zh: '中心块"看起来一样"使得每个表观状态对应 24⁶/2 ≈ 1.9 × 10⁷ 个内部状态;对称压缩比三阶难很多。Reduction-style 算法的上界很松。',
      en: 'Indistinguishable centres mean each visual state covers ~1.9 × 10⁷ internal states; symmetry compression is harder than 3×3. Reduction-style algorithms give loose upper bounds.',
    },
    toClose: {
      zh: '需要类似 Kociemba 的两阶段陪集分解,但找一个合适的中间子群 H ⊂ G(4×4) 非常难——4×4 没有"二色面 → 单色面"那种自然的简化。',
      en: 'Needs a Kociemba-style two-phase coset decomposition, but finding a suitable intermediate subgroup H ⊂ G(4×4) is hard — 4×4 has no natural "2-colour → 1-colour" reduction.',
    },
    estimate: {
      zh: '上界压到 40 步,可能需要 ~1000 CPU-年。下界提升到 38-40,需要更紧的 canonical sequence 分析。',
      en: 'Tightening upper to 40 likely needs ~1000 CPU-years. Lifting lower to 38-40 needs tighter canonical-sequence analysis.',
    },
  },
  {
    id: 'minx',
    name: { zh: 'Megaminx 直径', en: 'Megaminx diameter' },
    states: '1.01 × 10⁶⁸',
    lower: 48,
    upper: 194,
    metric: 'HTM',
    whyHard: {
      zh: 'Megaminx 有 12 个面,生成元有 11 × 2 × 2 = 44 个(去掉同轴上一步)。这"分支因子"比三阶大太多,IDA* 的有效深度受限。陪集分解需要找一个 12-面对称结构。',
      en: 'Megaminx has 12 faces, generators 11 × 2 × 2 = 44 (after rejecting same-axis). Branching factor is way larger than 3×3, limiting effective IDA* depth. Coset decomposition needs a 12-face-symmetric subgroup.',
    },
    toClose: {
      zh: 'Kociemba 自己已经做过初步实验,但没找到合适的 P1 类子群。任何精确直径证明可能要等"专用 GPU 求解器" + "10 万 GPU-年"。',
      en: 'Kociemba has experimented but found no good P1-like subgroup. Any exact proof likely needs purpose-built GPU solvers + ~100K GPU-years.',
    },
    estimate: {
      zh: '146 步的缝合上几乎不可能在 10 年内完成。Megaminx 大概率会一直停留在"上下界相差几十步"的状态。',
      en: 'A 146-move gap is unlikely to close within 10 years. Megaminx will probably remain "bounds known, exact diameter unknown" indefinitely.',
    },
  },
  {
    id: '555',
    name: { zh: '5×5 / 6×6 / 7×7 直径', en: '5×5 / 6×6 / 7×7 diameter' },
    states: '10⁷⁴ / 10¹¹⁶ / 10¹⁶⁰',
    lower: 52,
    upper: 130,
    metric: 'OBTM',
    whyHard: {
      zh: '状态空间大到陪集分解都吃不消。Demaine 的 Θ(N²/log N) 给出大致量级,但其证明的常数因子(几百)使得"精确直径"在物理意义上无法验证——没人能跑 10¹⁶⁰ 个状态。',
      en: 'State space defeats coset decomposition. Demaine\'s Θ(N²/log N) gives the order, but the proof\'s hidden constants (hundreds) leave "exact diameter" physically unverifiable — no one can scan 10¹⁶⁰ states.',
    },
    toClose: {
      zh: '可能的进展只有"渐近常数收紧"——把 Demaine 的上界系数从 c1 降到 c1/2,或者把下界系数从 c2 提到 2c2。这种工作适合 STOC/SODA 论文,而非 cube 比赛。',
      en: 'Realistic progress is "tightening asymptotic constants" — shrinking Demaine\'s upper coefficient c1, or lifting the lower-bound coefficient c2. STOC/SODA-paper territory, not a cubing competition.',
    },
  },
];

interface Props { isZh: boolean; }

export default function OpenProblems({ isZh }: Props) {
  const t = (zh: string, en: string) => (isZh ? zh : en);
  return (
    <div className="god-open-wrap">
      {PROBLEMS.map((p) => (
        <article key={p.id} className="god-open-card">
          <header className="god-open-head">
            <h3>{isZh ? p.name.zh : p.name.en}</h3>
            <div className="god-open-bounds">
              <span className="god-open-lower">{p.lower}</span>
              <span className="god-open-sep">…</span>
              <span className="god-open-upper">{p.upper}</span>
              <span className="god-open-metric">{p.metric}</span>
            </div>
          </header>
          <div className="god-open-states"><MathText>{`|G| = ${p.states}`}</MathText> · {t('鸿沟', 'gap')} = <b>{p.upper - p.lower}</b> {t('步', 'moves')}</div>

          <div className="god-open-row">
            <div className="god-open-row-label">{t('为何难', 'Why it\'s hard')}</div>
            <div className="god-open-row-body"><MathText>{isZh ? p.whyHard.zh : p.whyHard.en}</MathText></div>
          </div>
          <div className="god-open-row">
            <div className="god-open-row-label">{t('合拢方向', 'Path to close')}</div>
            <div className="god-open-row-body"><MathText>{isZh ? p.toClose.zh : p.toClose.en}</MathText></div>
          </div>
          {p.estimate && (
            <div className="god-open-row">
              <div className="god-open-row-label">{t('粗略估算', 'Estimate')}</div>
              <div className="god-open-row-body"><MathText>{isZh ? p.estimate.zh : p.estimate.en}</MathText></div>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
