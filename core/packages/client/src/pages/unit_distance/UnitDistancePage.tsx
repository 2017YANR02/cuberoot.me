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
import { Suspense, lazy } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ExternalLink, FileText, Sparkles } from 'lucide-react';
import LangToggle from '../../components/LangToggle';
import ThemeToggle from '../../components/ThemeToggle';
import { useDocumentTitle } from '../../utils/useDocumentTitle';
import { TeX, TeXBlock } from '../god/Tex';
import './unit_distance.css';

const UnitDistanceSandbox = lazy(() => import('./UnitDistanceSandbox'));
const GridConstruction = lazy(() => import('./GridConstruction'));
const BoundsChart = lazy(() => import('./BoundsChart'));
const ConstructionFlow = lazy(() => import('./ConstructionFlow'));
const LatticeProjection = lazy(() => import('./LatticeProjection'));
const ErdosGridHero = lazy(() => import('./ErdosGridHero'));

const TIMELINE: ReadonlyArray<{ year: string; lo: string; hi: string; cite: string; zh: string; en: string; final?: boolean }> = [
  { year: '1946', lo: 'n·c√(log n / log log n)', hi: 'O(n^3/2)', cite: 'Erdős', zh: 'Erdős 提出问题 + 提出猜想 ν(n) ≤ n^(1+C/log log n);K₂,₃-free 给上界 O(n^3/2)', en: 'Erdős states the problem + conjecture ν(n) ≤ n^(1+C/log log n); K₂,₃-free gives upper O(n^3/2)' },
  { year: '1984', lo: 'n·c√(log n / log log n)', hi: 'O(n^4/3)', cite: 'SST', zh: 'Spencer–Szemerédi–Trotter 把上界压到 O(n^4/3),用 incidence bound', en: 'Spencer–Szemerédi–Trotter improve upper to O(n^4/3) via incidence bound' },
  { year: '1997', lo: '同上', hi: 'O(n^4/3)', cite: 'Sze', zh: 'Székely 用 crossing number 给出 O(n^4/3) 的 1-页证明', en: 'Székely\'s 1-page crossing-number proof of O(n^4/3)' },
  { year: '2011', lo: '同上', hi: 'O(n log n)', cite: 'Mat', zh: 'Matoušek 证明大多数范数下 ν 几乎线性 — 暗示 Euclidean 也"应该"如此', en: 'Matoušek: for most norms ν is near-linear — suggesting Euclidean "should" be too' },
  { year: '2022', lo: '同上', hi: 'O(n^4/3) (constant ↓)', cite: 'ÁP', zh: 'Ágoston & Pálvölgyi 改进 n^4/3 的常数(40 年来唯一进展)', en: 'Ágoston & Pálvölgyi sharpen the constant in n^4/3 (only progress in 40 yrs)' },
  { year: '2025', lo: '同上', hi: 'O(n log² n) generic', cite: 'ABS / GST', zh: 'Alon–Bucić–Sauermann + Greilhuber–Schildkraut–Tidor:对几乎所有 d 维范数,ν ≤ (d/2 ± o(1)) n log² n', en: 'Alon–Bucić–Sauermann + Greilhuber–Schildkraut–Tidor: ν ≤ (d/2 ± o(1)) n log² n for nearly all d-dim norms' },
  { year: '2026', lo: 'n^(1+δ)', hi: 'O(n^4/3)', cite: 'OpenAI', zh: 'OpenAI: 反例!ν(n) ≥ n^(1+δ) 对无穷多 n — Erdős 猜想 80 年后被否定', en: 'OpenAI: counterexample! ν(n) ≥ n^(1+δ) for infinitely many n — Erdős\'s 80-year conjecture falls', final: true },
];

