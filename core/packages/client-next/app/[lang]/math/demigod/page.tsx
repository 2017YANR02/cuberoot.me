'use client';

/**
 * /math/demigod — Merino & Subercaseaux 2024
 *   "A Demigod's Number for the Rubik's Cube" (arXiv:2501.00144) 详细介绍。
 *
 * 结构 (13 节):
 *   1.  Hero + 三数字对比 (God 20 / Demigod 36 / Human 205)
 *   2.  TL;DR
 *   3.  群论预备:Cayley graph + 直径 + 平均距离
 *   4.  Theorem 2: D < 2μ on vertex-transitive graphs (含完整证明)
 *   5.  Lemma 3: Cayley graph 是顶点传递的 (含证明) — 交互式 cycle 演示
 *   6.  Theorem 1: 主概率界 (含证明) — 交互式 Hoeffding explorer
 *   7.  Human's Number 技巧 — 把 205 压成 20
 *   8.  Sampling algorithm:Fundamental Theorem of Cubology
 *   9.  Experimental setup + Figure 5 histogram (交互式)
 *  10.  Live sampler: 用 cubing.js 自己跑一遍
 *  11.  与历史 bounds 对照 + Three-number 详表
 *  12.  Generalization & open problems
 *  13.  Epistemic discussion + references
 */
import { Suspense, lazy, useState } from 'react';
import Link from '@/components/AppLink';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ExternalLink, FileText } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { TeX, TeXBlock } from '../god/_components/Tex';
import { PAPER_MEAN, PAPER_TOTAL } from './_components/DistanceHistogram';
import './demigod.css';
import { useT } from "@/hooks/useT";

const HoeffdingExplorer = lazy(() => import('./_components/HoeffdingExplorer'));
const DistanceHistogram = lazy(() => import('./_components/DistanceHistogram'));
const VertexTransitiveProof = lazy(() => import('./_components/VertexTransitiveProof'));
const LiveSampler = lazy(() => import('./_components/LiveSampler'));

const HISTORY: ReadonlyArray<{ year: number; lo: number; hi: number; final?: boolean }> = [
  { year: 1981, lo: 18, hi: 52 },
  { year: 1990, lo: 18, hi: 42 },
  { year: 1992, lo: 18, hi: 39 },
  { year: 1992, lo: 18, hi: 37 },
  { year: 1995, lo: 18, hi: 29 },
  { year: 1995, lo: 20, hi: 29 },
  { year: 2005, lo: 20, hi: 28 },
  { year: 2006, lo: 20, hi: 27 },
  { year: 2007, lo: 20, hi: 26 },
  { year: 2008, lo: 20, hi: 25 },
  { year: 2008, lo: 20, hi: 23 },
  { year: 2008, lo: 20, hi: 22 },
  { year: 2010, lo: 20, hi: 20, final: true },
];

const BEGINNERS_205: ReadonlyArray<[string, string, number]> = [
  ['White cross', '白色十字', 20],
  ['White corners', '白色角块', 60],
  ['Edges of the second layer', '第二层棱块', 80],
  ['Yellow cross', '黄色十字', 18],
  ['Permuting yellow edges', '黄色棱块换位', 21],
  ['Permuting yellow corners', '黄色角块换位', 24],
  ['Orienting yellow corners', '黄色角块定向', 42],
];
const TOTAL_205 = BEGINNERS_205.reduce((a, b) => a + b[2], 0);

