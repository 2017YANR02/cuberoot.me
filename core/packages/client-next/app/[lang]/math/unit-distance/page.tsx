/**
 * /math/unit-distance — visual companion to OpenAI 2026:
 *   "Planar Point Sets with Many Unit Distances"
 *   (disproof of Erdős's 1946 planar unit-distance conjecture).
 *
 * Structure:
 *   1.  Hero + three-number strip (1946 / 1984 / 2026)
 *   2.  TL;DR
 *   3.  The problem — interactive sandbox
 *   4.  Erdős 1946 grid — rescaled-unit visualiser
 *   5.  Known bounds — log-log α-chart with timeline
 *   6.  Theorem 1.1 — formal statement
 *   7.  Classical ℤ[i] vs new L(i) side-by-side
 *   8.  The construction — 5-stage flow
 *   9.  Lattice → polydisc → projection schematic
 *  10.  Statement on AI use + references
 */
'use client';

import { Suspense } from 'react';
import Link from '@/components/AppLink';
import dynamic from 'next/dynamic';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ExternalLink, FileText, Sparkles } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { TeX, TeXBlock } from '@/components/math/Tex';
import './unit_distance.css';
import i18n from '@/i18n/i18n-client';
import { useT } from "@/hooks/useT";

const UnitDistanceSandbox = dynamic(() => import('./_components/UnitDistanceSandbox'), { ssr: false });
const GridConstruction = dynamic(() => import('./_components/GridConstruction'), { ssr: false });
const BoundsChart = dynamic(() => import('./_components/BoundsChart'), { ssr: false });
const ConstructionFlow = dynamic(() => import('./_components/ConstructionFlow'), { ssr: false });
const LatticeProjection = dynamic(() => import('./_components/LatticeProjection'), { ssr: false });
const ErdosGridHero = dynamic(() => import('./_components/ErdosGridHero'), { ssr: false });

const TIMELINE: ReadonlyArray<{ year: string; lo: string; hi: string; cite: string; zh: string; en: string; final?: boolean
 }> = [
  { year: '1946', lo: 'n·c√(log n / log log n)', hi: 'O(n^3/2)', cite: 'Erdős', zh: 'Erdős 提出问题 + 提出猜想 ν(n) ≤ n^(1+C/log log n);K₂,₃-free 给上界 O(n^3/2)', en: 'Erdős states the problem + conjecture ν(n) ≤ n^(1+C/log log n); K₂,₃-free gives upper O(n^3/2)'
},
  { year: '1984', lo: 'n·c√(log n / log log n)', hi: 'O(n^4/3)', cite: 'SST', zh: 'Spencer–Szemerédi–Trotter 把上界压到 O(n^4/3),用 incidence bound', en: 'Spencer–Szemerédi–Trotter improve upper to O(n^4/3) via incidence bound'
},
  { year: '1997', lo: '同上', hi: 'O(n^4/3)', cite: 'Sze', zh: 'Székely 用 crossing number 给出 O(n^4/3) 的 1-页证明', en: 'Székely\'s 1-page crossing-number proof of O(n^4/3)'
},
  { year: '2011', lo: '同上', hi: 'O(n log n)', cite: 'Mat', zh: 'Matoušek 证明大多数范数下 ν 几乎线性 — 暗示 Euclidean 也"应该"如此', en: 'Matoušek: for most norms ν is near-linear — suggesting Euclidean "should" be too'
},
  { year: '2022', lo: '同上', hi: 'O(n^4/3) (constant ↓)', cite: 'ÁP', zh: 'Ágoston & Pálvölgyi 改进 n^4/3 的常数(40 年来唯一进展)', en: 'Ágoston & Pálvölgyi sharpen the constant in n^4/3 (only progress in 40 yrs)'
},
  { year: '2025', lo: '同上', hi: 'O(n log² n) generic', cite: 'ABS / GST', zh: 'Alon–Bucić–Sauermann + Greilhuber–Schildkraut–Tidor:对几乎所有 d 维范数,ν ≤ (d/2 ± o(1)) n log² n', en: 'Alon–Bucić–Sauermann + Greilhuber–Schildkraut–Tidor: ν ≤ (d/2 ± o(1)) n log² n for nearly all d-dim norms'
},
  { year: '2026-05', lo: 'n^(1+δ), δ>0', hi: 'O(n^4/3)', cite: 'OpenAI', zh: 'OpenAI (Chen + 内部模型,Sellke/Sawhney 验证):反例!ν(n) ≥ n^(1+δ) 对无穷多 n — Erdős 猜想 80 年后被否定 (δ 不显式)', en: 'OpenAI (Chen + internal model, Sellke/Sawhney verifying): counterexample! ν(n) ≥ n^(1+δ) for infinitely many n — Erdős\'s 80-yr conjecture falls (δ implicit)'
},
  { year: '2026-05', lo: 'n^(1+6·10⁻³⁸)', hi: 'O(n^4/3)', cite: 'Remarks', zh: 'Remarks (9 人联名,arXiv:2605.20695):人类消化版,显式算出 δ ≈ 6 × 10⁻³⁸,简化为 pro-2 塔 + 单一分裂素数', en: 'Remarks (9-author note, arXiv:2605.20695): human-digested, δ ≈ 6 × 10⁻³⁸ explicit; simplified to pro-2 tower + single split prime'
},
  { year: '2026-05', lo: 'n^1.014114', hi: 'O(n^4/3)', cite: 'Sawin', zh: 'Sawin 单作 (arXiv:2605.20579):大幅改进,δ ≥ 0.014,离 SST 上界只差约 24 倍', en: 'Sawin solo (arXiv:2605.20579): drastic improvement, δ ≥ 0.014, within factor 24 of SST upper', final: true
},
];