export default function UnitDistancePage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const t = (zh: string, en: string) => (isZh ? zh : en);
  useDocumentTitle('单位距离问题', 'Unit Distance Problem');

  return (
    <div className="unit-distance-page">
      <header className="ud-header">
        <Link to="/math" className="ud-back">
          <ArrowLeft size={16} />
          <span>{t('返回 数学', 'Back to Math')}</span>
        </Link>
        <div className="ud-header-right">
          <LangToggle variant="inline" />
          <ThemeToggle />
        </div>
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
            {isZh ? (
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
            )}
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
            {isZh ? (
              <>
                论文专设 "Statement on AI Use" 一节:问题陈述由 AI 撰写,内部模型自主求解,初次正确性由 AI 评分流水线打分,只有在评分确信无误<em>之后</em>,人类研究者才介入审阅。后续由数论专家进一步验证、简化、加强论证;论文是这条 AI-原始解的"人类编辑版"。
              </>
            ) : (
              <>
                The paper has a "Statement on AI Use" section. The problem statement was AI-authored, the internal model solved it fully autonomously, an AI grading pipeline scored the first solution as correct, and only <em>then</em> were human researchers brought in. Number-theory experts later verified, simplified, and strengthened the argument; the manuscript is a human-edited exposition of the AI-original output.
              </>
            )}
          </div>
        </section>

        {/* ─────────────── 2. TL;DR ─────────────── */}
        <section className="ud-section">
          <h2>TL;DR</h2>
          <ul>
            <li>
              {isZh ? (
                <><strong>什么:</strong>设 <TeX src="\nu(n)" /> 是平面 n 点集中单位距离对子数的最大值。Erdős 1946 猜想 <TeX src="\nu(n) \le n^{1 + C / \log \log n}" />。</>
              ) : (
                <><strong>What:</strong> let <TeX src="\nu(n)" /> = max number of unit-distance pairs among n planar points. Erdős 1946 conjectured <TeX src="\nu(n) \le n^{1 + C / \log \log n}" />.</>
              )}
            </li>
            <li>
              {isZh ? (
                <><strong>反例:</strong>存在常数 <TeX src="\delta > 0" />,使得 <TeX src="\nu(n) \ge n^{1+\delta}" /> 对无穷多 n 成立。</>
              ) : (
                <><strong>Counter:</strong> there is <TeX src="\delta > 0" /> such that <TeX src="\nu(n) \ge n^{1+\delta}" /> for infinitely many n.</>
              )}
            </li>
            <li>
              {isZh ? (
                <><strong>怎么做:</strong>把 Erdős 经典的 ℤ[i] 网格构造提升到高维。用一个全实数域 L 的无穷无支 pro-3 塔(度数 → ∞,根判别式保持有界),取 K = L(i) 这种 CM 域;Chebotarev 选定的素数在每层完全分裂,产生指数多 |σ(u)| = 1 的元素 u,Minkowski 嵌入到 ℂ^f 中再投影到第一坐标,得到 ℝ² 中的点集。</>
              ) : (
                <><strong>How:</strong> lift Erdős's classical ℤ[i] grid trick to high dimensions. Use an infinite unramified pro-3 tower over a totally-real field L (degrees → ∞, root discriminant bounded), take the CM field K = L(i); Chebotarev gives primes that split completely in every layer, producing exponentially many u with |σ(u)| = 1. Minkowski-embed into ℂ^f and project to the first coordinate to get an ℝ² point set.</>
              )}
            </li>
            <li>
              {isZh ? (
                <><strong>关键技术:</strong>Golod–Shafarevich 不等式保证 pro-3 塔无穷;Frattini 子群论证使添加分裂条件时不降低生成元秩;CM 域 + Minkowski 把"代数 norm-1"翻译成"几何 |σ(u)| = 1"。</>
              ) : (
                <><strong>Key tools:</strong> Golod–Shafarevich keeps the pro-3 tower infinite; a Frattini-subgroup argument adds splitting conditions without dropping the generator rank; CM + Minkowski translates "algebraic norm 1" to "geometric |σ(u)| = 1".</>
              )}
            </li>
            <li>
              {isZh ? (
                <><strong>AI 元亮点:</strong>问题由 AI 撰写,内部模型完全自主求解,AI 评分流水线打分后才进入人类审阅。原始模型输出与论文一同公开。</>
              ) : (
                <><strong>AI angle:</strong> AI wrote the problem, the internal model solved it autonomously, an AI grading pipeline scored it, <em>then</em> humans reviewed. The raw model output is published alongside the paper.</>
              )}
            </li>
          </ul>
        </section>

        {/* ─────────────── 3. The problem ─────────────── */}
        <section className="ud-section">
          <h2>{t('3. 问题 — 拖一拖你就懂', '3. The problem — drag the points')}</h2>
          <p>
            {isZh ? (
              <>给定平面上 n 个不同的点 <TeX src="P \subset \mathbb{R}^2" />,定义</>
            ) : (
              <>Given n distinct points <TeX src="P \subset \mathbb{R}^2" /> in the plane, define</>
            )}
          </p>
          <div className="ud-formula">
            <TeXBlock src={`\\nu(P) \\;=\\; \\#\\{\\{x, y\\} \\subset P : |x - y| = 1\\},\\qquad \\nu(n) \\;=\\; \\max_{|P| = n} \\nu(P).`} />
          </div>
          <p>
            {isZh ? (
              <>下面拖点试试。等边三角形给最高 ν/n(每个三角形边都是单位距离);切到方格立刻能看出 <em>水平 + 垂直</em> 两族,但少了对角线那一族。</>
            ) : (
              <>Drag any point below. Equilateral triangles maximise local ν/n (every triangle edge is a unit distance); switching to the square lattice loses the diagonal family entirely.</>
            )}
          </p>
          <Suspense fallback={<div className="ud-loading">Loading…</div>}>
            <UnitDistanceSandbox />
          </Suspense>
        </section>

        {/* ─────────────── 4. Erdős's grid ─────────────── */}
        <section className="ud-section">
          <h2>{t('4. Erdős 1946 的小聪明 — 重定义"单位"', '4. Erdős\'s 1946 trick — redefine "unit"')}</h2>

          <Suspense fallback={<div className="ud-loading">Loading…</div>}>
            <ErdosGridHero />
          </Suspense>
          <p className="ud-figure-caption">
            {isZh
              ? <>↑ 全分辨率精确复刻 — 与 OpenAI 博客头图同构造。每条线都是 <em>恰好</em> √k 长。切换 k 看 r₂(k) 怎么决定密度。</>
              : <>↑ Full-resolution exact reproduction — same construction as OpenAI's hero figure. Every segment is <em>exactly</em> √k long. Switch k to feel how r₂(k) drives density.</>
            }
          </p>

          <p>
            {isZh ? (
              <>取 √n × √n 整数网格,直接用单位 1 给出的对子数只有 <TeX src="2s(s-1) \approx 2n" />,这是平凡的线性下界。
                Erdős 的关键观察:把"单位距离"<em>重定义</em>成 <TeX src="\sqrt{k}" />,其中 k 可以是任何整数。这时,两点 (x₁, y₁) (x₂, y₂) 之间是"单位距离" ⟺ <TeX src="(x_1 - x_2)^2 + (y_1 - y_2)^2 = k" /> ⟺ k 是两个整数的平方和。</>
            ) : (
              <>Take the √n × √n integer grid. With "unit = 1", there are only <TeX src="2s(s-1) \approx 2n" /> unit-distance pairs — a trivial linear bound.
                Erdős's key observation: <em>redefine</em> "unit distance" to be <TeX src="\sqrt{k}" /> for any integer k. Now two points (x₁, y₁), (x₂, y₂) are at unit distance ⟺ <TeX src="(x_1 - x_2)^2 + (y_1 - y_2)^2 = k" /> ⟺ k is a sum of two squares.</>
            )}
          </p>
          <p>
            {isZh ? (
              <>设 <TeX src="r_2(k)" /> 是 k 写成两整数平方和的方式数。 r₂(1) = 4 ((±1, 0), (0, ±1));但 r₂(5) = 8 ((±1, ±2), (±2, ±1))。在 s×s 网格里,squared-distance = k 的对子数 ≈ <TeX src="\frac{1}{2} \sum_{(a,b): a^2+b^2=k} (s - |a|)(s - |b|)" />,正比于 r₂(k)。</>
            ) : (
              <>Let <TeX src="r_2(k)" /> count the ways to write k as a sum of two squares. r₂(1) = 4 ((±1, 0), (0, ±1)); r₂(5) = 8 ((±1, ±2), (±2, ±1)). In the s×s grid, the count of pairs at squared distance k is ≈ <TeX src="\frac{1}{2} \sum_{(a,b): a^2+b^2=k} (s - |a|)(s - |b|)" />, proportional to r₂(k).</>
            )}
          </p>
          <p>
            {isZh ? (
              <>挑使 r₂(k) 最大的 k ≤ n,Erdős 得到</>
            ) : (
              <>Choosing k ≤ n with maximum r₂(k), Erdős got</>
            )}
          </p>
          <div className="ud-formula">
            <TeXBlock src={`\\nu(n) \\;\\ge\\; n \\cdot n^{c / \\log \\log n} \\;=\\; n^{1 + c / \\log \\log n}.`} />
          </div>
          <p>
            {isZh ? (
              <>正是猜想的形式!Erdős 猜的上界与他自己的下界<em>形式</em>一样,差的是常数 c → C。他相信这就是真实增长。下面拖滑块改 k 和 s 看看 r₂(k) 怎么影响 ν 的:</>
            ) : (
              <>The same form as his conjectured upper! He believed his own lower bound was tight up to constants. Below, slide k and s to see how r₂(k) drives ν:</>
            )}
          </p>
          <Suspense fallback={<div className="ud-loading">Loading…</div>}>
            <GridConstruction />
          </Suspense>
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
                <div className="ud-timeline-text">{isZh ? row.zh : row.en}</div>
              </div>
            ))}
          </div>

          <p>
            {isZh ? (
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
            )}
          </p>

          <Suspense fallback={<div className="ud-loading">Loading…</div>}>
            <BoundsChart />
          </Suspense>
        </section>

        {/* ─────────────── 6. Theorem 1.1 ─────────────── */}
        <section className="ud-section">
          <h2>{t('6. 主定理', '6. Main theorem')}</h2>
          <div className="ud-theorem">
            <span className="ud-theorem-head">Theorem 1.1 (OpenAI 2026)</span>
            <p style={{ margin: '0.6rem 0 0' }}>
              {isZh ? (
                <>存在绝对常数 <TeX src="\delta > 0" />,以及无穷多正整数 n,使得 <TeX src="\nu(n) \ge n^{1 + \delta}" />。</>
              ) : (
                <>There exists an absolute constant <TeX src="\delta > 0" /> and infinitely many positive integers n such that <TeX src="\nu(n) \ge n^{1 + \delta}" />.</>
              )}
            </p>
          </div>
          <p>
            {isZh ? (
              <>这反驳了 Erdős 1946 的猜想 <TeX src="\nu(n) \le n^{1+C/\log\log n}" />:任何形如 <TeX src="n^{1+\delta}" /> 的下界,只要 δ &gt; 0 是常数,就最终 (即 n 足够大时) 超越 <TeX src="n^{1+C/\log\log n}" />,因为后者的指数 1 + C/log log n 收敛到 1。</>
            ) : (
              <>This refutes Erdős's 1946 conjecture <TeX src="\nu(n) \le n^{1+C/\log\log n}" />: any constant-δ lower bound of the form <TeX src="n^{1+\delta}" /> eventually (for large enough n) exceeds <TeX src="n^{1+C/\log\log n}" />, because the latter's exponent 1 + C/log log n converges to 1.</>
            )}
          </p>
          <p>
            {isZh ? (
              <>它<em>还</em>反驳了 Erdős–Fishburn 1997 的更强猜想 (任意点都有 ≥ k 等距邻居 ⟹ k ≤ n^o(1)):构造里点集的单位距离图<em>平均度</em>是 n^Ω(1),平均度 ≥ 2k 的图有最小度 ≥ k 的子图。</>
            ) : (
              <>It <em>also</em> refutes the stronger Erdős–Fishburn 1997 conjecture (every point has ≥ k equidistant neighbours ⟹ k ≤ n^o(1)): the construction's unit-distance graph has average degree n^Ω(1), and average-degree ≥ 2k always contains a subgraph of minimum degree ≥ k.</>
            )}
          </p>
        </section>

        {/* ─────────────── 7. ℤ[i] vs L(i) ─────────────── */}
        <section className="ud-section">
          <h2>{t('7. 经典 ℤ[i] vs 新 L(i)', '7. Classical ℤ[i] vs new L(i)')}</h2>
          <p>
            {isZh ? (
              <>第 4 节那个 r₂(k) 的小聪明,几何上其实是在 Gauss 整数 ℤ[i] 上做"范数为 k"的分解。在 ℤ[i] 里,k = q 是 ≡ 1 mod 4 的素数 ⟹ q = π · π̄,π 是 Gauss 素数。许多这样的 q 乘起来,得到 z ∈ ℤ[i] 满足 z·z̄ = k,几何上 z 就是从原点出发长度为 √k 的格点。</>
            ) : (
              <>The r₂(k) trick in §4 is, geometrically, a "norm = k" factorisation in the Gaussian integers ℤ[i]. In ℤ[i], if k = q is a prime ≡ 1 mod 4, then q = π · π̄ for a Gaussian prime π. Multiplying many such q's gives many z ∈ ℤ[i] with z·z̄ = k — each z is a lattice point at distance √k from origin.</>
            )}
          </p>
          <p>
            {isZh ? (
              <>新构造做的事:把 ℚ 换成更大的全实场 L,把 ℤ[i] 换成 <TeX src="\mathcal{O}_K" /> (其中 K = L(i))。L 的非平凡自同构 c (限制到 K 上的复共轭) 把"复模 = 1"翻译成"对所有复嵌入 σ 都有 |σ(u)| = 1"。L 的度数 [L:ℚ] → ∞,所以 ℂ^f 是真正的高维空间,可以塞下指数多 norm-1 元素。</>
            ) : (
              <>The new construction: replace ℚ by a larger totally real field L, and ℤ[i] by <TeX src="\mathcal{O}_K" /> (K = L(i)). The non-trivial automorphism c (becoming complex conjugation under any embedding of K) translates "complex modulus 1" into "|σ(u)| = 1 for every complex embedding σ". Since [L:ℚ] → ∞, ℂ^f is genuinely high-dimensional and fits exponentially many norm-1 elements.</>
            )}
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

        {/* ─────────────── 8. The construction (flow) ─────────────── */}
        <section className="ud-section">
          <h2>{t('8. 构造分 5 步', '8. The construction in 5 stages')}</h2>
          <p>
            {isZh ? (
              <>每一步点开看公式 + 解释。整体顺序:<em>基场 F → pro-3 塔 → CM 扩张 K = F(i) → Minkowski 格 → 切+投影</em>。前 3 步是<strong>数论部分</strong>(构造好"高维 + 多 norm-1 元素"的代数对象),后 2 步是<strong>几何部分</strong>(把代数对象翻译成 ℝ² 的点集)。</>
            ) : (
              <>Click any stage to expand. The pipeline: <em>base F → pro-3 tower → CM extension K = F(i) → Minkowski lattice → cut + project</em>. The first three are the <strong>arithmetic part</strong> (build an algebraic object with high dim + many norm-1 elements); the last two are the <strong>geometric part</strong> (translate it into a planar point set).</>
            )}
          </p>
          <Suspense fallback={<div className="ud-loading">Loading…</div>}>
            <ConstructionFlow />
          </Suspense>
        </section>

        {/* ─────────────── 9. Lattice → projection schematic ─────────────── */}
        <section className="ud-section">
          <h2>{t('9. 几何部分:格 → 多圆盘 → 投影', '9. Geometric part: lattice → polydisc → projection')}</h2>
          <p>
            {isZh ? (
              <>这一节是论文 §2 的可视化。论文里 f → ∞,这里我们退到 f = 2 (Gauss 整数 ℤ[i] in ℂ) 来直观地看。改 R 看 |X| 和单位距离对怎么同时指数增长 — 关键比是它们的指数差,正比于 1 + δ。</>
            ) : (
              <>This visualises §2 of the paper. The real proof has f → ∞; we drop to f = 2 (Gaussian integers ℤ[i] in ℂ) for intuition. Slide R to see |X| and unit-pair counts both grow exponentially — the gap between their exponents is what 1 + δ is.</>
            )}
          </p>
          <Suspense fallback={<div className="ud-loading">Loading…</div>}>
            <LatticeProjection />
          </Suspense>

          <p>
            {isZh ? (
              <>论文里的<strong>关键引理 2.4</strong>:多圆盘 W 里某个余集 a + Λⱼ 至少有 <TeX src="e^{\gamma f_j / 2} |X|" /> 个 X 上的有序对差落在 Uⱼ 中。这就是为什么投影到第一坐标后的 ℝ² 点集 P 有 <TeX src="\nu(P) \ge \frac{1}{2} e^{\gamma f / 2} |P|" /> 个单位距离对 — 远超平凡的 |P| 量级。</>
            ) : (
              <>The paper's <strong>key Lemma 2.4</strong>: some coset a + Λⱼ in W has ≥ <TeX src="e^{\gamma f_j / 2} |X|" /> ordered pairs whose difference lies in Uⱼ. That's why the projected planar set P has <TeX src="\nu(P) \ge \frac{1}{2} e^{\gamma f / 2} |P|" /> unit pairs — far exceeding the trivial linear count.</>
            )}
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
              {isZh ? (
                <>"这个问题是<em>完全自动地</em>解决的。我们的内部模型收到一份由 AI 撰写的问题陈述,其输出送入 AI 评分流水线,后者给出'高置信度认为解答正确'的判断。<em>只有在这之后</em>,内部人类研究者和数学家才开始仔细审阅。经过初步的 AI 辅助验证与重写,草稿才送给外部数学家,包括若干数论专家,他们确认了证明的正确性(并已经简化与加强了论证)。本论文是对此自动生成解答的人类编辑版本,补充了参考、重组的证明、与额外解释材料。"</>
              ) : (
                <>"This problem was solved in a completely automated fashion. Our internal model was given an AI-written statement of the problem, and its output was sent to an AI grading pipeline, which indicated high confidence that the solution was correct. It was only after this point that internal human researchers and mathematicians began to examine the solution carefully. After preliminary AI-assisted verification and rewriting, a draft was sent to external mathematicians, including several number theory experts, who confirmed the proof's correctness (and have already simplified and strengthened the argument). The present manuscript is a human-edited exposition of the autonomously produced solution, with references, reorganized proofs, and additional explanatory material added afterward."</>
              )}
            </blockquote>
          </div>

          <p>
            {isZh ? (
              <>这件事在 AI for math 的版图里是一个里程碑:不是数学家用 AI 当辅助,而是 AI <em>整个</em>完成了一项数学发现 — 一个 80 年的开放猜想被推翻 — 之后人类才介入。原始模型的输出与论文一同公开。Fields 奖得主 Tim Gowers 与若干数论专家(Alon、Sawin、Litt、Shankar、Tsimerman、Wang、Wood)在<em>Remarks</em> 一文中给出了人类消化版,把<em>非构造的</em> δ &gt; 0 显式算到 <TeX src="\delta \approx 6.24 \times 10^{-38}" />,并把原始 pro-3 塔证明简化到 pro-2 塔 + 单一分裂素数 (Sawin 的贡献)。</>
            ) : (
              <>This is a milestone in AI for math: not mathematicians using AI as an assistant, but AI <em>making</em> the discovery end-to-end — refuting an 80-year-old conjecture — before any human got involved. The model's raw output is published alongside the paper. Fields-medalist Tim Gowers and a team of number theorists (Alon, Sawin, Litt, Shankar, Tsimerman, Wang, Wood) published a "Remarks" companion that computes the previously implicit δ &gt; 0 explicitly to <TeX src="\delta \approx 6.24 \times 10^{-38}" /> and simplifies the original pro-3 tower argument to a pro-2 tower with a single split prime (Sawin's contribution).</>
            )}
          </p>
          <p className="ud-text-mute" style={{ fontSize: '0.86rem' }}>
            {isZh ? (
              <>显式参数选择(Remarks §2):取小素数集 <TeX src="T = \{3,5,7,11,13,17\}" />,分裂素数 101,基场 <TeX src="L_T = \mathbb{Q}(\sqrt{5}, \sqrt{13}, \sqrt{17}, \sqrt{21}, \sqrt{33})" /> 是 32 次多重二次域,Golod–Shafarevich 给出 <TeX src="G_T^{\{101,\infty\}}" /> 无穷,生成元秩 5、关系秩 ≤ 6。<em>但具体每一层 L_j 的代数描述、以及 ℝ² 中产生的点集 P_j 都没有显式算法 — 论文明确承认这一点。</em></>
            ) : (
              <>The one explicit parameter choice (Remarks §2): T = {`{3,5,7,11,13,17}`}, the split prime 101, base field <TeX src="L_T = \mathbb{Q}(\sqrt{5}, \sqrt{13}, \sqrt{17}, \sqrt{21}, \sqrt{33})" /> — a degree-32 multi-quadratic field, with Golod–Shafarevich giving an infinite <TeX src="G_T^{\{101,\infty\}}" /> (generator rank 5, relation rank ≤ 6). <em>But there is no explicit algorithm for the individual layers L_j or for the resulting planar sets P_j — the paper says so directly.</em></>
            )}
          </p>

          <h3>{t('参考', 'References')}</h3>
          <ul className="ud-refs">
            <li>
              OpenAI 2026-05-20. <em>{t('平面单位距离点集', 'Planar Point Sets with Many Unit Distances')}</em>.{' '}
              <a href="https://openai.com/index/model-disproves-discrete-geometry-conjecture/" target="_blank" rel="noopener noreferrer">{t('博客', 'Blog')} <ExternalLink size={11} /></a>{' '}·{' '}
              <a href="https://cdn.openai.com/pdf/74c24085-19b0-4534-9c90-465b8e29ad73/unit-distance-proof.pdf" target="_blank" rel="noopener noreferrer">PDF <ExternalLink size={11} /></a>
            </li>
            <li>
              Alon, Bloom, Gowers, Litt, Sawin, Shankar, Tsimerman, Wang, Wood 2026.{' '}
              <em>{t('单位距离猜想反驳的若干注记', 'Remarks on the Disproof of the Unit Distance Conjecture')}</em> ({t('人类消化版,含显式 δ ≈ 6.24·10⁻³⁸ + pro-2 简化', 'human-digested version, explicit δ ≈ 6.24·10⁻³⁸ + pro-2 simplification')}).{' '}
              <a href="https://cdn.openai.com/pdf/74c24085-19b0-4534-9c90-465b8e29ad73/unit-distance-remarks.pdf" target="_blank" rel="noopener noreferrer">PDF <ExternalLink size={11} /></a>{' '}·{' '}
              <a href="https://arxiv.org/abs/2605.20695" target="_blank" rel="noopener noreferrer">arXiv:2605.20695 <ExternalLink size={11} /></a>
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