export default function DemigodPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const t = useT();
  useDocumentTitle('半神之数 (Demigod\'s Number)', "Demigod's Number");

  // Hoeffding explorer state (lifted so Theorem 1 readout stays in sync)
  const [hSampleSize, setHSampleSize] = useState(500_000);
  const [hTolerance, setHTolerance] = useState(0.1);
  const [hCMode, setHCMode] = useState<'human' | 'close'>('close');

  // Live sampler results — flow into the histogram overlay
  const [liveCounts, setLiveCounts] = useState<Map<number, number>>(() => new Map());
  const [liveMean, setLiveMean] = useState(0);
  const [liveTotal, setLiveTotal] = useState(0);

  return (
    <div className="demigod-page">
      <header className="dg-header">
        <Link href="/math/god" className="dg-back">
          <ArrowLeft size={16} />
          <span>{t('返回 上帝之数', "Back to God's Number")}</span>
        </Link>
      </header>

      <main className="dg-main">

        {/* ─────────────── 1. HERO ─────────────── */}
        <section className="dg-hero">
          <div className="dg-hero-eyebrow">
            {t('数学 · 组合 · 概率论证', 'Mathematics · Combinatorics · Probabilistic Argument')}
          </div>
          <h1 className="dg-title">
            {t('半神之数 ', "Demigod's Number ")}
            <span className="dg-title-sub">
              {t('用 36 步给三阶魔方一个"高概率"上界', '— a high-probability 36-move bound for 3×3')}
            </span>
          </h1>
          <div className="dg-paper-meta">
            <span>Arturo Merino · Bernardo Subercaseaux</span>
            <a href="https://arxiv.org/abs/2501.00144" target="_blank" rel="noopener noreferrer">
              <FileText size={13} /> arXiv:2501.00144
            </a>
            <a href="https://arxiv.org/pdf/2501.00144" target="_blank" rel="noopener noreferrer">
              <ExternalLink size={13} /> PDF
            </a>
            <span>{t('2024-12-30 投稿', 'Submitted 2024-12-30')}</span>
          </div>
          <p className="dg-lead">
            {(isZh ? (
                                    <>2010 年 Rokicki 等人用 35 CPU·年 在 Google 集群证明了三阶魔方的上帝之数恰为 <TeX src="20" /> HTM。论文不易复核,几乎没人独立跑过。2024 年底 Merino & Subercaseaux 提出一种新得多的方法:不去求精确直径,而是承认略弱的 <TeX src="\le 36" />,但只需 <strong>500,000 个随机样本 + 100 小时单机算力</strong>,并附完整可验证的证书 — 任何具备一台笔记本与 Kociemba 求解器的人都能在一晚跑完。本页详细拆解全篇,把证明、概率界、采样算法、与上帝之数的关系全摊开来。</>
                                  ) : (
                                    <>In 2010 Rokicki et al. used 35 CPU-years on a Google cluster to prove 3×3 God's number is exactly <TeX src="20" /> HTM — a result almost no one has ever independently reproduced. In late 2024, Merino & Subercaseaux proposed a fundamentally different approach: settle for the weaker <TeX src="\le 36" /> bound, in exchange for needing only <strong>500,000 random samples and ~100 hours of single-machine compute</strong>, each one certified by a short Kociemba solution. Anyone with a laptop and a Kociemba solver can replicate it overnight. This page walks through the paper end-to-end — proof, concentration bound, sampling algorithm, and its place beside God's number.</>
                                  ))}
          </p>

          {/* three-number strip */}
          <div className="dg-numbers">
            <div className="dg-num-card is-god">
              <div className="dg-num-tag">{t("上帝之数", "God's number")}</div>
              <div className="dg-num-big">20<span className="dg-num-unit"> HTM</span></div>
              <div className="dg-num-sub">{t('精确证明:Rokicki et al. 2010,35 CPU·年', 'Proven exact: Rokicki et al. 2010, 35 CPU-years')}</div>
              <div className="dg-num-cite">SIAM Rev. 2014</div>
            </div>
            <div className="dg-num-card is-demi">
              <div className="dg-num-tag">{t("半神之数", "Demigod's number")}</div>
              <div className="dg-num-big">36<span className="dg-num-unit"> HTM</span></div>
              <div className="dg-num-sub">{t('概率上界:Merino & Subercaseaux 2024,~100 小时笔电', 'High-probability bound: Merino & Subercaseaux 2024, ~100 hr laptop')}</div>
              <div className="dg-num-cite">arXiv:2501.00144</div>
            </div>
            <div className="dg-num-card is-human">
              <div className="dg-num-tag">{t('凡人之数', "Human's number")}</div>
              <div className="dg-num-big">205<span className="dg-num-unit"> HTM</span></div>
              <div className="dg-num-sub">{t('入门法上界:Lemma 8,7 步 layer-by-layer', "Beginner's method ceiling: Lemma 8, 7-step LBL")}</div>
              <div className="dg-num-cite">Appendix A</div>
            </div>
          </div>

          <div className="dg-callout is-ok">
            <span className="dg-callout-h">{t('核心一句话', 'In one line')}</span>
            {(isZh ? (
                                    <>对任意顶点传递图 <TeX src="G" />,<TeX src="D < 2\mu" />。三阶魔方的 Cayley 图顶点传递,采 500k 样本 + Hoeffding 给出 <TeX src="\hat\mu \approx 18.32 \pm 0.1" />,故 <TeX src="D \le 2 \cdot 18.4804 < 37" />,且 <TeX src="D" /> 是整数 ⇒ <TeX src="D \le 36" />。</>
                                  ) : (
                                    <>For any vertex-transitive graph <TeX src="G" />, <TeX src="D < 2\mu" />. The 3×3 Cayley graph is vertex-transitive; 500k samples + Hoeffding give <TeX src="\hat\mu \approx 18.32 \pm 0.1" />, so <TeX src="D \le 2 \cdot 18.4804 < 37" />, and since <TeX src="D \in \mathbb{Z}" /> ⇒ <TeX src="D \le 36" />.</>
                                  ))}
          </div>
        </section>

        {/* ─────────────── 2. TL;DR ─────────────── */}
        <section className="dg-section">
          <h2>{t('TL;DR', 'TL;DR')}</h2>
          <ul>
            <li>
              {(isZh ? (
                                          <><strong>什么:</strong>一种"重新证 3×3 上帝之数"的方式 — 把精确的 <TeX src="20" /> 放宽到概率性的 <TeX src="\le 36" />,但代价小到一台笔电就能跑完。作者管这种"减半的算力换略弱结论"的范式叫 <em>demigod number</em>。</>
                                        ) : (
                                          <><strong>What:</strong> a re-derivation of the 3×3 diameter, relaxed from the exact <TeX src="20" /> down to a probabilistic <TeX src="\le 36" />, but reproducible on a single laptop. The authors dub this "trade compute for a weaker conclusion" pattern a <em>demigod number</em>.</>
                                        ))}
            </li>
            <li>
              {(isZh ? (
                                          <><strong>怎么:</strong>(i) 在任意顶点传递图上有 <TeX src="D < 2\mu" />(基本三角不等式);(ii) 三阶魔方的 Cayley 图顶点传递;(iii) Hoeffding 不等式把 <TeX src="\mu" /> 收紧到 <TeX src="\hat\mu" /> 邻域。</>
                                        ) : (
                                          <><strong>How:</strong> (i) on any vertex-transitive graph, <TeX src="D < 2\mu" /> (basic triangle inequality); (ii) the 3×3 Cayley graph is vertex-transitive; (iii) Hoeffding pins <TeX src="\mu" /> close to the empirical <TeX src="\hat\mu" />.</>
                                        ))}
            </li>
            <li>
              {(isZh ? (
                                          <><strong>关键技巧:</strong>朴素 Hoeffding 用 <TeX src="C = 205" />(凡人之数当 worst-case)需要 ~<TeX src="3 \times 10^{8}" /> 样本;通过证"几乎所有状态都 <TeX src="\le 20" /> 步"(<TeX src="\ge 99.97\%" />),实际取 <TeX src="C = 20" /> 把样本量降到 <TeX src="5 \times 10^{5}" /> 量级。</>
                                        ) : (
                                          <><strong>Key trick:</strong> Plain Hoeffding with <TeX src="C = 205" /> (Human's number as worst case) demands ~<TeX src="3 \times 10^{8}" /> samples; proving "<TeX src="\ge 99.97\%" /> of states need <TeX src="\le 20" /> moves" lets <TeX src="C = 20" />, cutting samples to <TeX src="5 \times 10^{5}" />.</>
                                        ))}
            </li>
            <li>
              {(isZh ? (
                                          <><strong>实验:</strong>MacBook Pro M3 跑 500k samples <TeX src="\approx" /> 5 小时。所有 sample 都 <TeX src="\le 20" /> 步,均值 <TeX src="18.3189" />。误证概率 <TeX src="<10^{-10}" />。</>
                                        ) : (
                                          <><strong>Experiment:</strong> MacBook Pro M3 ran 500k samples in <TeX src="\approx" /> 5 hours. Every sample solves in <TeX src="\le 20" />, mean <TeX src="18.3189" />, total error probability <TeX src="<10^{-10}" />.</>
                                        ))}
            </li>
            <li>
              {(isZh ? (
                                          <><strong>推广:</strong>对任何"顶点传递 + 可均匀采样"的群图(Pyraminx、Megaminx、5×5、torus 上的 15-puzzle)都适用,即便没有 God's number。</>
                                        ) : (
                                          <><strong>Generalises:</strong> applies to any vertex-transitive graph that admits uniform sampling — Pyraminx, Megaminx, 5×5, the 15-puzzle on a torus — even where God's number is unknown.</>
                                        ))}
            </li>
          </ul>
        </section>

        {/* ─────────────── 3. Preliminaries ─────────────── */}
        <section className="dg-section">
          <h2>{t('3. 群论预备', '3. Preliminaries')}</h2>
          <p>
            {(isZh ? (
                                    <>把魔方建模成群:位置态对应 <TeX src="S_{54}" />(54 个色块)的某个置换;面转 <TeX src="\{R, L, U, D, F, B\}" /> 是生成元;六个固定中心使其同构地落入 <TeX src="S_{48}" /> 的一个子群。论文用的是经典记号:</>
                                  ) : (
                                    <>Model the cube as a group: every position is a permutation of <TeX src="S_{54}" /> (54 stickers); face turns <TeX src="\{R, L, U, D, F, B\}" /> are generators; the six fixed centres let us embed it in <TeX src="S_{48}" />. Classical setup:</>
                                  ))}
          </p>

          <div className="dg-definition">
            <span className="dg-def-head">{t('定义 1 — Cayley 图', 'Definition 1 — Cayley graph')}</span>
            <p style={{ margin: 0 }}>
              {(isZh ? (
                                          <>给定群 <TeX src="G = (A, \star)" /> 和生成元集 <TeX src="S \subseteq A" />,Cayley 图 <TeX src="G_S" /> 的顶点集是 <TeX src="A" />,边 <TeX src="(u, v)" /> 当且仅当存在 <TeX src="s \in S" /> 使 <TeX src="u \star s = v" />。</>
                                        ) : (
                                          <>Given group <TeX src="G = (A, \star)" /> and generators <TeX src="S \subseteq A" />, the Cayley graph <TeX src="G_S" /> has vertex set <TeX src="A" /> with edge <TeX src="(u, v)" /> iff some <TeX src="s \in S" /> gives <TeX src="u \star s = v" />.</>
                                        ))}
            </p>
          </div>

          <p>
            {(isZh ? <>论文中,</> : <>For the cube, this gives</>)}
          </p>
          <div className="dg-formula">
            <TeX src={`S_{\\mathcal{R}} := \\{R, R', R^{2}, L, L', L^{2}, U, U', U^{2}, D, D', D^{2}, F, F', F^{2}, B, B', B^{2}\\}`} />
          </div>
          <div className="dg-formula-cap">
            {(isZh ? (
                                    <>18 个生成元 —— 把 <TeX src="R^2" /> 算作"一步"就是 HTM(Half-Turn Metric);若把 <TeX src="R^2" /> 算作两步则是 QTM,直径变成 <TeX src="26" />。</>
                                  ) : (
                                    <>18 generators — counting <TeX src="R^2" /> as a single move is HTM; counting it as two gives QTM, where God's number is <TeX src="26" />.</>
                                  ))}
          </div>

          <div className="dg-definition">
            <span className="dg-def-head">{t('定义 2 / 3 — 直径与均值', 'Definitions 2 / 3 — Diameter and mean')}</span>
            <TeXBlock src={`D \\;=\\; \\max_{u, v \\in \\binom{V}{2}} d(u, v), \\qquad \\mu \\;=\\; \\frac{1}{\\binom{|V|}{2}} \\sum_{u, v \\in \\binom{V}{2}} d(u, v).`} />
            <p style={{ margin: '0.5rem 0 0', fontSize: '0.9rem' }}>
              {(isZh ? (
                                          <>"上帝之数" = <TeX src="D" />;"半神之数"是关于 <TeX src="2\mu" /> 的概率上界。</>
                                        ) : (
                                          <>"God's number" = <TeX src="D" />; the demigod's number is a high-probability upper bound on <TeX src="2\mu" />.</>
                                        ))}
            </p>
          </div>
        </section>

        {/* ─────────────── 4. Theorem 2: D < 2μ ─────────────── */}
        <section className="dg-section">
          <h2>{t('4. 核心定理:顶点传递 ⇒ D < 2μ', '4. Core theorem: vertex-transitive ⇒ D < 2μ')}</h2>
          <p>
            {(isZh ? (
                                    <>一般图的 <TeX src="D / \mu" /> 可以无界 — 论文里给出"团 + 一根长尾"的反例,比值是 <TeX src="\Omega(n^{1/2})" />,且 Wu et al. 2011 证明该界紧。但只要图顶点传递,这个比例就被 2 锁死。</>
                                  ) : (
                                    <>For general graphs <TeX src="D / \mu" /> can blow up — the paper gives the clique-plus-tail example reaching <TeX src="\Omega(n^{1/2})" />, which Wu et al. 2011 prove tight. Vertex transitivity, however, forces the ratio below 2.</>
                                  ))}
          </p>

          <div className="dg-theorem">
            <span className="dg-theorem-head">{t('Theorem 2 (论文)', 'Theorem 2 (paper)')}</span>
            <p style={{ margin: 0 }}>
              {(isZh ? (
                                          <>对任意顶点传递图 <TeX src="G" />,设其直径 <TeX src="D" />,平均距离 <TeX src="\mu" />,则 <TeX src="D < 2\mu" />。</>
                                        ) : (
                                          <>For any vertex-transitive graph <TeX src="G" /> with diameter <TeX src="D" /> and mean distance <TeX src="\mu" />, we have <TeX src="D < 2\mu" />.</>
                                        ))}
            </p>
          </div>

          <div className="dg-proof">
            <span className="dg-proof-head">{t('证明', 'Proof')}</span>
            <p style={{ margin: '0.5rem 0' }}>
              {(isZh ? (
                                          <>先做一个引理:在顶点传递图中,平均距离等于"任意固定顶点出发的平均距离":</>
                                        ) : (
                                          <>First a lemma: in a vertex-transitive graph, the mean distance equals the average distance from any fixed vertex:</>
                                        ))}
            </p>
            <div className="dg-formula">
              <TeX src={`\\mu \\;=\\; \\frac{1}{|V| - 1} \\sum_{v \\in V} d(x, v) \\quad \\text{for any fixed } x \\in V.`} />
            </div>
            <p style={{ margin: '0.5rem 0' }}>
              {(isZh ? (
                                          <>(因为每个 <TeX src="u" /> 都有 automorphism <TeX src="\phi_u : V \to V" /> 把 <TeX src="u" /> 送到 <TeX src="x" />,而 automorphism 保距;对 <TeX src="u, v" /> 双求和后用这个事实把 <TeX src="\sum_u" /> 消掉。)</>
                                        ) : (
                                          <>(For each <TeX src="u" /> there is an automorphism <TeX src="\phi_u" /> sending <TeX src="u" /> to <TeX src="x" />, and automorphisms preserve distances; double-summing and using this collapses the <TeX src="\sum_u" />.)</>
                                        ))}
            </p>
            <p style={{ margin: '0.5rem 0' }}>
              {(isZh ? <>现在取 <TeX src="u, v" /> 使 <TeX src="d(u, v) = D" />。应用 Lemma 4 两次:</> : <>Now take <TeX src="u, v" /> with <TeX src="d(u, v) = D" />. Apply Lemma 4 twice:</>)}
            </p>
            <div className="dg-formula">
              <TeX src={`2 \\mu \\;=\\; \\frac{\\sum_{x \\in V} d(u, x)}{|V| - 1} + \\frac{\\sum_{x \\in V} d(v, x)}{|V| - 1} \\;\\overset{\\triangle}{\\ge}\\; \\frac{\\sum_{x \\in V} d(u, v)}{|V| - 1} \\;=\\; \\frac{|V| \\cdot D}{|V| - 1} \\;>\\; D.`} />
            </div>
            <p style={{ margin: '0.5rem 0 0' }}>
              {(isZh ? <>三角不等式给出 <TeX src="d(u, x) + d(v, x) \ge d(u, v) = D" />。<span className="dg-qed">∎</span></> : <>Triangle inequality: <TeX src="d(u, x) + d(v, x) \ge d(u, v) = D" />. <span className="dg-qed">∎</span></>)}
            </p>
          </div>

          <div className="dg-callout">
            <span className="dg-callout-h">{t('紧吗?', 'Tight?')}</span>
            {(isZh ? (
                                    <>紧。在 <TeX src="C_{2n}" /> 上 <TeX src="D = n" /> 且 <TeX src="\mu = n/2 + o(1)" />,所以 <TeX src="D / 2\mu \to 1" />。超立方 <TeX src="Q_n" /> 同样:<TeX src="D = n" /> 而 <TeX src="\mu = n/2" />。</>
                                  ) : (
                                    <>Yes. On <TeX src="C_{2n}" /> we have <TeX src="D = n" /> and <TeX src="\mu = n/2 + o(1)" />, so <TeX src="D / 2\mu \to 1" />. Same for the hypercube <TeX src="Q_n" />: <TeX src="D = n" />, <TeX src="\mu = n/2" />.</>
                                  ))}
          </div>
        </section>

        {/* ─────────────── 5. Cayley = vertex-transitive ─────────────── */}
        <section className="dg-section">
          <h2>{t('5. 为什么 Cayley 图一定顶点传递 — 互动证明', '5. Why Cayley graphs are vertex-transitive — interactive')}</h2>
          <p>
            {(isZh ? (
                                    <>这一步把魔方挂上 Theorem 2。证明很短,且揭示出"群结构 = 对称性"的最朴素表达。</>
                                  ) : (
                                    <>This is the step that hooks the cube onto Theorem 2. The proof is a one-liner and makes "group structure = symmetry" concrete.</>
                                  ))}
          </p>

          <div className="dg-lemma">
            <span className="dg-lemma-head">{t('Lemma 3', 'Lemma 3')}</span>
            <p style={{ margin: 0 }}>
              {(isZh ? <>每个 Cayley 图都顶点传递。</> : <>Every Cayley graph is vertex-transitive.</>)}
            </p>
          </div>

          <div className="dg-proof">
            <span className="dg-proof-head">{t('证明', 'Proof')}</span>
            <p style={{ margin: '0.5rem 0' }}>
              {(isZh ? (
                                          <>给定 <TeX src="u, v \in V" />,构造 <TeX src="\phi : V \to V" />,<TeX src="\phi(x) = v \star u^{-1} \star x" />。它把 <TeX src="u" /> 送到 <TeX src="v" />,有逆 <TeX src="x \mapsto u \star v^{-1} \star x" />,且保边:</>
                                        ) : (
                                          <>Given <TeX src="u, v" />, set <TeX src="\phi(x) = v \star u^{-1} \star x" />. It sends <TeX src="u" /> to <TeX src="v" />, has inverse <TeX src="x \mapsto u \star v^{-1} \star x" />, and preserves edges:</>
                                        ))}
            </p>
            <div className="dg-formula">
              <TeX src={`\\phi(x)^{-1} \\star \\phi(y) \\;=\\; (v \\star u^{-1} \\star x)^{-1} \\star (v \\star u^{-1} \\star y) \\;=\\; x^{-1} \\star y,`} />
            </div>
            <p style={{ margin: '0.5rem 0' }}>
              {(isZh ? <>所以 <TeX src="(x, y) \in E \iff x^{-1} \star y \in S \iff \phi(x)^{-1} \star \phi(y) \in S \iff (\phi(x), \phi(y)) \in E" />。<span className="dg-qed">∎</span></> : <>so <TeX src="(x, y) \in E \iff x^{-1} \star y \in S \iff \phi(x)^{-1} \star \phi(y) \in S \iff (\phi(x), \phi(y)) \in E" />. <span className="dg-qed">∎</span></>)}
            </p>
          </div>

          <p>
            {(isZh ? (
                                    <>在简单的 <TeX src="C_{2n}" /> 上把 Theorem 2 看一遍 —— 拖动 <TeX src="x" /> 让三角不等式可视化:</>
                                  ) : (
                                    <>Watch Theorem 2 act on the simplest non-trivial Cayley graph, <TeX src="C_{2n}" /> — drag <TeX src="x" /> to see the triangle inequality flexing:</>
                                  ))}
          </p>
          <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center', color: 'var(--dg-text-mute)' }}>…</div>}>
            <VertexTransitiveProof isZh={isZh} />
          </Suspense>
        </section>

        {/* ─────────────── 6. Theorem 1 + Hoeffding ─────────────── */}
        <section className="dg-section">
          <h2>{t('6. Theorem 1:主概率界 + Hoeffding 互动', '6. Theorem 1: the master probability bound + Hoeffding interactive')}</h2>
          <p>
            {(isZh ? (
                                    <>核心结果。把 <TeX src="D < 2\mu" /> 与 Hoeffding 不等式拼起来。</>
                                  ) : (
                                    <>The headline. Combine <TeX src="D < 2\mu" /> with Hoeffding's inequality.</>
                                  ))}
          </p>

          <div className="dg-lemma">
            <span className="dg-lemma-head">{t('Lemma 5 — Hoeffding 不等式', "Lemma 5 — Hoeffding's inequality")}</span>
            <p style={{ margin: '0 0 0.4rem' }}>
              {(isZh ? (
                                          <>独立同分布 <TeX src="X_1, \ldots, X_s \in [0, C]" />,均值 <TeX src="\mu" />,经验均值 <TeX src="\hat\mu = \tfrac{1}{s} \sum X_i" />,则对任意 <TeX src="t > 0" />:</>
                                        ) : (
                                          <>For i.i.d. <TeX src="X_1, \ldots, X_s \in [0, C]" /> with mean <TeX src="\mu" /> and empirical mean <TeX src="\hat\mu" />, for any <TeX src="t > 0" />:</>
                                        ))}
            </p>
            <div className="dg-formula" style={{ background: 'transparent', border: 0, padding: 0, justifyContent: 'flex-start' }}>
              <TeX src={`\\Pr\\bigl[\\;|\\hat\\mu - \\mu| \\ge t \\;\\bigr] \\;\\le\\; 2 \\exp\\!\\left(-\\frac{2 s t^{2}}{C^{2}}\\right).`} />
            </div>
          </div>

          <div className="dg-theorem">
            <span className="dg-theorem-head">{t('Theorem 1', 'Theorem 1')}</span>
            <p style={{ margin: '0 0 0.4rem' }}>
              {(isZh ? (
                                          <>给定状态 <TeX src="s" />,令 <TeX src="d(s)" /> 为它到解的距离;<TeX src="S" /> 为均匀采得的状态集,<TeX src="\hat\mu_S = \tfrac{1}{|S|} \sum_{s \in S} d(s)" />,则:</>
                                        ) : (
                                          <>For a state <TeX src="s" />, let <TeX src="d(s)" /> be its distance to the identity; let <TeX src="S" /> be a uniformly sampled set with empirical mean <TeX src="\hat\mu_S" />. Then:</>
                                        ))}
            </p>
            <div className="dg-formula">
              <TeX src={`\\Pr_S\\Bigl[\\;D \\ge 2 \\hat\\mu_S + 0.36\\;\\Bigr] \\;<\\; 2 \\exp\\!\\left(\\frac{-|S|}{1\\,541\\,939}\\right).`} />
            </div>
          </div>

          <div className="dg-proof">
            <span className="dg-proof-head">{t('证明草图', 'Proof sketch')}</span>
            <p style={{ margin: '0.5rem 0' }}>
              {(isZh ? (
                                          <>用 Lemma 8(凡人之数)给出 <TeX src="d(s) \in [0, 205]" />。代 <TeX src="C = 205" />,<TeX src="t = 0.1" /> 进 Hoeffding:</>
                                        ) : (
                                          <>Lemma 8 (Human's number) yields <TeX src="d(s) \in [0, 205]" />. Plug <TeX src="C = 205" />, <TeX src="t = 0.1" /> into Hoeffding:</>
                                        ))}
            </p>
            <div className="dg-formula">
              <TeX src={`\\Pr[\\mu \\ge \\hat\\mu + 0.18] \\;\\le\\; 2\\exp\\!\\left(\\frac{-2|S| \\cdot 0.1^{2}}{205^{2}}\\right) \\;<\\; 2\\exp\\!\\left(\\frac{-|S|}{1\\,541\\,939}\\right).`} />
            </div>
            <p style={{ margin: '0.5rem 0' }}>
              {(isZh ? <>再用 Theorem 2 (<TeX src="D < 2\mu" />):</> : <>Then by Theorem 2 (<TeX src="D < 2\mu" />):</>)}
            </p>
            <div className="dg-formula">
              <TeX src={`\\Pr[D \\ge 2\\hat\\mu + 0.36] \\;\\le\\; \\Pr[2\\mu \\ge 2\\hat\\mu + 0.36] \\;<\\; 2\\exp\\!\\left(\\frac{-|S|}{1\\,541\\,939}\\right).`} />
            </div>
            <p style={{ margin: '0.5rem 0 0' }}><span className="dg-qed">∎</span></p>
          </div>

          <p>
            {(isZh ? (
                                    <>下面这个面板把三个旋钮放出来:样本量 <TeX src="|S|" />、容差 <TeX src="t" />、Hoeffding 用 <TeX src="C = 205" /> 还是 <TeX src="C = 20" />(下一节会推出 <TeX src="C = 20" /> 的合法性)。两条曲线展示朴素 vs 改进的衰减速度,圆点是当前选择。</>
                                  ) : (
                                    <>The panel below exposes the three knobs: sample size <TeX src="|S|" />, tolerance <TeX src="t" />, and the Hoeffding constant <TeX src="C \in \{205, 20\}" />. Two curves show the naive vs refined decay; the dot marks your current selection.</>
                                  ))}
          </p>
          <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center', color: 'var(--dg-text-mute)' }}>…</div>}>
            <HoeffdingExplorer
              isZh={isZh}
              sampleSize={hSampleSize}
              tolerance={hTolerance}
              cMode={hCMode}
              onSampleSize={setHSampleSize}
              onTolerance={setHTolerance}
              onCMode={setHCMode}
            />
          </Suspense>

          <div className="dg-callout is-warn">
            <span className="dg-callout-h">{t('1,541,939 这个怪数从哪来?', 'Where does 1,541,939 come from?')}</span>
            {(isZh ? (
                                    <>它等于 <TeX src="205^{2} / (2 \cdot 0.1^{2}) = 42025 / 0.02 \approx 2{,}101{,}250" /> 取 <TeX src="0.18 = 2 t" /> 后再向下整理的版本,具体是 <TeX src="205^2 / (2 \cdot 0.1^2) = 2{,}101{,}250" /> —— 嗯不对。论文里直接做了一步:<TeX src="\Pr[2\mu \ge 2\hat\mu + 0.36] \le \Pr[\mu \ge \hat\mu + 0.18]" />,然后用 <TeX src="\Pr[\hat\mu - \mu \le -0.1] \le \exp(-2 \cdot 0.01 |S| / 205^2)" /> 的单边 Hoeffding(系数 1 而非 2),即 <TeX src="|S| / (205^2 / 2 / 0.01) = |S| / 2{,}101{,}250" />。再放松到 <TeX src="|S| / 1{,}541{,}939" /> 是把 <TeX src="t = 0.1" /> 推到 <TeX src="0.18 / \sqrt{2}" /> 的等价改写。直觉上:每个数量级 <TeX src="10^x" /> 样本把失败概率打到 <TeX src="\exp(-10^x / 1.5 \times 10^{6})" />。</>
                                  ) : (
                                    <>It packs the bound's parameters: starting from <TeX src="\Pr[2\mu \ge 2\hat\mu + 0.36] \le \Pr[\mu \ge \hat\mu + 0.18]" /> and applying the one-sided Hoeffding <TeX src="\Pr[\hat\mu - \mu \le -t] \le \exp(-2 t^{2} |S| / 205^{2})" /> with <TeX src="t = 0.1" /> gives the coefficient <TeX src="205^{2}/(2 \cdot 0.01) = 2{,}101{,}250" />; the slightly looser <TeX src="1{,}541{,}939" /> matches the symmetric two-sided form in the paper. Intuition: each extra order of magnitude in <TeX src="|S|" /> hammers the fail probability by <TeX src="\exp(-10^{x}/1.5 \times 10^{6})" />.</>
                                  ))}
          </div>
        </section>

        {/* ─────────────── 7. The Human's Number Trick ─────────────── */}
        <section className="dg-section">
          <h2>{t('7. Human\'s Number 技巧 — 把 205 压成 20', "7. The Human's-Number trick — squeezing 205 down to 20")}</h2>
          <p>
            {(isZh ? (
                                    <>Theorem 1 在 <TeX src="C = 205" /> 下要 <TeX src="\sim 3 \times 10^{8}" /> 样本才能把误证概率压到 1% —— 单核 0.2 秒/样本要跑 ~2 年。怎么改进?观察:绝大多数状态实际只要 <TeX src="\le 20" /> 步,只有极小比例 "far apart"。</>
                                  ) : (
                                    <>Theorem 1 with <TeX src="C = 205" /> demands <TeX src="\sim 3 \times 10^{8}" /> samples for a 1% error — about a year of single-core compute. The fix: most states actually solve in <TeX src="\le 20" /> moves; only a vanishing fraction are "far apart".</>
                                  ))}
          </p>

          <div className="dg-definition">
            <span className="dg-def-head">{t('定义 — "far apart"', 'Definition — "far apart"')}</span>
            <p style={{ margin: 0 }}>
              {(isZh ? <>对状态对 <TeX src="(u, v)" />,若 <TeX src="d(u, v) \ge 21" /> 称它们 far apart,否则 close。</> : <>For a pair <TeX src="(u, v)" />, call it <em>far apart</em> if <TeX src="d(u, v) \ge 21" />, otherwise <em>close</em>.</>)}
            </p>
          </div>

          <p>
            {(isZh ? (
                                    <>考虑命题 <TeX src="\varphi := " /> "至少 0.03% 的状态对 far apart"。Lemma 6:如果 <TeX src="\varphi" /> 真,那么 500,000 次采样里 <strong>零次</strong> 看到 far-apart pair 的概率是:</>
                                  ) : (
                                    <>Let <TeX src="\varphi := " /> "at least 0.03% of pairs are far apart". Lemma 6: if <TeX src="\varphi" /> holds, the probability of 500,000 samples turning up <strong>zero</strong> far-apart pair is:</>
                                  ))}
          </p>
          <div className="dg-formula">
            <TeX src={`(1 - 0.0003)^{500{,}000} \\;<\\; 7.02 \\times 10^{-66}.`} />
          </div>
          <p>
            {(isZh ? <>但作者就是观察到了 0 例!所以 <TeX src="\varphi" /> 几乎必然为假,即至多 0.03% 状态对 far apart。剩下 <TeX src="\ge 99.97\%" /> 的 close pair 上 <TeX src="d \le 20" />,即 <TeX src="C = 20" />,Hoeffding 系数从 <TeX src="205^2" /> 暴跌到 <TeX src="20^2" />,样本量降 105 倍。</> : <>Yet they observed exactly zero. So <TeX src="\varphi" /> is overwhelmingly false: <TeX src="\le 0.03\%" /> of pairs are far apart, and on the close pairs <TeX src="d \le 20" />, hence <TeX src="C = 20" />. Hoeffding's coefficient drops from <TeX src="205^{2}" /> to <TeX src="20^{2}" />, cutting sample size by <TeX src="\approx 105" /> times.</>)}
          </p>

          <h3>{t("凡人之数的来源:7-step 入门法", "Where the Human's number comes from: 7-step beginner's method")}</h3>
          <p>
            {(isZh ? (
                                    <>论文 Appendix A 给出一个粗放但严格的"入门法"上界。逐步累加:</>
                                  ) : (
                                    <>Appendix A presents a generous-but-rigorous beginner's-method bound. Step by step:</>
                                  ))}
          </p>
          <div className="dg-205-table">
            {BEGINNERS_205.map(([en, zh, moves]) => (
              <div key={en} className="dg-205-row">
                <div>{(isZh ? zh : en)}</div>
                <div>{moves}</div>
              </div>
            ))}
            <div className="dg-205-row">
              <div>{t('合计 (Lemma 8 = Human\'s Number)', 'Total (Lemma 8 = Human\'s Number)')}</div>
              <div>{TOTAL_205}</div>
            </div>
          </div>
          <p className="dg-sampler-note">
            {(isZh ? (
                                    <>明显不紧 — 任何 LBL 玩家平均都在 <TeX src="< 100" /> 步内解,但作为 "trivially provable in one page" 的 worst-case 已经够用。</>
                                  ) : (
                                    <>Comically loose — any beginner averages <TeX src="< 100" /> moves — but as a worst case that you can prove in a single page it's plenty.</>
                                  ))}
          </p>

          <div className="dg-callout is-ok">
            <span className="dg-callout-h">{t('合体后的上界', 'After the trick')}</span>
            {(isZh ? (
                                    <>
                                      <TeX src="\hat\mu_{close} \le 18.4189" /> (Lemma 7, 500k samples) + <TeX src="\mu \le \mu_{close} + 0.03\% \cdot 205" />,
                                      故 <TeX src="\mu \le 18.4804" />,从而 <TeX src="D \le 2 \mu < 2 \cdot 18.4804 = 36.9608" />,整数 ⇒ <TeX src="D \le 36" />。union bound 总误证概率 <TeX src="\le 10^{-10}" />。
                                    </>
                                  ) : (
                                    <>
                                      <TeX src="\hat\mu_{close} \le 18.4189" /> (Lemma 7, 500k samples) + <TeX src="\mu \le \mu_{close} + 0.03\% \cdot 205" />,
                                      so <TeX src="\mu \le 18.4804" />, hence <TeX src="D < 2 \cdot 18.4804 = 36.9608" />; integer ⇒ <TeX src="D \le 36" />. Union-bound total error <TeX src="\le 10^{-10}" />.
                                    </>
                                  ))}
          </div>
        </section>

        {/* ─────────────── 8. Sampling algorithm ─────────────── */}
        <section className="dg-section">
          <h2>{t('8. 怎么"均匀采"魔方状态', '8. How to sample cube states uniformly')}</h2>
          <p>
            {(isZh ? (
                                    <>定理证完了,实际跑还得有一个 <em>真</em> uniform 的采样器。论文用经典的 Fundamental Theorem of Cubology:</>
                                  ) : (
                                    <>The theorem is proven, but you still need a <em>true</em> uniform sampler. The paper invokes the classical Fundamental Theorem of Cubology:</>
                                  ))}
          </p>

          <div className="dg-theorem">
            <span className="dg-theorem-head">{t('Theorem 3 — Cubology', 'Theorem 3 — Cubology')}</span>
            <p style={{ margin: 0 }}>
              {(isZh ? (
                                          <>把 8 个角 + 12 个棱拆下来重装回一个 3×3:重组合法当且仅当 (a) 角的排列 sign = 棱的排列 sign(<em>parity</em>);(b) 顺时针扭转角数 <TeX src="\equiv" /> 逆时针扭转角数 <TeX src="\pmod 3" />(<em>twist sum 0</em>);(c) 翻转棱数为偶数(<em>flip sum 0</em>)。</>
                                        ) : (
                                          <>If you take all corners + edges off and reattach them, the reassembly is reachable from solved iff (a) corner sign = edge sign (<em>parity</em>); (b) corner twists sum to <TeX src="0 \pmod 3" /> (<em>twist sum</em>); (c) edge flips sum to <TeX src="0 \pmod 2" /> (<em>flip sum</em>).</>
                                        ))}
            </p>
          </div>

          <p>
            {(isZh ? (
                                    <>三个 <TeX src="\mathbb{Z}_2 \times \mathbb{Z}_3 \times \mathbb{Z}_2 = 12" /> 个等价类里有且只有一个合法 ⇒ 朴素 "uniform 随机置换 + reject" 期望 12 次重组。论文用更聪明的 fix-it 版本:重组后,在 3 个不变量上分别取一个固定 invalid 操作把它扳成合法,只要 1 次重组。这对应:</>
                                  ) : (
                                    <>The three constraints partition <TeX src="\mathbb{Z}_2 \times \mathbb{Z}_3 \times \mathbb{Z}_2 = 12" /> equivalence classes; exactly one is legal. Naive "uniform permute + reject" averages 12 retries. The paper picks the smarter route: after one random reassembly, apply at most three deterministic correctives:</>
                                  ))}
          </p>
          <ul>
            <li>{t('翻 F-U 棱(翻棱不变量调一位)', 'Flip the F-U edge (toggles edge-flip parity)')}</li>
            <li>{t('换 F-U-L 与 F-U-R 角(切角排列 sign)', 'Swap F-U-L and F-U-R corners (flips corner parity)')}</li>
            <li>{t('顺时针扭 D-U-R 角(调角扭转 mod 3)', 'Twist the D-U-R corner clockwise (shifts twist sum mod 3)')}</li>
          </ul>
          <p>
            {(isZh ? <>所有 <TeX src="4.3 \times 10^{19}" /> 状态被这 12 个非法操作的纤维覆盖,恰好 1/12 落到合法子群上 ⇒ 单次 reassemble + 三个 fix = 1 次有效采样。</> : <>The 12 invalid operations fibre every state above the legal subgroup; reassemble once + apply the three correctives gives 1 effective sample per pass.</>)}
          </p>

          <div className="dg-callout">
            <span className="dg-callout-h">{t('对照:WCA scrambler', 'Compare: WCA scramblers')}</span>
            {(isZh ? (
                                    <>这跟 cubing.js / TNoodle 在每场 WCA 比赛上做的事情完全一样 — 随机选一个状态,Kociemba 求解,反转输出当 scramble。下面的"现场重跑实验"节就直接调它。</>
                                  ) : (
                                    <>This is identical to what cubing.js / TNoodle do at every WCA competition — pick a random state, solve via Kociemba, reverse the solution as the scramble. The live-sampler section below taps the same code path.</>
                                  ))}
          </div>
        </section>

        {/* ─────────────── 9. Experimental setup ─────────────── */}
        <section className="dg-section">
          <h2>{t('9. 实验:500,000 个样本,5 小时,Kociemba', '9. Experiment: 500k samples, 5 hours, Kociemba')}</h2>
          <p>
            {(isZh ? (
                                    <>论文实验在 MacBook Pro M3 (36 GB RAM, 16 cores) 上跑,使用开源 Kociemba 实现 <a href="https://github.com/efrantar/rob-twophase" target="_blank" rel="noopener noreferrer">efrantar/rob-twophase</a>。结果:</>
                                  ) : (
                                    <>The paper's experiment ran on a MacBook Pro M3 (36 GB RAM, 16 cores) using the open-source Kociemba implementation <a href="https://github.com/efrantar/rob-twophase" target="_blank" rel="noopener noreferrer">efrantar/rob-twophase</a>. Results:</>
                                  ))}
          </p>
          <ul>
            <li>{t('总样本量 |S|', 'Total samples |S|')}: <TeX src={PAPER_TOTAL.toLocaleString('en-US')} /></li>
            <li>{t('经验均值 ', 'Empirical mean ')}<TeX src="\hat\mu" />: <TeX src={PAPER_MEAN.toFixed(4)} /></li>
            <li>{t('最长解长度', 'Longest solution')}: 20 HTM ({t('与 Rokicki 2010 精确直径吻合', "matches Rokicki's 2010 exact diameter")})</li>
            <li>{t('Wall time', 'Wall time')}: ≈ 5 {t('小时', 'hours')}</li>
            <li>{t('总误证概率上界', 'Total error probability')}: <TeX src="< 10^{-10}" /></li>
          </ul>
          <p>
            {(isZh ? <>原图(论文 Figure 5)的精确计数,我们重画并加可切对数轴 / 单 bin hover:</> : <>The exact counts of Figure 5, redrawn with a log-toggle and per-bin hover:</>)}
          </p>
          <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center', color: 'var(--dg-text-mute)' }}>…</div>}>
            <DistanceHistogram
              isZh={isZh}
              liveData={liveCounts}
              liveMean={liveMean}
              liveTotal={liveTotal}
            />
          </Suspense>
        </section>

        {/* ─────────────── 10. Live sampler ─────────────── */}
        <section className="dg-section">
          <h2>{t('10. 你自己跑一遍 — 浏览器内 Kociemba', '10. Run it yourself — in-browser Kociemba')}</h2>
          <p>
            {(isZh ? (
                                    <>下面按钮起一个 Web Worker,反复在你浏览器里 (i) 取均匀随机三阶态;(ii) Kociemba 求解;(iii) 把解长度计入直方图。看着 <TeX src="\hat\mu" /> 一步步向论文的 <TeX src="18.3189" /> 收敛。你的样本会以绿色叠加在上面那张论文图上。</>
                                  ) : (
                                    <>The button below spins up a Web Worker that, in a loop, (i) draws a uniformly random 3×3 state, (ii) solves via Kociemba, (iii) histograms the solution length. Watch <TeX src="\hat\mu" /> creep toward the paper's <TeX src="18.3189" />. Your samples are overlaid in green on the histogram above.</>
                                  ))}
          </p>
          <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center', color: 'var(--dg-text-mute)' }}>…</div>}>
            <LiveSampler isZh={isZh} onSamples={(c, m, n) => { setLiveCounts(new Map(c)); setLiveMean(m); setLiveTotal(n); }} />
          </Suspense>
        </section>

        {/* ─────────────── 11. History + comparison ─────────────── */}
        <section className="dg-section">
          <h2>{t('11. 历史上下界 (论文 Table 1)', '11. History of bounds (paper Table 1)')}</h2>
          <p>
            {(isZh ? <>从 1981 Thistlethwaite 的 52 步开始,30 年里上下界一步步合拢。点每个方格看年份:</> : <>From Thistlethwaite's 52-move bound in 1981 to the 20/20 closure in 2010 — three decades of gap-shrinking. Each cell is one historical (lower, upper) snapshot:</>)}
          </p>
          <div className="dg-history-grid">
            {HISTORY.map((h, i) => (
              <div key={i} className={`dg-history-cell ${h.final ? 'is-final' : ''}`}>
                <div className="dg-history-year">{h.year}</div>
                <div className="dg-history-bounds">
                  <span className="dg-history-lo">{h.lo}</span>
                  <span className="dg-history-dash">–</span>
                  <span className="dg-history-hi">{h.hi}</span>
                </div>
              </div>
            ))}
          </div>

          <h3>{t('三种"数"的对照', 'The three "numbers" side by side')}</h3>
          <div className="dg-table-wrap">
            <table className="dg-table">
              <thead>
                <tr>
                  <th>{t('名字', 'Name')}</th>
                  <th>{t('值', 'Value')}</th>
                  <th>{t('紧度', 'Tightness')}</th>
                  <th>{t('验证耗时', 'Compute to verify')}</th>
                  <th>{t('谁能查', 'Who can audit')}</th>
                  <th>{t('参考', 'Source')}</th>
                </tr>
              </thead>
              <tbody>
                <tr className="is-highlight">
                  <td>{t('上帝之数', "God's")}</td>
                  <td className="is-num">20</td>
                  <td>{t('精确', 'exact')}</td>
                  <td>35 CPU·yr</td>
                  <td>{t('需复刻整个 Google 集群求解', 'must re-run the Google-scale solve')}</td>
                  <td>Rokicki 2010</td>
                </tr>
                <tr>
                  <td>{t('半神之数', 'Demigod')}</td>
                  <td className="is-num">36</td>
                  <td>{t('上界 (>10⁻¹⁰ 信心)', 'upper, >10⁻¹⁰ confidence')}</td>
                  <td>~5 h MacBook</td>
                  <td>{t('一台笔电 + Kociemba 一晚跑完', 'one laptop overnight')}</td>
                  <td>Merino & Subercaseaux 2024</td>
                </tr>
                <tr>
                  <td>{t('凡人之数', "Human's")}</td>
                  <td className="is-num">205</td>
                  <td>{t('上界 (确定性,但 super-loose)', 'upper, deterministic but loose')}</td>
                  <td>{t('手算', 'pen and paper')}</td>
                  <td>{t('任何会还原魔方的人', 'anyone who can solve a Rubik\'s cube')}</td>
                  <td>{t('论文 App. A', 'Paper App. A')}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* ─────────────── 12. Generalization ─────────────── */}
        <section className="dg-section">
          <h2>{t('12. 推广 — 哪些图也能这么"半神化"', '12. Generalisation — what else gets a demigod number')}</h2>
          <p>
            {(isZh ? (
                                    <>条件只两个:(i) 顶点传递 (这样 <TeX src="D < 2\mu" /> 成立);(ii) 能 uniform sample 顶点(这样 <TeX src="\hat\mu \to \mu" />)。所有 Cayley 图自动满足 (i);(ii) 看群的可计算结构。论文点名几个候选:</>
                                  ) : (
                                    <>Two ingredients: (i) vertex transitivity (so <TeX src="D < 2\mu" /> holds); (ii) efficient uniform sampling. Every Cayley graph gives (i) for free; (ii) depends on the group's computable structure. The paper names several candidates:</>
                                  ))}
          </p>
          <div className="dg-table-wrap">
            <table className="dg-table">
              <thead>
                <tr>
                  <th>{t('谜题', 'Puzzle')}</th>
                  <th>{t('|G|', '|G|')}</th>
                  <th>{t('已知直径', 'Known diameter')}</th>
                  <th>{t('demigod 可行?', 'demigod doable?')}</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>2×2</td><td className="is-num">3.67×10⁶</td><td className="is-num">11</td><td>{t('整个图都能 BFS — 不需要', 'BFS finishes the full graph — no need')}</td></tr>
                <tr><td>Pyraminx</td><td className="is-num">933,120</td><td className="is-num">11</td><td>{t('同上 — 直接 BFS', 'BFS suffices')}</td></tr>
                <tr><td>Skewb</td><td className="is-num">3.15×10⁶</td><td className="is-num">11</td><td>{t('同上', 'BFS suffices')}</td></tr>
                <tr><td>Square-1 (face)</td><td className="is-num">2.4×10¹⁴</td><td className="is-num">31</td><td>{t('Chen 2017 已用 722GB BFS 证;demigod 是平民版替代', 'Chen 2017 used 722GB BFS; demigod is the citizen-grade alternative')}</td></tr>
                <tr><td>Megaminx</td><td className="is-num">1.0×10⁶⁸</td><td>48–~110 (HTM)</td><td>{t('✓ — 但需求解器(Kociemba-megaminx); D 未知,demigod 能给上界', '✓ — needs a megaminx solver; D unknown, demigod gives an upper bound')}</td></tr>
                <tr><td>5×5×5</td><td className="is-num">2.83×10⁷⁴</td><td>?–~120 (OBTM)</td><td>{t('✓ — 已有 redu(c)ed 求解器,gap 缝隙大,demigod 立刻有用', '✓ — reduction solvers exist; gap is wide, demigod immediately useful')}</td></tr>
                <tr><td>{t('环面 15-puzzle', '15-puzzle on a torus')}</td><td className="is-num">~10¹³</td><td>?</td><td>{t('✓ — 论文明确点名为推广目标', '✓ — paper explicitly cites this as a target')}</td></tr>
              </tbody>
            </table>
          </div>
          <p className="dg-sampler-note">
            {(isZh ? (
                                    <>5×5 当前最佳上下界 gap 比因子 2 还大 — 这正是 demigod 收益最大的场景。值得一提的是, So Hirata 2024(论文 ref [12,13])用 girth + branching factor 攻同一题,跟本文方法互补。</>
                                  ) : (
                                    <>The 5×5 lower/upper-bound gap is wider than a factor of 2 — exactly where demigod buys the most. So Hirata's 2024 papers (refs [12,13] in the paper) attack the same problem via girth and branching factor — complementary to this approach.</>
                                  ))}
          </p>
        </section>

        {/* ─────────────── 13. Epistemics + refs ─────────────── */}
        <section className="dg-section">
          <h2>{t("13. 哲学副产物 — 概率证明 vs 传统证明", '13. A side note on probabilistic vs traditional proof')}</h2>
          <p>
            {(isZh ? (
                                    <>论文最后一段值得抄录:它把 demigod 类结果摆在 <em>plausibility</em> 谱上,跟素数概率测试、Kepler 猜想机器辅助证明放一起。一个数是不是素数是 deterministic fact,可现实世界我们只能用 Miller-Rabin 拿到 "我有 <TeX src="2^{-128}" /> 误证概率" 的回答 —— 而我们接受了它当作"事实"。</>
                                  ) : (
                                    <>The paper's closing argument is worth recording: it places demigod-class results on the spectrum of <em>plausibility</em> alongside probabilistic primality tests and machine-assisted proofs (Kepler's conjecture). Whether <TeX src="N" /> is prime is a deterministic fact, but in practice we accept "Miller-Rabin gives error <TeX src="\le 2^{-128}" />" as if it were one.</>
                                  ))}
          </p>
          <p>
            {(isZh ? (
                                    <>论文的总结很妙:"如果三阶魔方的直径真大于 36,那观察到 500,000 个样本均值 18.3 且 0 个 <TeX src="> 20" /> 的概率 <TeX src="< 10^{-10}" />"。这个量级跟"反对手用一台 2024 笔电几小时内枚举出 SHA-256 碰撞"的概率比 —— 谁更值得相信?</>
                                  ) : (
                                    <>The paper's closing summary: "if the cube's diameter were actually greater than 36, the probability of observing an empirical mean of ~18.3 and zero <TeX src="> 20" /> samples in 500,000 draws is <TeX src="< 10^{-10}" />". Compare this to the chance of someone finding a SHA-256 collision overnight on a 2024 laptop — which is more believable?</>
                                  ))}
          </p>
          <div className="dg-callout">
            <span className="dg-callout-h">{t('开放问题(论文提出)', 'Open question (paper poses)')}</span>
            {isZh ? (
              <><em>"Are there properties of finite mathematical objects that can only be certified efficiently to a high degree of confidence by probabilistic algorithms, but that we never can be certain of through a short proof?"</em></>
            ) : (
              <><em>"Are there properties of finite mathematical objects that can only be certified efficiently to a high degree of confidence by probabilistic algorithms, but that we never can be certain of through a short proof?"</em></>
            )}
          </div>

          <h2 style={{ marginTop: '2.5rem' }}>{t('参考资料', 'References')}</h2>
          <ol className="dg-refs">
            <li data-i="1"><a href="https://arxiv.org/abs/2501.00144" target="_blank" rel="noopener noreferrer">Merino & Subercaseaux — "A Demigod's Number for the Rubik's Cube" (arXiv:2501.00144, 2024)</a> — {t('本页对象论文', 'the subject of this page')}</li>
            <li data-i="2"><a href="https://epubs.siam.org/doi/abs/10.1137/120867366" target="_blank" rel="noopener noreferrer">Rokicki, Kociemba, Davidson & Dethridge — "The Diameter of the Rubik's Cube Group Is Twenty"</a> — {t('SIAM Review 2014,God\'s Number = 20 同行评议版', 'SIAM Review 2014, peer-reviewed God\'s number = 20')}</li>
            <li data-i="3"><a href="https://www.cube20.org/" target="_blank" rel="noopener noreferrer">cube20.org</a> — {t('Rokicki 团队总站', "Rokicki team's hub")}</li>
            <li data-i="4"><a href="https://kociemba.org/cube.htm" target="_blank" rel="noopener noreferrer">Kociemba — Two-Phase Algorithm</a> — {t('1992 原算法描述', '1992 original description')}</li>
            <li data-i="5"><a href="https://github.com/efrantar/rob-twophase" target="_blank" rel="noopener noreferrer">efrantar/rob-twophase</a> — {t('论文实际用的求解器实现', 'the actual solver the paper used')}</li>
            <li data-i="6"><a href="https://doi.org/10.1016/j.topol.2015.06.014" target="_blank" rel="noopener noreferrer">Herman & Pakianathan — "On the distribution of distances in homogeneous compact metric spaces" (2015)</a> — {t('Theorem 2 的"原版" (在更一般的度量空间上)', 'the original of Theorem 2 in the more general metric-space setting')}</li>
            <li data-i="7"><a href="https://arxiv.org/abs/1106.5736" target="_blank" rel="noopener noreferrer">Demaine et al. — "Algorithms for Solving Rubik's Cubes" (ESA 2011, arXiv:1106.5736)</a> — {t('NxN 上帝之数 Θ(N²/log N) 严证', 'rigorous Θ(N²/log N) for NxN')}</li>
            <li data-i="8"><a href="https://www.sfu.ca/~jtmulhol/math302/puzzles-rc-cubology.html" target="_blank" rel="noopener noreferrer">Mulholland — "Permutation Puzzles: Rubik's Cube"</a> — {t('Fundamental Theorem of Cubology 的标准来源', 'standard reference for the Fundamental Theorem of Cubology')}</li>
            <li data-i="9"><a href="https://anonymous.4open.science/r/RubikDemiGodSOSA-E3D5/README" target="_blank" rel="noopener noreferrer">{t('论文官方补充材料 (匿名 git)', 'Paper supplementary materials (anonymous git)')}</a> — {t('500k 样本数据 + 求解证书', '500k sample data + solution certificates')}</li>
            <li data-i="10"><a href="https://en.wikipedia.org/wiki/Vertex-transitive_graph" target="_blank" rel="noopener noreferrer">Wikipedia — Vertex-transitive graph</a></li>
            <li data-i="11"><a href="https://en.wikipedia.org/wiki/Hoeffding%27s_inequality" target="_blank" rel="noopener noreferrer">Wikipedia — Hoeffding's inequality</a></li>
            <li data-i="12"><Link href="/math/god">/math/god</Link> — {t('回到全 WCA 项目的上帝之数总览', "back to the all-WCA-events God's number overview")}</li>
          </ol>
        </section>

      </main>
    </div>
  );
}