export default function UnitDistancePage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const t = useT();
  useDocumentTitle('单位距离问题', 'Unit Distance Problem');

  return (
    <div className="unit-distance-page">
      <header className="ud-header">
        <Link href="/math" className="ud-back">
          <ArrowLeft size={16} />
          <span>{t('返回 数学', 'Back to Math')}</span>
        </Link>
      </header>

      <main className="ud-main">

        {/* ─────────────── 1. HERO ─────────────── */}
        <section className="ud-hero">
          <div className="ud-eyebrow">
            {t('数学 · 离散几何 · 数论', 'Mathematics · Discrete Geometry · Number Theory')}
          </div>
          <h1 className="ud-title">
            {t('平面单位距离问题', 'Planar Unit Distance Problem')}
            <span className="ud-title-sub">
              {t('Erdős 1946 猜想 — 80 年后被 AI 自主推翻', "Erdős's 1946 conjecture — autonomously disproved by AI, 80 years later")}
            </span>
          </h1>
          <div className="ud-paper-meta">
            <span>OpenAI</span>
            <a href="https://openai.com/index/model-disproves-discrete-geometry-conjecture/" target="_blank" rel="noopener noreferrer">
              <ExternalLink size={13} /> {t('博客', 'Blog')}
            </a>
            <a href="https://cdn.openai.com/pdf/74c24085-19b0-4534-9c90-465b8e29ad73/unit-distance-proof.pdf" target="_blank" rel="noopener noreferrer">
              <FileText size={13} /> PDF
            </a>
            <span>{t('2026-05-20 发布', 'released 2026-05-20')}</span>
          </div>
          <p className="ud-lead">
            {(isZh ? (
                                    <>
                                      给平面上 <TeX src="n" /> 个点,最多能有多少对距离恰好等于 <TeX src="1" />?
                                      这是 Erdős 1946 提出的"单位距离问题" — 离散几何最著名的开放问题之一。
                                      他猜上界是 <TeX src="\nu(n) \le n^{1 + C / \log \log n}" />:一个比任何多项式都慢的次线性增长。
                                      40 年来上界停在 Spencer–Szemerédi–Trotter 的 <TeX src="O(n^{4/3})" />,80 年来下界停在他自己的网格构造。
                                      2026 年,OpenAI 用一个内部模型<em>完全自动地</em>给出了反例:
                                      存在常数 <TeX src="\delta > 0" /> 使得 <TeX src="\nu(n) \ge n^{1 + \delta}" /> 对无穷多 <TeX src="n" /> 成立 — <strong>猜想错了</strong>。
                                      <br /><br />
                                      本页用 5 个交互组件拆解这件事:从最基础的问题陈述,到论文的核心数论构造(Golod–Shafarevich 塔 + CM 域 + Minkowski 嵌入)。
                                    </>
                                  ) : (
                                    <>
                                      Given <TeX src="n" /> points in the plane, how many pairs can be at distance exactly <TeX src="1" />?
                                      That's Erdős's 1946 unit-distance problem — one of the most famous open questions in discrete geometry.
                                      He conjectured <TeX src="\nu(n) \le n^{1 + C / \log \log n}" />, a subpolynomial growth.
                                      For 40 years the best upper bound was Spencer–Szemerédi–Trotter's <TeX src="O(n^{4/3})" />; for 80 years the best lower bound was Erdős's own grid construction.
                                      In 2026, OpenAI's internal model, working <em>fully autonomously</em>, found a counterexample:
                                      there is a constant <TeX src="\delta > 0" /> such that <TeX src="\nu(n) \ge n^{1 + \delta}" /> holds for infinitely many <TeX src="n" /> — <strong>the conjecture is false</strong>.
                                      <br /><br />
                                      This page walks through it with 5 interactive components: from the bare problem statement to the heart of the construction (a Golod–Shafarevich tower, CM fields, Minkowski embedding).
                                    </>
                                  ))}
          </p>

          <div className="ud-numbers">
            <div className="ud-num-card is-erdos">
              <div className="ud-num-tag">{t('1946 — Erdős 猜想', '1946 — Erdős conjecture')}</div>
              <div className="ud-num-big">n<sup>1+C/log log n</sup></div>
              <div className="ud-num-sub">{t('上界 — 现在被推翻', 'upper bound — now disproved')}</div>
              <div className="ud-num-cite">Am. Math. Monthly 53</div>
            </div>
            <div className="ud-num-card is-sst">
              <div className="ud-num-tag">{t('1984 — SST 上界', '1984 — SST upper')}</div>
              <div className="ud-num-big">O(n<sup>4/3</sup>)</div>
              <div className="ud-num-sub">{t('40 年来稳坐最佳上界', 'best upper bound for 40 years')}</div>
              <div className="ud-num-cite">Graph Theory & Comb.</div>
            </div>
            <div className="ud-num-card is-new">
              <div className="ud-num-tag">{t('2026 — 新下界', '2026 — new lower')}</div>
              <div className="ud-num-big">n<sup>1+δ</sup></div>
              <div className="ud-num-sub">{t('反例 — Erdős 猜想被否定', 'counterexample — Erdős conjecture refuted')}</div>
              <div className="ud-num-cite">OpenAI 2026</div>
            </div>
          </div>

          <div className="ud-callout is-ai">
            <span className="ud-callout-h">
              <Sparkles size={14} /> {t('AI 元注释', 'AI meta-note')}
            </span>
            {(isZh ? (
                                    <>
                                      论文专设 "Statement on AI Use" 一节:问题陈述由 AI 撰写,内部模型自主求解,初次正确性由 AI 评分流水线打分,只有在评分确信无误<em>之后</em>,人类研究者才介入审阅。后续由数论专家进一步验证、简化、加强论证;论文是这条 AI-原始解的"人类编辑版"。
                                    </>
                                  ) : (
                                    <>
                                      The paper has a "Statement on AI Use" section. The problem statement was AI-authored, the internal model solved it fully autonomously, an AI grading pipeline scored the first solution as correct, and only <em>then</em> were human researchers brought in. Number-theory experts later verified, simplified, and strengthened the argument; the manuscript is a human-edited exposition of the AI-original output.
                                    </>
                                  ))}
          </div>
        </section>

        {/* ─────────────── 2. TL;DR ─────────────── */}
        <section className="ud-section">
          <h2>TL;DR</h2>
          <ul>
            <li>
              {(isZh ? (
                                          <><strong>什么:</strong>设 <TeX src="\nu(n)" /> 是平面 n 点集中单位距离对子数的最大值。Erdős 1946 猜想 <TeX src="\nu(n) \le n^{1 + C / \log \log n}" />。</>
                                        ) : (
                                          <><strong>What:</strong> let <TeX src="\nu(n)" /> = max number of unit-distance pairs among n planar points. Erdős 1946 conjectured <TeX src="\nu(n) \le n^{1 + C / \log \log n}" />.</>
                                        ))}
            </li>
            <li>
              {(isZh ? (
                                          <><strong>反例:</strong>存在常数 <TeX src="\delta > 0" />,使得 <TeX src="\nu(n) \ge n^{1+\delta}" /> 对无穷多 n 成立。</>
                                        ) : (
                                          <><strong>Counter:</strong> there is <TeX src="\delta > 0" /> such that <TeX src="\nu(n) \ge n^{1+\delta}" /> for infinitely many n.</>
                                        ))}
            </li>
            <li>
              {(isZh ? (
                                          <><strong>怎么做:</strong>把 Erdős 经典的 ℤ[i] 网格构造提升到高维。用一个全实数域 L 的无穷无支 pro-3 塔(度数 → ∞,根判别式保持有界),取 K = L(i) 这种 CM 域;Chebotarev 选定的素数在每层完全分裂,产生指数多 |σ(u)| = 1 的元素 u,Minkowski 嵌入到 ℂ^f 中再投影到第一坐标,得到 ℝ² 中的点集。</>
                                        ) : (
                                          <><strong>How:</strong> lift Erdős's classical ℤ[i] grid trick to high dimensions. Use an infinite unramified pro-3 tower over a totally-real field L (degrees → ∞, root discriminant bounded), take the CM field K = L(i); Chebotarev gives primes that split completely in every layer, producing exponentially many u with |σ(u)| = 1. Minkowski-embed into ℂ^f and project to the first coordinate to get an ℝ² point set.</>
                                        ))}
            </li>
            <li>
              {(isZh ? (
                                          <><strong>关键技术:</strong>Golod–Shafarevich 不等式保证 pro-3 塔无穷;Frattini 子群论证使添加分裂条件时不降低生成元秩;CM 域 + Minkowski 把"代数 norm-1"翻译成"几何 |σ(u)| = 1"。</>
                                        ) : (
                                          <><strong>Key tools:</strong> Golod–Shafarevich keeps the pro-3 tower infinite; a Frattini-subgroup argument adds splitting conditions without dropping the generator rank; CM + Minkowski translates "algebraic norm 1" to "geometric |σ(u)| = 1".</>
                                        ))}
            </li>
            <li>
              {(isZh ? (
                                          <><strong>AI 元亮点:</strong>问题由 AI 撰写,内部模型完全自主求解,AI 评分流水线打分后才进入人类审阅。原始模型输出与论文一同公开。</>
                                        ) : (
                                          <><strong>AI angle:</strong> AI wrote the problem, the internal model solved it autonomously, an AI grading pipeline scored it, <em>then</em> humans reviewed. The raw model output is published alongside the paper.</>
                                        ))}
            </li>
          </ul>
        </section>

        {/* ─────────────── 3. The problem ─────────────── */}
        <section className="ud-section">
          <h2>{t('3. 问题 — 拖一拖你就懂', '3. The problem — drag the points')}</h2>
          <p>
            {(isZh ? (
                                    <>给定平面上 n 个不同的点 <TeX src="P \subset \mathbb{R}^2" />,定义</>
                                  ) : (
                                    <>Given n distinct points <TeX src="P \subset \mathbb{R}^2" /> in the plane, define</>
                                  ))}
          </p>
          <div className="ud-formula">
            <TeXBlock src={`\\nu(P) \\;=\\; \\#\\{\\{x, y\\} \\subset P : |x - y| = 1\\},\\qquad \\nu(n) \\;=\\; \\max_{|P| = n} \\nu(P).`} />
          </div>
          <p>
            {(isZh ? (
                                    <>下面拖点试试。等边三角形给最高 ν/n(每个三角形边都是单位距离);切到方格立刻能看出 <em>水平 + 垂直</em> 两族,但少了对角线那一族。</>
                                  ) : (
                                    <>Drag any point below. Equilateral triangles maximise local ν/n (every triangle edge is a unit distance); switching to the square lattice loses the diagonal family entirely.</>
                                  ))}
          </p>
          <Suspense fallback={<div className="ud-loading">Loading…</div>}>
            <UnitDistanceSandbox />
          </Suspense>
        </section>

        {/* ─────────────── 3.5 Upper bounds — K_{2,3} + SST ─────────────── */}
        <section className="ud-section">
          <h2>{t('3.5 上界为什么是 n^(4/3) — 两圆只交两点', '3.5 The upper bound — two circles meet in ≤ 2 points')}</h2>
          <p>
            {(isZh ? (
                                    <>先看反方向:为啥 ν(n) <em>不可能</em>太大?最朴素的观察:单位距离图不含 <TeX src="K_{2,3}" />。如果点 x、y 都跟 z₁、z₂、z₃ 三个点距离 1,那么 z₁、z₂、z₃ 同时在以 x 为心半径 1 的圆上 <em>和</em> 以 y 为心半径 1 的圆上。<strong>两个不同的圆最多交两点</strong>,所以这种 z 最多 2 个,不可能有 3 个。结论:单位距离图是 K₂,₃-free。</>
                                  ) : (
                                    <>The other direction: why <em>can't</em> ν(n) be too large? Simplest fact: the unit-distance graph contains no <TeX src="K_{2,3}" />. If points x, y are both at distance 1 from z₁, z₂, z₃, then z₁, z₂, z₃ lie on the unit circle around x <em>and</em> on the unit circle around y. <strong>Two distinct circles meet in at most 2 points</strong>, so at most 2 such z's exist — not 3. Hence the unit-distance graph is K₂,₃-free.</>
                                  ))}
          </p>

          <div className="ud-twocircles-fig">
            <svg viewBox="0 0 360 220" className="ud-twocircles-svg" aria-hidden>
              {/* x and y unit circles intersecting in two points */}
              <circle cx={130} cy={110} r={80} fill="none"
                stroke="var(--ud-edge)" strokeWidth="1.8" strokeOpacity="0.7" />
              <circle cx={230} cy={110} r={80} fill="none"
                stroke="var(--ud-edge)" strokeWidth="1.8" strokeOpacity="0.7" />
              {/* centers x, y */}
              <circle cx={130} cy={110} r={5} fill="var(--ud-pt)" />
              <circle cx={230} cy={110} r={5} fill="var(--ud-pt)" />
              <text x={120} y={106} fontSize="14" fill="var(--ud-text)"
                fontFamily="var(--ud-mono)" fontWeight="700">x</text>
              <text x={236} y={106} fontSize="14" fill="var(--ud-text)"
                fontFamily="var(--ud-mono)" fontWeight="700">y</text>
              {/* the 2 intersection points (z₁, z₂) */}
              {/* For unit circles distance 100 apart with r=80 (scaled), intersection at midpoint x and y = 110 ± sqrt(80²−50²) = ± 62.45 */}
              <circle cx={180} cy={48} r={5} fill="var(--ud-new)" stroke="var(--background)" strokeWidth="1.6" />
              <circle cx={180} cy={172} r={5} fill="var(--ud-new)" stroke="var(--background)" strokeWidth="1.6" />
              <text x={190} y={44} fontSize="13" fill="var(--ud-new)" fontFamily="var(--ud-mono)" fontWeight="700">z₁</text>
              <text x={190} y={186} fontSize="13" fill="var(--ud-new)" fontFamily="var(--ud-mono)" fontWeight="700">z₂</text>
              {/* dashed lines |x-z| = |y-z| = 1 */}
              <line x1={130} y1={110} x2={180} y2={48} stroke="var(--ud-text-mute)" strokeWidth="1" strokeDasharray="3 3" />
              <line x1={230} y1={110} x2={180} y2={48} stroke="var(--ud-text-mute)" strokeWidth="1" strokeDasharray="3 3" />
              <line x1={130} y1={110} x2={180} y2={172} stroke="var(--ud-text-mute)" strokeWidth="1" strokeDasharray="3 3" />
              <line x1={230} y1={110} x2={180} y2={172} stroke="var(--ud-text-mute)" strokeWidth="1" strokeDasharray="3 3" />
              <text x={180} y={210} textAnchor="middle"
                fontSize="11.5" fill="var(--ud-text-sub)">
                {t('两圆 ≤ 2 交点 ⇒ 无 K₂,₃', 'two circles meet in ≤ 2 points ⇒ no K₂,₃')}
              </text>
            </svg>
          </div>

          <p>
            {(isZh ? (
                                    <>由 <strong>Kővári–Sós–Turán 定理</strong>(1954),任何 K₂,₃-free 图边数 ≤ <TeX src="\tfrac{1}{2}(1 + \sqrt{4n-3})n^{1/2} \cdot n = O(n^{3/2})" />。Erdős 1946 原文给出的就是这条 <TeX src="O(n^{3/2})" /> 上界。</>
                                  ) : (
                                    <>By <strong>Kővári–Sós–Turán</strong> (1954), any K₂,₃-free graph has ≤ <TeX src="\tfrac{1}{2}(1 + \sqrt{4n-3})n^{1/2} \cdot n = O(n^{3/2})" /> edges. Erdős's 1946 paper used exactly this to bound ν.</>
                                  ))}
          </p>
          <p>
            {(isZh ? (
                                    <>1984 年 Spencer–Szemerédi–Trotter 用<strong>点-曲线 incidence 定理</strong>(同年自己证的)把它压到 <TeX src="O(n^{4/3})" />。1997 年 Székely 给出<strong>用 crossing number 的一页证明</strong>:把单位距离图画在平面上,每对单位距离对应一段单位圆弧;Crossing Lemma <TeX src="\mathrm{cr}(G) \ge c \cdot e^3 / n^2" /> 直接推出 <TeX src="e = O(n^{4/3})" />。这是 40 年来最佳上界,只有常数被微调过(2022 Ágoston–Pálvölgyi)。</>
                                  ) : (
                                    <>In 1984 Spencer–Szemerédi–Trotter sharpened this to <TeX src="O(n^{4/3})" /> via their point-curve incidence theorem (proved that same year). In 1997 Székely gave a <strong>one-page crossing-number proof</strong>: draw the unit-distance graph in the plane, every unit distance is an arc on some unit circle; the Crossing Lemma <TeX src="\mathrm{cr}(G) \ge c \cdot e^3 / n^2" /> directly forces <TeX src="e = O(n^{4/3})" />. This is the best upper bound to date — only the constant has been improved (Ágoston–Pálvölgyi 2022).</>
                                  ))}
          </p>
        </section>

        {/* ─────────────── 4. Erdős's grid ─────────────── */}
        <section className="ud-section">
          <h2>{t('4. Erdős 1946 的小聪明 — 重定义"单位"', '4. Erdős\'s 1946 trick — redefine "unit"')}</h2>

          <Suspense fallback={<div className="ud-loading">Loading…</div>}>
            <ErdosGridHero />
          </Suspense>
          <p className="ud-figure-caption">
            {(isZh
                                    ? <>↑ 全分辨率精确复刻 — 与 OpenAI 博客头图同构造。每条线都是 <em>恰好</em> √k 长。切换 k 看 r₂(k) 怎么决定密度。</>
                                    : <>↑ Full-resolution exact reproduction — same construction as OpenAI's hero figure. Every segment is <em>exactly</em> √k long. Switch k to feel how r₂(k) drives density.</>)
            }
          </p>

          <p>
            {(isZh ? (
                                    <>取 √n × √n 整数网格,直接用单位 1 给出的对子数只有 <TeX src="2s(s-1) \approx 2n" />,这是平凡的线性下界。
                                      Erdős 的关键观察:把"单位距离"<em>重定义</em>成 <TeX src="\sqrt{k}" />,其中 k 可以是任何整数。这时,两点 (x₁, y₁) (x₂, y₂) 之间是"单位距离" ⟺ <TeX src="(x_1 - x_2)^2 + (y_1 - y_2)^2 = k" /> ⟺ k 是两个整数的平方和。</>
                                  ) : (
                                    <>Take the √n × √n integer grid. With "unit = 1", there are only <TeX src="2s(s-1) \approx 2n" /> unit-distance pairs — a trivial linear bound.
                                      Erdős's key observation: <em>redefine</em> "unit distance" to be <TeX src="\sqrt{k}" /> for any integer k. Now two points (x₁, y₁), (x₂, y₂) are at unit distance ⟺ <TeX src="(x_1 - x_2)^2 + (y_1 - y_2)^2 = k" /> ⟺ k is a sum of two squares.</>
                                  ))}
          </p>
          <p>
            {(isZh ? (
                                    <>设 <TeX src="r_2(k)" /> 是 k 写成两整数平方和的方式数。 r₂(1) = 4 ((±1, 0), (0, ±1));但 r₂(5) = 8 ((±1, ±2), (±2, ±1))。在 s×s 网格里,squared-distance = k 的对子数 ≈ <TeX src="\frac{1}{2} \sum_{(a,b): a^2+b^2=k} (s - |a|)(s - |b|)" />,正比于 r₂(k)。</>
                                  ) : (
                                    <>Let <TeX src="r_2(k)" /> count the ways to write k as a sum of two squares. r₂(1) = 4 ((±1, 0), (0, ±1)); r₂(5) = 8 ((±1, ±2), (±2, ±1)). In the s×s grid, the count of pairs at squared distance k is ≈ <TeX src="\frac{1}{2} \sum_{(a,b): a^2+b^2=k} (s - |a|)(s - |b|)" />, proportional to r₂(k).</>
                                  ))}
          </p>
          <p>
            {(isZh ? (
              <>挑使 r₂(k) 最大的 k ≤ n,Erdős 得到</>
            ) : (
              <>Choosing k ≤ n with maximum r₂(k), Erdős got</>
            ))}
          </p>
          <div className="ud-formula">
            <TeXBlock src={`\\nu(n) \\;\\ge\\; n \\cdot n^{c / \\log \\log n} \\;=\\; n^{1 + c / \\log \\log n}.`} />
          </div>
          <p>
            {(isZh ? (
                                    <>正是猜想的形式!Erdős 猜的上界与他自己的下界<em>形式</em>一样,差的是常数 c → C。他相信这就是真实增长。下面拖滑块改 k 和 s 看看 r₂(k) 怎么影响 ν 的:</>
                                  ) : (
                                    <>The same form as his conjectured upper! He believed his own lower bound was tight up to constants. Below, slide k and s to see how r₂(k) drives ν:</>
                                  ))}
          </p>
          <Suspense fallback={<div className="ud-loading">Loading…</div>}>
            <GridConstruction />
          </Suspense>
        </section>

        {/* ─────────────── 4.5 Why everyone believed Erdős ─────────────── */}
        <section className="ud-section">
          <h2>{t('4.5 为什么 Erdős(和所有人)都信这个猜想', '4.5 Why Erdős (and everyone else) believed the conjecture')}</h2>
          <p>
            {(isZh ? (
                                    <>Erdős 网格构造给的指数 1 + c/log log n 趋近 1,看起来"接近线性";自己的上界 O(n^(3/2)) 后来被 SST 压到 O(n^(4/3)),离 n^(1+o(1)) 还有距离。从 80 年代起一系列结果都<em>支持</em> n^(1+o(1)) 这边。</>
                                  ) : (
                                    <>Erdős's grid gave 1 + c/log log n, which approaches 1 ("almost linear"); his upper bound O(n^(3/2)) was improved by SST to O(n^(4/3)), still leaving room for n^(1+o(1)). Decades of subsequent work all <em>pointed toward</em> n^(1+o(1)).</>
                                  ))}
          </p>

          <div className="ud-evidence-cards">
            <div className="ud-evidence-card">
              <div className="ud-evidence-year">2011</div>
              <div className="ud-evidence-author">Matoušek</div>
              <p>
                {(isZh
                                                ? <>对 ℝ² 上 <em>大多数</em>(Baire-generic)范数,ν ≤ <TeX src="O(n \log n \log\log n)" /> — <strong>几乎线性</strong>。</>
                                                : <>For <em>most</em> (Baire-generic) norms on ℝ², ν ≤ <TeX src="O(n \log n \log\log n)" /> — <strong>near-linear</strong>.</>)}
              </p>
            </div>
            <div className="ud-evidence-card">
              <div className="ud-evidence-year">2025</div>
              <div className="ud-evidence-author">Alon–Bucić–Sauermann</div>
              <p>
                {(isZh
                                                ? <>对 ℝ^d 中 <em>同源</em>(comeagre)范数集,ν ≤ <TeX src="\tfrac{d}{2} n \log^2 n" /> — 任意维度都几乎线性。</>
                                                : <>For <em>comeagre</em> norms on ℝ^d, ν ≤ <TeX src="\tfrac{d}{2} n \log^2 n" /> — near-linear in all dims.</>)}
              </p>
            </div>
            <div className="ud-evidence-card">
              <div className="ud-evidence-year">2025</div>
              <div className="ud-evidence-author">Greilhuber–Schildkraut–Tidor</div>
              <p>
                {(isZh
                                                ? <>对<em>所有</em>范数 (不只 comeagre),匹配下界 <TeX src="(d/2 - o(1)) n \log^2 n" />。证据更强了。</>
                                                : <>For <em>all</em> norms (not just comeagre), matching lower bound <TeX src="(d/2 - o(1)) n \log^2 n" />. Even stronger evidence.</>)}
              </p>
            </div>
          </div>

          <div className="ud-callout">
            <span className="ud-callout-h">{t('为什么 Euclidean 跳出了"通用"', 'Why Euclidean breaks the pattern')}</span>
            {(isZh ? (
                                    <>
                                      所有"通用范数"几乎线性的结果,都依赖范数 ball 没有特殊算术结构。但 Euclidean 单位圆 <TeX src="x^2 + y^2 = 1" /> 有<em>极特殊</em>的算术结构:Gauss 整数 ℤ[i] 上"<TeX src="\mathrm{norm} = 1" />"对应 <TeX src="zz̄ = 1" />,这是数论的入口。
                                      提升到 CM 域 K = L(i) 后,<em>所有</em> 复嵌入下 |σ(u)| = 1 的元素都来自相同代数机制 — Erdős 猜想<em>不</em>错在直觉上"应该几乎线性",而错在他没把<strong>Euclidean 本身就是反例</strong>看作可能。AI 注意到的正是这个。
                                    </>
                                  ) : (
                                    <>
                                      All "generic-norm near-linear" results depend on the unit ball lacking arithmetic structure. But the Euclidean circle <TeX src="x^2 + y^2 = 1" /> has an <em>extremely</em> special arithmetic structure: in Gauss integers ℤ[i], "norm = 1" is <TeX src="zz̄ = 1" />, the entry point of number theory.
                                      Lifted to CM fields K = L(i), elements with |σ(u)| = 1 in <em>every</em> complex embedding come from the same algebraic machinery. Erdős wasn't wrong because the intuition "should be near-linear" was bad — he was wrong because he never considered that <strong>Euclidean is itself the counterexample</strong>. That's what the AI noticed.
                                    </>
                                  ))}
          </div>

          <p>
            {(isZh ? (
                                    <>Bloom 在 Remarks §4 直白说:"<em>大部分人在这个问题上花的时间,都在试图证明上界,而不是证伪。</em>" — 80 年的人类研究在错的方向用力。</>
                                  ) : (
                                    <>Bloom in Remarks §4 puts it bluntly: "<em>Most of the human effort has been on trying to prove the upper bound, rather than disprove it.</em>" — 80 years of effort in the wrong direction.</>
                                  ))}
          </p>
        </section>

        {/* ─────────────── 5. Bounds & history ─────────────── */}
        <section className="ud-section">
          <h2>{t('5. 80 年的上下界拉锯', '5. 80 years of bound-tightening')}</h2>

          <div className="ud-timeline">
            {TIMELINE.map((row, i) => (
              <div key={i} className={`ud-timeline-row ${row.final ? 'is-final' : ''}`}>
                <div className="ud-timeline-year">{row.year}</div>
                <div className="ud-timeline-bounds">
                  <span className="ud-timeline-lo">{row.lo}</span>
                  <span className="ud-timeline-le">≤ ν ≤</span>
                  <span className="ud-timeline-hi">{row.hi}</span>
                  <span className="ud-timeline-cite">{row.cite}</span>
                </div>
                <div className="ud-timeline-text">{((i18n.language.startsWith('zh') ? row.zh : row.en))}</div>
              </div>
            ))}
          </div>

          <p>
            {(isZh ? (
                                    <>
                                      这张图把上面所有界画在 <em>指数</em> α = log ν / log n 这个量上。
                                      这是看清"猜想被反驳"的最直接方式:
                                      Erdős 猜想的上界是一条 <em>下降到 1</em> 的曲线 (1 + C/log log n);
                                      新下界是 <em>水平直线</em> (1 + δ);水平线必然穿过下降到 1 的曲线。
                                    </>
                                  ) : (
                                    <>
                                      The chart below plots all bounds on the <em>exponent</em> α = log ν / log n.
                                      This is the cleanest way to see "conjecture refuted":
                                      Erdős's conjectured upper is a curve <em>decaying to 1</em> (1 + C/log log n);
                                      the new lower is a <em>flat line</em> (1 + δ); the flat line must eventually cross the decaying curve.
                                    </>
                                  ))}
          </p>

          <Suspense fallback={<div className="ud-loading">Loading…</div>}>
            <BoundsChart />
          </Suspense>
        </section>

        {/* ─────────────── 5.5 Distinct vs unit distances ─────────────── */}
        <section className="ud-section">
          <h2>{t('5.5 Erdős 1946 同篇里的另一题:不同距离问题', '5.5 The other problem in Erdős 1946: distinct distances')}</h2>
          <p>
            {(isZh ? (
                                    <>Erdős 1946 那篇<em>同时</em>提出两个对偶的离散几何问题。一个是单位距离 ν(n)(本页主题);另一个是 <strong>不同距离 D(n)</strong>:n 个平面点能有<em>最少</em>多少种不同的两两距离?</>
                                  ) : (
                                    <>Erdős's 1946 paper actually posed <em>two</em> dual discrete-geometry problems. One is unit distances ν(n) (this page's topic); the other is <strong>distinct distances D(n)</strong>: the <em>minimum</em> number of distinct pairwise distances among n planar points.</>
                                  ))}
          </p>

          <div className="ud-dual-grid">
            <div className="ud-dual-card">
              <div className="ud-dual-h">{t('单位距离 ν(n)', 'Unit distances ν(n)')}</div>
              <div className="ud-dual-q">{t('一个特定距离最多重复多少次?', 'how often can ONE distance repeat?')}</div>
              <div className="ud-dual-row">
                <span className="ud-compare-k">{t('Erdős 猜想', 'Erdős conjecture')}</span>
                <span className="ud-compare-v"><TeX src="\le n^{1 + o(1)}" /></span>
              </div>
              <div className="ud-dual-row">
                <span className="ud-compare-k">{t('当前最佳上界', 'best upper')}</span>
                <span className="ud-compare-v"><TeX src="O(n^{4/3})" /> (SST 1984)</span>
              </div>
              <div className="ud-dual-row">
                <span className="ud-compare-k">{t('当前最佳下界', 'best lower')}</span>
                <span className="ud-compare-v"><TeX src="n^{1.014}" /> (Sawin 2026)</span>
              </div>
              <div className="ud-dual-row">
                <span className="ud-compare-k">{t('状态', 'status')}</span>
                <span className="ud-compare-v ud-status-open">{t('猜想被推翻,gap 仍大', 'conjecture false, big gap')}</span>
              </div>
            </div>
            <div className="ud-dual-card">
              <div className="ud-dual-h">{t('不同距离 D(n)', 'Distinct distances D(n)')}</div>
              <div className="ud-dual-q">{t('最少能有多少种不同距离?', 'how few DISTINCT distances can occur?')}</div>
              <div className="ud-dual-row">
                <span className="ud-compare-k">{t('Erdős 猜想', 'Erdős conjecture')}</span>
                <span className="ud-compare-v"><TeX src="\ge cn / \sqrt{\log n}" /></span>
              </div>
              <div className="ud-dual-row">
                <span className="ud-compare-k">{t('上界 (例子)', 'upper (example)')}</span>
                <span className="ud-compare-v"><TeX src="O(n / \sqrt{\log n})" /> (网格)</span>
              </div>
              <div className="ud-dual-row">
                <span className="ud-compare-k">{t('Guth–Katz 2015', 'Guth–Katz 2015')}</span>
                <span className="ud-compare-v"><TeX src="\ge c \cdot n / \log n" /></span>
              </div>
              <div className="ud-dual-row">
                <span className="ud-compare-k">{t('状态', 'status')}</span>
                <span className="ud-compare-v ud-status-solved">{t('基本解决,差 √log n', 'essentially solved (√log n gap)')}</span>
              </div>
            </div>
          </div>

          <p>
            {(isZh ? (
                                    <>两个问题<em>对偶</em>:ν 问"重复多少次最大",D 问"不同种类多少最小"。直觉上 ν · D ≥ n²/2 (鸽笼:n² 个对子分配到 D 种距离里,最大那个至少占 n²/(2D))。</>
                                  ) : (
                                    <>The two problems are <em>dual</em>: ν asks "max repetition", D asks "min variety". Intuitively ν · D ≥ n²/2 (pigeonhole: n² pairs across D distances, the most common one occurs ≥ n²/(2D) times).</>
                                  ))}
          </p>
          <p>
            {(isZh ? (
                                    <>历史上 D 比 ν 容易得多:Guth–Katz 2015 用 <strong>多项式方法 + 代数几何</strong>(Dvir 的 finite-field Kakeya 思路升级版),给出 <TeX src="D(n) \ge c \cdot n / \log n" /> — 离 Erdős 猜想 <TeX src="n / \sqrt{\log n}" /> 只差 <TeX src="\sqrt{\log n}" /> 因子。
                                      <strong>ν 反方向</strong>:这次反而是<em>下界</em>被刷新到 n^1.014,但 Erdős 的猜想方向(认为是上界)<em>错了</em>。Litt 在 Remarks §6 评论说:"D 的解决用了 polynomial method 这种<em>新工具</em>;ν 的反驳<em>没</em>引入新几何工具,只是把数论用得更深 — 这两题的难度气质完全不同。"</>
                                  ) : (
                                    <>Historically D was the easier one: Guth–Katz 2015 used <strong>the polynomial method</strong> (an upgrade of Dvir's finite-field Kakeya argument) to prove <TeX src="D(n) \ge c \cdot n / \log n" /> — only a <TeX src="\sqrt{\log n}" /> factor from Erdős's conjecture <TeX src="n / \sqrt{\log n}" />.
                                      <strong>ν went the other way</strong>: now the <em>lower</em> bound is improved to n^1.014, but Erdős's conjectured direction (the upper bound side) was <em>wrong</em>. Litt in Remarks §6: "Solving D required <em>new tools</em> (polynomial method); refuting ν did <em>not</em> introduce new geometric tools, it just pushed number theory deeper — the difficulty profile is completely different."</>
                                  ))}
          </p>
        </section>

        {/* ─────────────── 6. Theorem 1.1 ─────────────── */}
        <section className="ud-section">
          <h2>{t('6. 主定理', '6. Main theorem')}</h2>
          <div className="ud-theorem">
            <span className="ud-theorem-head">Theorem 1.1 (OpenAI 2026)</span>
            <p style={{ margin: '0.6rem 0 0' }}>
              {(isZh ? (
                                          <>存在绝对常数 <TeX src="\delta > 0" />,以及无穷多正整数 n,使得 <TeX src="\nu(n) \ge n^{1 + \delta}" />。</>
                                        ) : (
                                          <>There exists an absolute constant <TeX src="\delta > 0" /> and infinitely many positive integers n such that <TeX src="\nu(n) \ge n^{1 + \delta}" />.</>
                                        ))}
            </p>
          </div>
          <p>
            {(isZh ? (
                                    <>这反驳了 Erdős 1946 的猜想 <TeX src="\nu(n) \le n^{1+C/\log\log n}" />:任何形如 <TeX src="n^{1+\delta}" /> 的下界,只要 δ &gt; 0 是常数,就最终 (即 n 足够大时) 超越 <TeX src="n^{1+C/\log\log n}" />,因为后者的指数 1 + C/log log n 收敛到 1。</>
                                  ) : (
                                    <>This refutes Erdős's 1946 conjecture <TeX src="\nu(n) \le n^{1+C/\log\log n}" />: any constant-δ lower bound of the form <TeX src="n^{1+\delta}" /> eventually (for large enough n) exceeds <TeX src="n^{1+C/\log\log n}" />, because the latter's exponent 1 + C/log log n converges to 1.</>
                                  ))}
          </p>
          <p>
            {(isZh ? (
                                    <>它<em>还</em>反驳了 Erdős–Fishburn 1997 的更强猜想 (任意点都有 ≥ k 等距邻居 ⟹ k ≤ n^o(1)):构造里点集的单位距离图<em>平均度</em>是 n^Ω(1),平均度 ≥ 2k 的图有最小度 ≥ k 的子图。</>
                                  ) : (
                                    <>It <em>also</em> refutes the stronger Erdős–Fishburn 1997 conjecture (every point has ≥ k equidistant neighbours ⟹ k ≤ n^o(1)): the construction's unit-distance graph has average degree n^Ω(1), and average-degree ≥ 2k always contains a subgraph of minimum degree ≥ k.</>
                                  ))}
          </p>
        </section>

        {/* ─────────────── 7. ℤ[i] vs L(i) ─────────────── */}
        <section className="ud-section">
          <h2>{t('7. 经典 ℤ[i] vs 新 L(i)', '7. Classical ℤ[i] vs new L(i)')}</h2>
          <p>
            {(isZh ? (
                                    <>第 4 节那个 r₂(k) 的小聪明,几何上其实是在 Gauss 整数 ℤ[i] 上做"范数为 k"的分解。在 ℤ[i] 里,k = q 是 ≡ 1 mod 4 的素数 ⟹ q = π · π̄,π 是 Gauss 素数。许多这样的 q 乘起来,得到 z ∈ ℤ[i] 满足 z·z̄ = k,几何上 z 就是从原点出发长度为 √k 的格点。</>
                                  ) : (
                                    <>The r₂(k) trick in §4 is, geometrically, a "norm = k" factorisation in the Gaussian integers ℤ[i]. In ℤ[i], if k = q is a prime ≡ 1 mod 4, then q = π · π̄ for a Gaussian prime π. Multiplying many such q's gives many z ∈ ℤ[i] with z·z̄ = k — each z is a lattice point at distance √k from origin.</>
                                  ))}
          </p>
          <p>
            {(isZh ? (
                                    <>新构造做的事:把 ℚ 换成更大的全实场 L,把 ℤ[i] 换成 <TeX src="\mathcal{O}_K" /> (其中 K = L(i))。L 的非平凡自同构 c (限制到 K 上的复共轭) 把"复模 = 1"翻译成"对所有复嵌入 σ 都有 |σ(u)| = 1"。L 的度数 [L:ℚ] → ∞,所以 ℂ^f 是真正的高维空间,可以塞下指数多 norm-1 元素。</>
                                  ) : (
                                    <>The new construction: replace ℚ by a larger totally real field L, and ℤ[i] by <TeX src="\mathcal{O}_K" /> (K = L(i)). The non-trivial automorphism c (becoming complex conjugation under any embedding of K) translates "complex modulus 1" into "|σ(u)| = 1 for every complex embedding σ". Since [L:ℚ] → ∞, ℂ^f is genuinely high-dimensional and fits exponentially many norm-1 elements.</>
                                  ))}
          </p>

          <div className="ud-compare-grid">
            <div className="ud-compare-card is-classic">
              <div className="ud-compare-h">{t('经典 1946', 'Classical 1946')}</div>
              <div className="ud-compare-formula"><TeX src="\mathbb{Z}[i] \subset \mathbb{C} = \mathbb{R}^2" /></div>
              <div className="ud-compare-row">
                <span className="ud-compare-k">{t('维度', 'dim')}</span>
                <span className="ud-compare-v">2 (固定)</span>
              </div>
              <div className="ud-compare-row">
                <span className="ud-compare-k">{t('共轭', 'conjugation')}</span>
                <span className="ud-compare-v">c(a + bi) = a − bi</span>
              </div>
              <div className="ud-compare-row">
                <span className="ud-compare-k">{t('norm-1 元素数', 'norm-1 count')}</span>
                <span className="ud-compare-v"><TeX src="n^{c/\log\log n}" /></span>
              </div>
              <div className="ud-compare-row">
                <span className="ud-compare-k">{t('给出', 'gives')}</span>
                <span className="ud-compare-v"><TeX src="\nu(n) \ge n^{1 + c/\log\log n}" /></span>
              </div>
            </div>
            <div className="ud-compare-arrow">⇒</div>
            <div className="ud-compare-card is-new">
              <div className="ud-compare-h">{t('新 2026', 'New 2026')}</div>
              <div className="ud-compare-formula"><TeX src="\mathcal{O}_K \hookrightarrow \mathbb{C}^f,\ K = L(i),\ [L:\mathbb{Q}] = f \to \infty" /></div>
              <div className="ud-compare-row">
                <span className="ud-compare-k">{t('维度', 'dim')}</span>
                <span className="ud-compare-v">2f → ∞</span>
              </div>
              <div className="ud-compare-row">
                <span className="ud-compare-k">{t('共轭', 'conjugation')}</span>
                <span className="ud-compare-v">c: K → K, σ(c·) = σ(·)̄</span>
              </div>
              <div className="ud-compare-row">
                <span className="ud-compare-k">{t('norm-1 元素数', 'norm-1 count')}</span>
                <span className="ud-compare-v"><TeX src="\ge e^{\gamma f}" /></span>
              </div>
              <div className="ud-compare-row">
                <span className="ud-compare-k">{t('给出', 'gives')}</span>
                <span className="ud-compare-v"><TeX src="\nu(n) \ge n^{1 + \delta}" /></span>
              </div>
            </div>
          </div>
        </section>

        {/* ─────────────── 7.5 Number-field glossary ─────────────── */}
        <section className="ud-section">
          <h2>{t('7.5 数论小词典(看懂下面构造前的 8 个词)', '7.5 Number-field glossary (8 terms to know before §8)')}</h2>
          <p>
            {(isZh
                                    ? <>下面 5 步构造里反复出现这几个词,先各给一句话直觉 + 一行公式。</>
                                    : <>The 5-stage construction below uses these terms repeatedly. One sentence of intuition + one formal line each.</>)}
          </p>

          <div className="ud-glossary">
            <div className="ud-glossary-card">
              <div className="ud-glossary-term">{t('全实域 Totally real', 'Totally real field')}</div>
              <div className="ud-glossary-formula"><TeX src="L \hookrightarrow \mathbb{R}^{[L:\mathbb{Q}]}" /></div>
              <div className="ud-glossary-desc">
                {(isZh
                                                ? <>L 的所有共轭嵌入到 ℂ 后<em>全是实数</em>。例:<TeX src="\mathbb{Q}(\sqrt{2})" />,<TeX src="\mathbb{Q}(\zeta_7 + \zeta_7^{-1})" />。</>
                                                : <>All conjugate embeddings of L land in ℝ. E.g. <TeX src="\mathbb{Q}(\sqrt{2})" />, <TeX src="\mathbb{Q}(\zeta_7 + \zeta_7^{-1})" />.</>)}
              </div>
            </div>

            <div className="ud-glossary-card">
              <div className="ud-glossary-term">{t('CM 域', 'CM field')}</div>
              <div className="ud-glossary-formula"><TeX src="K = L(i),\ L \text{ totally real}" /></div>
              <div className="ud-glossary-desc">
                {(isZh
                                                ? <>全实域上加 i 得到的全虚二次扩张。非平凡自同构 c 在<em>每个</em>复嵌入下都是普通复共轭。<strong>这是 |σ(u)|=1 ⟺ u·c(u)=1 这条关键等价的来源。</strong></>
                                                : <>Totally imaginary quadratic extension of a totally real field. The non-trivial automorphism c becomes ordinary complex conjugation under <em>every</em> complex embedding. <strong>This is what makes |σ(u)|=1 ⟺ u·c(u)=1.</strong></>)}
              </div>
            </div>

            <div className="ud-glossary-card">
              <div className="ud-glossary-term">{t('类数 h(K)', 'Class number h(K)')}</div>
              <div className="ud-glossary-formula"><TeX src="h(K) = \#\mathrm{Cl}(K)" /></div>
              <div className="ud-glossary-desc">
                {(isZh
                                                ? <>分式理想 / 主理想 这个商群的大小。等于 1 时 OK 是 PID。<strong>论证里用作鸽笼分母:2^m 个理想分到 h(K) 个等价类,某类至少 2^m / h(K) 个 — 这就是 norm-1 元素的来源。</strong></>
                                                : <>Size of fractional-ideals / principal-ideals. If 1, OK is a PID. <strong>Used as a pigeonhole denominator: 2^m ideals into h(K) classes ⇒ some class has ≥ 2^m / h(K) — this is where norm-1 elements come from.</strong></>)}
              </div>
            </div>

            <div className="ud-glossary-card">
              <div className="ud-glossary-term">{t('根判别式 rd(K)', 'Root discriminant rd(K)')}</div>
              <div className="ud-glossary-formula"><TeX src="\mathrm{rd}(K) = |D_K|^{1/[K:\mathbb{Q}]}" /></div>
              <div className="ud-glossary-desc">
                {(isZh
                                                ? <>判别式开 n 次根 — 一种"度无关"的复杂度度量。<strong>无支扩张保持根判别式不变</strong>,这就是 Golod–Shafarevich 塔的核心好处:度数→∞ 但 rd 不爆,Minkowski 估计 h(K) ≤ rd(K)^[K:ℚ] 才有用。</>
                                                : <>The n-th root of the discriminant — a "degree-independent" complexity. <strong>Unramified extensions preserve rd</strong>, the entire reason the Golod–Shafarevich tower is useful: degree → ∞ but rd stays bounded, so Minkowski's h(K) ≤ rd(K)^[K:ℚ] remains usable.</>)}
              </div>
            </div>

            <div className="ud-glossary-card">
              <div className="ud-glossary-term">{t('Frobenius 元', 'Frobenius element')}</div>
              <div className="ud-glossary-formula"><TeX src="\mathrm{Frob}_{\mathfrak{p}} \in \mathrm{Gal}(K/F)" /></div>
              <div className="ud-glossary-desc">
                {(isZh
                                                ? <>无支素 p 上的"提升"自同构,作用 <TeX src="x \mapsto x^{N\mathfrak{p}}" /> mod p。<strong>Frob 类平凡 ⟺ p 在扩张中完全分裂。</strong>Chebotarev 让我们能选定 Frob 类。</>
                                                : <>The "lift" automorphism above an unramified prime p, acting as <TeX src="x \mapsto x^{N\mathfrak{p}}" /> mod p. <strong>Frob class trivial ⟺ p splits completely.</strong> Chebotarev lets us prescribe these.</>)}
              </div>
            </div>

            <div className="ud-glossary-card">
              <div className="ud-glossary-term">{t('Frattini 子群 Φ(G)', 'Frattini subgroup Φ(G)')}</div>
              <div className="ud-glossary-formula"><TeX src="\Phi(G) = \bigcap_{M \text{ max}} M" /></div>
              <div className="ud-glossary-desc">
                {(isZh
                                                ? <>所有极大开子群的交。元素属于 Φ(G) ⟺ "不当生成元用也无所谓"。<strong>关键:把 Φ(G) 里的元素当关系加进商群,不会降低生成元秩。</strong>这就是为啥可以杀掉选定 Frobenius 而不破坏 Golod–Shafarevich 估计。</>
                                                : <>Intersection of all maximal open subgroups. An element is in Φ(G) iff "removing it as a generator doesn't matter". <strong>Key: imposing Φ(G)-elements as relations doesn't drop d(G).</strong> That's why we can kill chosen Frobenius elements without breaking the Golod–Shafarevich count.</>)}
              </div>
            </div>

            <div className="ud-glossary-card">
              <div className="ud-glossary-term">{t('pro-p 群', 'pro-p group')}</div>
              <div className="ud-glossary-formula"><TeX src="G = \varprojlim G_n,\ |G_n| = p^{k_n}" /></div>
              <div className="ud-glossary-desc">
                {(isZh
                                                ? <>有限 p-群的逆极限 — 拓扑群,所有有限商都是 p-群。<strong>无支 pro-p 扩张 F^{`{ur,p}`} 的 Gal 群是这种结构</strong>;Golod–Shafarevich 在这上面才生效(r ≤ d²/4 ⇒ 无穷)。</>
                                                : <>Inverse limit of finite p-groups — a topological group with all finite quotients p-groups. <strong>The Galois group of the maximal unramified pro-p extension F^{`{ur,p}`} is one</strong>; Golod–Shafarevich works in this category (r ≤ d²/4 ⇒ infinite).</>)}
              </div>
            </div>

            <div className="ud-glossary-card">
              <div className="ud-glossary-term">{t('无支扩张', 'Unramified extension')}</div>
              <div className="ud-glossary-formula"><TeX src="\mathfrak{p}\mathcal{O}_K = \mathfrak{P}_1 \cdots \mathfrak{P}_g" /></div>
              <div className="ud-glossary-desc">
                {(isZh
                                                ? <>每个素 p 在 K 中分解时,所有素 P_i 的<em>分支指数</em>都是 1(没有重复因子)。结果:rd(K) 保持不变。<strong>OpenAI/Sawin 构造的塔每一层都无支</strong>,这是 rd 不爆的源头。</>
                                                : <>Every prime p factors in K with all ramification indices = 1 (no repeated factors). Consequence: rd(K) stays put. <strong>Every layer of the OpenAI/Sawin tower is unramified</strong>, the reason rd doesn't blow up.</>)}
              </div>
            </div>
          </div>
        </section>

        {/* ─────────────── 8. The construction (flow) ─────────────── */}
        <section className="ud-section">
          <h2>{t('8. 构造分 5 步', '8. The construction in 5 stages')}</h2>
          <p>
            {(isZh ? (
                                    <>每一步点开看公式 + 解释。整体顺序:<em>基场 F → pro-3 塔 → CM 扩张 K = F(i) → Minkowski 格 → 切+投影</em>。前 3 步是<strong>数论部分</strong>(构造好"高维 + 多 norm-1 元素"的代数对象),后 2 步是<strong>几何部分</strong>(把代数对象翻译成 ℝ² 的点集)。</>
                                  ) : (
                                    <>Click any stage to expand. The pipeline: <em>base F → pro-3 tower → CM extension K = F(i) → Minkowski lattice → cut + project</em>. The first three are the <strong>arithmetic part</strong> (build an algebraic object with high dim + many norm-1 elements); the last two are the <strong>geometric part</strong> (translate it into a planar point set).</>
                                  ))}
          </p>
          <Suspense fallback={<div className="ud-loading">Loading…</div>}>
            <ConstructionFlow />
          </Suspense>
        </section>

        {/* ─────────────── 9. Lattice → projection schematic ─────────────── */}
        <section className="ud-section">
          <h2>{t('9. 几何部分:格 → 多圆盘 → 投影', '9. Geometric part: lattice → polydisc → projection')}</h2>
          <p>
            {(isZh ? (
                                    <>这一节是论文 §2 的可视化。论文里 f → ∞,这里我们退到 f = 2 (Gauss 整数 ℤ[i] in ℂ) 来直观地看。改 R 看 |X| 和单位距离对怎么同时指数增长 — 关键比是它们的指数差,正比于 1 + δ。</>
                                  ) : (
                                    <>This visualises §2 of the paper. The real proof has f → ∞; we drop to f = 2 (Gaussian integers ℤ[i] in ℂ) for intuition. Slide R to see |X| and unit-pair counts both grow exponentially — the gap between their exponents is what 1 + δ is.</>
                                  ))}
          </p>
          <Suspense fallback={<div className="ud-loading">Loading…</div>}>
            <LatticeProjection />
          </Suspense>

          <p>
            {(isZh ? (
                                    <>论文里的<strong>关键引理 2.4</strong>:多圆盘 W 里某个余集 a + Λⱼ 至少有 <TeX src="e^{\gamma f_j / 2} |X|" /> 个 X 上的有序对差落在 Uⱼ 中。这就是为什么投影到第一坐标后的 ℝ² 点集 P 有 <TeX src="\nu(P) \ge \frac{1}{2} e^{\gamma f / 2} |P|" /> 个单位距离对 — 远超平凡的 |P| 量级。</>
                                  ) : (
                                    <>The paper's <strong>key Lemma 2.4</strong>: some coset a + Λⱼ in W has ≥ <TeX src="e^{\gamma f_j / 2} |X|" /> ordered pairs whose difference lies in Uⱼ. That's why the projected planar set P has <TeX src="\nu(P) \ge \frac{1}{2} e^{\gamma f / 2} |P|" /> unit pairs — far exceeding the trivial linear count.</>
                                  ))}
          </p>
        </section>

        {/* ─────────────── 10. AI angle + references ─────────────── */}
        <section className="ud-section">
          <h2>{t('10. AI 自主求解 + 参考', '10. The AI angle + references')}</h2>

          <div className="ud-quote-block">
            <div className="ud-quote-head">
              {t('引用自论文 — "Statement on AI Use"', 'From the paper — "Statement on AI Use"')}
            </div>
            <blockquote>
              {(isZh ? (
                                          <>"这个问题是<em>完全自动地</em>解决的。我们的内部模型收到一份由 AI 撰写的问题陈述,其输出送入 AI 评分流水线,后者给出'高置信度认为解答正确'的判断。<em>只有在这之后</em>,内部人类研究者和数学家才开始仔细审阅。经过初步的 AI 辅助验证与重写,草稿才送给外部数学家,包括若干数论专家,他们确认了证明的正确性(并已经简化与加强了论证)。本论文是对此自动生成解答的人类编辑版本,补充了参考、重组的证明、与额外解释材料。"</>
                                        ) : (
                                          <>"This problem was solved in a completely automated fashion. Our internal model was given an AI-written statement of the problem, and its output was sent to an AI grading pipeline, which indicated high confidence that the solution was correct. It was only after this point that internal human researchers and mathematicians began to examine the solution carefully. After preliminary AI-assisted verification and rewriting, a draft was sent to external mathematicians, including several number theory experts, who confirmed the proof's correctness (and have already simplified and strengthened the argument). The present manuscript is a human-edited exposition of the autonomously produced solution, with references, reorganized proofs, and additional explanatory material added afterward."</>
                                        ))}
            </blockquote>
          </div>

          <p>
            {(isZh ? (
                                    <>这件事在 AI for math 的版图里是一个里程碑:不是数学家用 AI 当辅助,而是 AI <em>整个</em>完成了一项数学发现 — 一个 80 年的开放猜想被推翻 — 之后人类才介入。原始模型的输出与论文一同公开。OpenAI 团队中 Lijie Chen 用内部模型生成证明,Mark Sellke 和 Mehtaab Sawhney 验证正确性。</>
                                  ) : (
                                    <>This is a milestone in AI for math: not mathematicians using AI as an assistant, but AI <em>making</em> the discovery end-to-end — refuting an 80-year-old conjecture — before any human got involved. The model's raw output is published alongside the paper. The OpenAI team: Lijie Chen used the internal model to generate the proof, while Mark Sellke and Mehtaab Sawhney verified correctness.</>
                                  ))}
          </p>
          <p>
            {(isZh ? (
                                    <>2026 年 5 月,两组数学家迅速跟进:</>
                                  ) : (
                                    <>In May 2026, two groups of mathematicians rapidly followed up:</>
                                  ))}
          </p>
          <ul>
            <li>
              {(isZh ? (
                                          <><strong>Remarks 论文</strong>(Alon, Bloom, Gowers, Litt, Sawin, Shankar, Tsimerman, Wang, Wood 联名,arXiv:2605.20695):人类消化版,把 OpenAI 原始证明里<em>非显式</em>的 δ &gt; 0 显式算出来,得到 <TeX src="\delta \approx 6 \times 10^{-38}" />;并把原始 pro-3 塔证明简化到 pro-2 塔 + 单一分裂素数(Victor Wang 建议的简化)。</>
                                        ) : (
                                          <><strong>Remarks paper</strong> (Alon, Bloom, Gowers, Litt, Sawin, Shankar, Tsimerman, Wang, Wood; arXiv:2605.20695): human-digested version that computes the implicit δ &gt; 0 explicitly to <TeX src="\delta \approx 6 \times 10^{-38}" />, and simplifies the original pro-3 tower argument to pro-2 + single split prime (the simplification was suggested by Victor Wang).</>
                                        ))}
            </li>
            <li>
              {(isZh ? (
                                          <><strong>Sawin 单作</strong>(arXiv:2605.20579,2026-05-20):大幅改进,得到显式的 <TeX src="\nu(n) \ge n^{1.014114} / C" />。换算成 δ 是 <TeX src="\delta \ge 0.014" /> — 离上界 <TeX src="n^{4/3}" /> 只差<em>约 24 倍</em>(指数比 <TeX src="(4/3 - 1) / 0.014 \approx 24" />)。Sawin 三个改进:用任意理想代替 <TeX src="\mathcal{O}_K" />、用相对类数代替全类数、按 Frobenius 固定幂商化(不必为 1)。</>
                                        ) : (
                                          <><strong>Sawin solo</strong> (arXiv:2605.20579, 2026-05-20): drastic improvement to explicit <TeX src="\nu(n) \ge n^{1.014114} / C" />, i.e. <TeX src="\delta \ge 0.014" /> — within a factor of about 24 of the SST upper bound <TeX src="n^{4/3}" /> (since <TeX src="(4/3 - 1) / 0.014 \approx 24" />). Three improvements: work with any ideal (not just <TeX src="\mathcal{O}_K" />), use the relative class number (not the full class number), quotient by a fixed power of Frobenius (not 1).</>
                                        ))}
            </li>
          </ul>
          <p className="ud-text-mute" style={{ fontSize: '0.86rem' }}>
            {(isZh ? (
                                    <>关于"能不能画一张精确的点集图":三篇论文都<em>无显式构造</em>。Remarks §2 给的唯一显式参数 (<TeX src="T = \{3,5,7,11,13,17\}" />、分裂素数 101、基场 <TeX src="L_T = \mathbb{Q}(\sqrt{5}, \sqrt{13}, \sqrt{17}, \sqrt{21}, \sqrt{33})" /> 32 次多重二次域) 只到 Golod–Shafarevich 这一步,塔的每一层 <TeX src="L_j" /> 是<em>存在性</em>结论,没有算法描述。所以"新构造长啥样"目前没有图。</>
                                  ) : (
                                    <>On whether an exact picture of the new construction exists: <em>all three papers are non-constructive</em>. The one explicit parameter choice (Remarks §2) — <TeX src="T = \{3,5,7,11,13,17\}" />, split prime 101, base field <TeX src="L_T = \mathbb{Q}(\sqrt{5}, \sqrt{13}, \sqrt{17}, \sqrt{21}, \sqrt{33})" /> (degree 32 multi-quadratic) — only reaches the Golod–Shafarevich step; the individual layers <TeX src="L_j" /> are given by an existence theorem with no algorithmic description.</>
                                  ))}
          </p>

          <h3>{t('11. 数学家怎么看 — 引自 Remarks §3-9', '11. What the mathematicians said — quotes from Remarks §3-9')}</h3>
          <div className="ud-reactions">
            <div className="ud-reaction">
              <div className="ud-reaction-who">Noga Alon <span className="ud-reaction-aff">{t('普林斯顿', 'Princeton')}</span></div>
              <blockquote>
                {(isZh
                                                ? <>"OpenAI 内部模型对此问题的解答,在我看来是<em>杰出的成就</em> — 解决了一个长期悬而未决的问题。正确答案不是 n^(1+o(1)) 这件事本身就令人惊讶,构造与分析对算法数论工具的运用<em>优雅而巧妙</em>。"</>
                                                : <>"The solution of the problem by the internal model of OpenAI is, in my opinion, an <em>outstanding achievement</em>, settling a long-standing open problem. The fact that the correct answer is not n^(1+o(1)) is surprising, and the construction and analysis apply fairly sophisticated tools from algebraic number theory in an <em>elegant and clever</em> way."</>)}
              </blockquote>
            </div>

            <div className="ud-reaction">
              <div className="ud-reaction-who">Thomas Bloom <span className="ud-reaction-aff">{t('英国皇家学会大学研究员', 'Royal Society URF')}</span></div>
              <blockquote>
                {(isZh
                                                ? <>"2026 年 4 月 16 日,我在 erdosproblems.com 发了一篇博客叫(略带调侃)'Top 10 Erdős Problems'。单位距离问题是我唯一从离散几何选的。<em>虽然我相信 AI 早晚会推进这清单上的几个,我没想到一个月就来了!</em>"</>
                                                : <>"On April 16, I included this problem in a blog post on erdosproblems.com titled (tongue in cheek) 'Top 10 Erdős Problems'. The unit distance problem was the only one I included from discrete geometry. <em>While I believed AI would make progress on at least a couple eventually, I did not expect this to happen just one month later!</em>"</>)}
              </blockquote>
            </div>

            <div className="ud-reaction">
              <div className="ud-reaction-who">W. T. Gowers <span className="ud-reaction-aff">{t('剑桥 / 法兰西学院,Fields 奖', 'Cambridge / Collège de France, Fields')}</span></div>
              <blockquote>
                {(isZh
                                                ? <>"如果人类作者把这篇论文投给《Annals of Mathematics》并让我快速评审,<em>我会毫不犹豫地推荐接受。此前没有任何 AI 生成的证明能达到这一标准。</em>……即便后续表明 AI 还不能找需要长 hint sequence 的证明,这种证明对人类也很难找。在 AI 数学进展不至于戛然而止的前提下,我们可能已经进入一个时代:让人类在解数学问题上跟 AI 竞争会变得很困难。"</>
                                                : <>"If a human had written the paper and submitted it to the Annals of Mathematics and I had been asked for a quick opinion, <em>I would have recommended acceptance without any hesitation. No previous AI-generated proof has come close to that.</em>… Even if it turns out that AI cannot yet find proofs that need long hint sequences, such proofs are very difficult to find for humans as well, so in the unlikely event that AI math progress stalls, we have probably entered an era where it will become difficult for humans to compete with AI at solving mathematical problems."</>)}
              </blockquote>
            </div>

            <div className="ud-reaction">
              <div className="ud-reaction-who">Daniel Litt <span className="ud-reaction-aff">Toronto / Sloan</span></div>
              <blockquote>
                {(isZh
                                                ? <>"这是<em>第一个</em>我发现本身就令人兴奋(而非作为'下一步会怎样'的领先指标)的 AI 自主生成结果。类比:有限域 Kakeya 猜想被 Dvir 用一个简短而漂亮的论证解决;sensitivity conjecture 被黄昊用一个 elegant argument 解决。这次单位距离问题的解似乎是同一种气质。"</>
                                                : <>"This is the <em>first example</em> of a result produced autonomously by an AI that I find exciting in itself, as opposed to as a leading indicator. Analogues: Dvir's finite-field Kakeya proof; Huang's sensitivity conjecture proof. This unit-distance solution feels like the same flavor."</>)}
              </blockquote>
            </div>
          </div>

          <h3>{t('12. 仍开放的问题', '12. Open problems')}</h3>
          <div className="ud-open-grid">
            <div className="ud-open-card">
              <div className="ud-open-h">{t('上下界 gap', 'The bound gap')}</div>
              <p>
                {(isZh
                                                ? <>当前 <TeX src="n^{1.014} \le \nu(n) \le O(n^{4/3})" />。差 24 倍指数(<TeX src="(4/3 - 1)/0.014" />)。<strong>真值在哪没人知道。</strong>可能 4/3 就是答案,可能介于,可能更小。</>
                                                : <>Current: <TeX src="n^{1.014} \le \nu(n) \le O(n^{4/3})" />. Factor-24 gap in exponent. <strong>True value unknown.</strong> Could be 4/3, could be in between, could be smaller.</>)}
              </p>
            </div>
            <div className="ud-open-card">
              <div className="ud-open-h">{t('SST 上界 40 年没动', 'SST upper bound stuck')}</div>
              <p>
                {(isZh
                                                ? <>SST 1984 的 <TeX src="O(n^{4/3})" /> 自 1984 以来除常数微调外没有改进。<strong>能否压到 <TeX src="O(n^{4/3 - \varepsilon})" />?</strong>会是 40 年来最重大的进展。</>
                                                : <>SST 1984 hasn't budged beyond constant tweaks. <strong>Can the upper be sharpened to <TeX src="O(n^{4/3 - \varepsilon})" />?</strong> Would be the biggest advance in 40 years.</>)}
              </p>
            </div>
            <div className="ud-open-card">
              <div className="ud-open-h">{t('显式构造?', 'Explicit construction?')}</div>
              <p>
                {(isZh
                                                ? <>目前所有证明都依赖 Golod–Shafarevich 这种<em>存在性</em>论证。<strong>能否给出显式 P_j 的具体坐标?</strong>哪怕一层都好。</>
                                                : <>All proofs rely on Golod–Shafarevich <em>existence</em>. <strong>Can we exhibit explicit P_j coordinates?</strong> Even one layer would be a milestone.</>)}
              </p>
            </div>
            <div className="ud-open-card">
              <div className="ud-open-h">{t('Erdős–Fishburn', 'Erdős–Fishburn')}</div>
              <p>
                {(isZh
                                                ? <>更强变体:每个点都有 ≥ k 个等距邻居 ⟹ k ≤ n^o(1)。OpenAI 也<em>顺手反驳</em>了这条 — 新构造的平均度是 n^Ω(1)。</>
                                                : <>Stronger variant: every point with ≥ k equidistant neighbours ⟹ k ≤ n^o(1). OpenAI also <em>incidentally refuted</em> this — the new construction has avg degree n^Ω(1).</>)}
              </p>
            </div>
            <div className="ud-open-card">
              <div className="ud-open-h">{t('Bloom 的"Top 10"还剩哪些?', 'Bloom\'s "Top 10" — which next?')}</div>
              <p>
                {(isZh
                                                ? <>2026-04 Bloom 列了 10 个最 prominent 的 Erdős 问题。单位距离一个月内倒下。<strong>下一个会是哪个?</strong>区别在哪?这种"非显式构造性反例"的成功模式还能复用吗?</>
                                                : <>2026-04 Bloom listed his 10 most prominent Erdős problems. Unit distance fell in a month. <strong>Which next?</strong> What distinguishes them? Does the "non-constructive AI counterexample" pattern generalise?</>)}
              </p>
            </div>
            <div className="ud-open-card">
              <div className="ud-open-h">{t('高维推广', 'Higher dimensions')}</div>
              <p>
                {(isZh
                                                ? <>在 ℝ^d (d ≥ 3) 中相应问题怎样?Sawin 的方法应该可推广,但 d=3,4 时的上界 (Erdős-Hickerson) 也已经 Ω(n^{`{4/3}`}) — 现在 d ≥ 3 是不是同样可达 n^(1+δ) 下界?</>
                                                : <>How about ν in ℝ^d, d ≥ 3? Sawin's method should generalise, but upper bounds (Erdős–Hickerson) are already Ω(n^{`{4/3}`}). Is the n^(1+δ) lower bound now reachable for d ≥ 3?</>)}
              </p>
            </div>
          </div>

          <h3>{t('参考', 'References')}</h3>
          <ul className="ud-refs">
            <li>
              OpenAI 2026-05-20. <em>{t('平面单位距离点集', 'Planar Point Sets with Many Unit Distances')}</em>.{' '}
              <a href="https://openai.com/index/model-disproves-discrete-geometry-conjecture/" target="_blank" rel="noopener noreferrer">{t('博客', 'Blog')} <ExternalLink size={11} /></a>{' '}·{' '}
              <a href="https://cdn.openai.com/pdf/74c24085-19b0-4534-9c90-465b8e29ad73/unit-distance-proof.pdf" target="_blank" rel="noopener noreferrer">PDF <ExternalLink size={11} /></a>
            </li>
            <li>
              Alon, Bloom, Gowers, Litt, Sawin, Shankar, Tsimerman, Wang, Wood 2026-05.{' '}
              <em>{t('单位距离猜想反驳的若干注记', 'Remarks on the Disproof of the Unit Distance Conjecture')}</em> ({t('人类消化版,显式 δ ≈ 6·10⁻³⁸ + pro-2 简化', 'human-digested, explicit δ ≈ 6·10⁻³⁸ + pro-2 simplification')}).{' '}
              <a href="https://arxiv.org/abs/2605.20695" target="_blank" rel="noopener noreferrer">arXiv:2605.20695 <ExternalLink size={11} /></a>
            </li>
            <li>
              Sawin, W. 2026-05-20.{' '}
              <em>{t('单位距离问题的显式下界', 'An Explicit Lower Bound for the Unit Distance Problem')}</em>{' '}
              ({t('大幅改进 δ ≥ 0.014,离 SST 上界仅约 24 倍', 'drastic improvement δ ≥ 0.014, within factor 24 of SST')}).{' '}
              <a href="https://arxiv.org/abs/2605.20579" target="_blank" rel="noopener noreferrer">arXiv:2605.20579 <ExternalLink size={11} /></a>
            </li>
            <li>
              OpenAI 2026. <em>{t('单位距离问题解答的重写思维链', 'Rewritten Chain of Thought for the Unit Distance Problem')}</em> ({t('原始 GPT 推理过程公开', 'raw model reasoning, published')}).{' '}
              <a href="https://cdn.openai.com/pdf/1625eff6-5ac1-40d8-b1db-5d5cf925de8b/unit-distance-cot.pdf" target="_blank" rel="noopener noreferrer">PDF <ExternalLink size={11} /></a>
            </li>
            <li>Erdős, P. 1946. On sets of distances of n points. <em>Amer. Math. Monthly</em> 53(5):248–250.</li>
            <li>Spencer, Szemerédi, Trotter 1984. Unit distances in the Euclidean plane.</li>
            <li>Székely, L. 1997. Crossing numbers and hard Erdős problems in discrete geometry.</li>
            <li>Guth, Katz 2015. On the Erdős distinct distances problem in the plane. <em>Ann. of Math.</em> 181(1):155–190.</li>
            <li>Hajir, Maire 2001. Asymptotically good towers of global fields.</li>
            <li>Golod, Shafarevich 1964. On the class field tower.</li>
            <li>Alon, Bucić, Sauermann 2025. Unit and distinct distances in typical norms.</li>
            <li>Greilhuber, Schildkraut, Tidor 2025. More unit distances in arbitrary norms.</li>
          </ul>
        </section>

      </main>
    </div>
  );
}
