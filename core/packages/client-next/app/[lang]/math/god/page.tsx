'use client';

/**
 * /math/god — 上帝之数 (God's Number) 全 WCA 项目总览。
 *
 * 结构:
 *   1. 头部 + 群论简介
 *   2. 上帝之数定义 + 度量对照 (interactive MetricExplainer)
 *   3. 17 项目卡片网格(VisualCube 缩略图 + 直径 + 状态空间)
 *   4. NxN 增长可视化 (interactive GrowthChart)
 *   5. 2x2 现场 BFS 演示 (interactive Bfs2x2Demo)
 *   6. 历史时间线
 *   7. 算法 / 参考资料
 */
import { Suspense, lazy, useMemo, useState, type ReactNode } from 'react';
import Link from '@/components/AppLink';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { VisualCube } from '@/components/VisualCube';
import { EventIcon } from '@/components/EventIcon/EventIcon';
import { PUZZLES, primaryDiameter, WCA_EVENT_ORDER, type PuzzleEntry } from './_components/god_data';
import { DEEP } from './_components/god_deep_data';
import { TeX, TeXBlock, MathText } from './_components/Tex';
import './god.css';
import { tr } from '@/i18n/tr';
import i18n from '@/i18n/i18n-client';

const GrowthChart = lazy(() => import('./_components/GrowthChart'));
const Bfs2x2Demo = lazy(() => import('./_components/Bfs2x2Demo'));
const MetricExplainer = lazy(() => import('./_components/MetricExplainer'));
const DistanceDistribution = lazy(() => import('./_components/DistanceDistribution'));
const SubgroupChain = lazy(() => import('./_components/SubgroupChain'));
const SuperflipShowcase = lazy(() => import('./_components/SuperflipShowcase'));
const OpenProblems = lazy(() => import('./_components/OpenProblems'));
const FaqSection = lazy(() => import('./_components/FaqSection'));
const CosetCompression = lazy(() => import('./_components/CosetCompression'));
const IdaStarTree = lazy(() => import('./_components/IdaStarTree'));
const TwoPhaseDemo = lazy(() => import('./_components/TwoPhaseDemo'));
const ProofAnimator = lazy(() => import('./_components/ProofAnimator'));

/* ───── helpers ────────────────────────────────────────────────────── */

const SUP_MAP: Record<string, string> = {
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
  '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
  'ᵏ': 'k', '⁻': '-', '⁺': '+',
};
function fromSup(s: string): string { return s.split('').map((c) => SUP_MAP[c] ?? c).join(''); }

/** Convert pretty-print scientific text like "4.3 × 10¹⁹" or "(4.3 × 10¹⁹)ᵏ" to KaTeX source. */
function sciToTex(s: string): string {
  return s
    // (... × 10ⁿ)ᵏ pattern
    .replace(/\(([^)]+)\)([⁰-⁹ᵏ⁻⁺]+)/g, (_m, inner: string, sup: string) => `\\bigl(${sciToTex(inner)}\\bigr)^{${fromSup(sup)}}`)
    // a × 10ⁿ
    .replace(/×\s*10([⁰-⁹⁻⁺]+)/g, (_m, sup: string) => `\\times 10^{${fromSup(sup)}}`)
    // bare exponent: 20!·3¹⁹·30!·2²⁷
    .replace(/(\d)([⁰-⁹]+)/g, (_m, base: string, sup: string) => `${base}^{${fromSup(sup)}}`)
    // mid-dot → \cdot
    .replace(/·/g, ' \\cdot ');
}

function formatDiameter(p: PuzzleEntry): { tex?: string; text?: string } {
  const d = primaryDiameter(p);
  if (d.status === 'exact') return { text: `${d.upper}` };
  if (d.status === 'parametric') return { tex: `20 \\cdot k` };
  if (d.lower != null && d.upper != null) return { text: `${d.lower}–${d.upper}` };
  return { tex: `\\le ${d.upper}` };
}

function statusBadge(p: PuzzleEntry, isZh: boolean): { label: string; cls: string } {
  const d = primaryDiameter(p);
  if (d.status === 'exact') return { label: tr({ zh: '已证', en: 'Proven',
      zhHant: "已證"
}), cls: 'is-exact' };
  if (d.status === 'parametric') return { label: tr({ zh: '平凡', en: 'Trivial' }), cls: 'is-trivial' };
  return { label: tr({ zh: '上下界', en: 'Bounds' }), cls: 'is-bounds' };
}

/* ───── card ───────────────────────────────────────────────────────── */

function PuzzleCard({ p, isZh, expanded, onToggle }: {
  p: PuzzleEntry; isZh: boolean; expanded: boolean; onToggle: () => void;
}) {
  const t = (zh: string, en: string, zhHant?: string) => i18n.language === 'zh-Hant' ? (zhHant ?? zh) : (isZh ? zh : en);
  const d = primaryDiameter(p);
  const badge = statusBadge(p, isZh);

  return (
    <article className={`god-card ${expanded ? 'is-expanded' : ''}`}>
      <header className="god-card-head" onClick={onToggle}>
        <div className="god-card-icon">
          {p.puzzleSize ? (
            <VisualCube algorithm="" view="iso" puzzleSize={p.puzzleSize} size={56} alt={p.name.en} />
          ) : (
            <EventIcon event={p.id} className="god-card-cubing-icon" />
          )}
        </div>
        <div className="god-card-titleblock">
          <div className="god-card-title">
            <EventIcon event={p.id} className="god-card-eventicon" />
            <span>{(i18n.language === 'zh-Hant' ? (p.name.zhHant ?? p.name.zh) : (i18n.language.startsWith('zh') ? p.name.zh : p.name.en))}</span>
          </div>
          <div className="god-card-states"><TeX src={`|G| = ${sciToTex(p.states.sci)}`} />{p.states.pretty && (
            <span className="god-card-states-extra"> · {(i18n.language === 'zh-Hant' ? (p.states.pretty.zhHant ?? p.states.pretty.zh) : (i18n.language.startsWith('zh') ? p.states.pretty.zh : p.states.pretty.en))}</span>
          )}</div>
        </div>
        <div className="god-card-d-block">
          <div className={`god-card-badge ${badge.cls}`}>{badge.label}</div>
          <div className="god-card-d-num">
            {(() => {
              const f = formatDiameter(p);
              return f.tex ? <TeX src={f.tex} /> : f.text;
            })()}
            <span className="god-card-d-metric">{d.metric}</span>
          </div>
        </div>
      </header>

      {expanded && (
        <div className="god-card-body">
          <p className="god-card-blurb"><MathText>{(i18n.language === 'zh-Hant' ? (p.blurb.zhHant ?? p.blurb.zh) : (i18n.language.startsWith('zh') ? p.blurb.zh : p.blurb.en))}</MathText></p>

          {DEEP[p.id] && (
            <div className="god-card-deep">
              {DEEP[p.id].heading && (
                <h4 className="god-card-deep-h">{(i18n.language.startsWith('zh') ? DEEP[p.id].heading!.zh : DEEP[p.id].heading!.en)}</h4>
              )}
              {DEEP[p.id].paragraphs.map((para, i) => (
                <p key={i} className="god-card-deep-p"><MathText>{(i18n.language === 'zh-Hant' ? (para.zhHant ?? para.zh) : (i18n.language.startsWith('zh') ? para.zh : para.en))}</MathText></p>
              ))}
            </div>
          )}

          {p.diameters.length > 1 && (
            <div className="god-card-metrics">
              <div className="god-card-metrics-h">{t('其它度量', 'Other metrics')}</div>
              <ul className="god-card-metrics-list">
                {p.diameters.slice(1).map((m, i) => (
                  <li key={i}>
                    <span className="god-card-metric-tag">{m.metric}</span>
                    <span className="god-card-metric-val">
                      {m.status === 'exact'
                        ? m.upper
                        : (m.lower != null ? `${m.lower}–${m.upper}` : <TeX src={`\\le ${m.upper}`} />)}
                    </span>
                    {m.note && <span className="god-card-metric-note">— {(i18n.language === 'zh-Hant' ? (m.note.zhHant ?? m.note.zh) : (i18n.language.startsWith('zh') ? m.note.zh : m.note.en))}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {d.by && (
            <div className="god-card-meta">
              <span className="god-card-meta-l">{t('证明 / 估算者', 'Proved / estimated by', "證明 / 估算者")}:</span>
              <span>{d.by}</span>
              {d.year && <span className="god-card-year"> · {d.year}</span>}
            </div>
          )}

          <ul className="god-card-refs">
            {p.refs.map((r, i) => (
              <li key={i}>
                <a href={r.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink size={13} />
                  <span>{r.label}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

/* ───── timeline ───────────────────────────────────────────────────── */

interface Milestone { year: number; zh: ReactNode; en: ReactNode; cls?: string }
const MILESTONES: Milestone[] = [
  { year: 1974, zh: <>Ernő Rubik 在布达佩斯发明"魔方"。最初用作教学具,演示三维结构、空间想象与组合学。</>, en: <>Ernő Rubik invents the Magic Cube in Budapest as a teaching aid for 3-D structure, spatial reasoning, and combinatorics.</> },
  { year: 1979, zh: <>魔方上市为大众玩具;西方数学家立刻意识到它是"<TeX src="4.3 \times 10^{19}" /> 阶的有限群"。</>, en: <>Cube hits commercial shelves; Western mathematicians immediately recognise it as a finite group of order <TeX src="4.3 \times 10^{19}" />.</> },
  { year: 1981, zh: <>David Singmaster 出版《Notes on Rubik's Magic Cube》——首次系统化记号(URFDLB) + 群论术语,为后来所有研究奠基。</>, en: <>David Singmaster publishes Notes on Rubik's Magic Cube — the first systematic notation (URFDLB) and group-theoretic terminology underpinning everything since.</> },
  { year: 1981, zh: <>2×2 / Pyraminx / Skewb 的 BFS 在第一代 PC 上跑通 ⇒ 各自直径 11(三个不同群恰好同直径)。</>, en: <>2×2 / Pyraminx / Skewb BFS feasible on early PCs ⇒ each diameter is 11 (a coincidence across three different groups).</>, cls: 'is-multi' },
  { year: 1982, zh: <>Morwen Thistlethwaite 公布 4-phase 算法:<TeX src="G_{0} \to G_{1} \to G_{2} \to G_{3} \to \{e\}" />,每阶段查预计算表,上界 <TeX src="\le 52" /> HTM。</>, en: <>Morwen Thistlethwaite publishes the 4-phase algorithm: <TeX src="G_{0} \to G_{1} \to G_{2} \to G_{3} \to \{e\}" />, each phase from a precomputed table, capping 3×3 at <TeX src="\le 52" /> HTM.</> },
  { year: 1990, zh: <>Hans Kloosterman 把上界压到 42 步;同年多位作者将其压到 40-37。</>, en: <>Hans Kloosterman tightens the upper bound to 42; several authors that year reach 40-37.</> },
  { year: 1992, zh: <>Herbert Kociemba 发表 2-phase 算法,引入子群 <TeX src="H = \langle U, D, L^{2}, R^{2}, F^{2}, B^{2} \rangle" />(他叫 P1 或 <TeX src="G_{1}" />);把 3×3 切成 22 亿陪集,每个陪集 <TeX src="\le 30" /> HTM,合计上界 <TeX src="\le 30" />。</>, en: <>Herbert Kociemba publishes the 2-phase algorithm with <TeX src="H = \langle U, D, L^{2}, R^{2}, F^{2}, B^{2} \rangle" /> (his "P1" / "<TeX src="G_{1}" />"): 2.2 billion cosets, each <TeX src="\le 30" /> HTM, total <TeX src="\le 30" />.</> },
  { year: 1995, zh: <>Michael Reid 用计算机辅助穷举证明 superflip 需 <TeX src="\ge 20" /> 步 ⇒ 3×3 下界跳到 20,并证 Kociemba 上界 <TeX src="\le 22" />。下界 20 / 上界 22 这个 2-步缝隙将持续 15 年。</>, en: <>Michael Reid uses computer-assisted enumeration to prove superflip needs <TeX src="\ge 20" /> ⇒ 3×3 lower bound = 20; also proves Kociemba's bound <TeX src="\le 22" />. The 20/22 gap stands for 15 years.</> },
  { year: 2005, zh: <>Mike Masonjones 用 BFS 证 Square-1 twist metric 直径 = 13。</>, en: <>Mike Masonjones BFS-proves Square-1 twist-metric diameter = 13.</> },
  { year: 2006, zh: <>Silviu Radu 把三阶上界压到 27;次年(2007)Rokicki 加入研究,压到 26。</>, en: <>Silviu Radu pushes 3×3 upper bound to 27; Rokicki joins in 2007 and gets it to 26.</> },
  { year: 2008, zh: <>Tomas Rokicki 用 Sun 的 8GB 集群把上界一路压到 22 步 —— Reid 1995 的目标终于达到,但还没合拢。</>, en: <>Tomas Rokicki uses Sun's 8-GB cluster to drop the upper bound to 22 — finally reaching Reid's 1995 target, but the gap is not closed.</> },
  { year: 2010, zh: <>Rokicki · Kociemba · Davidson · Dethridge 在 Google 跑 35 CPU-年,把 22 亿陪集用对称压到 5588 万,再用集合覆盖压到 ~80 个 super-cosets。每个 super-coset 实际求解,无反例。2010-07-13 宣布:3×3 HTM 直径 = 20。</>, en: <>Rokicki · Kociemba · Davidson · Dethridge spend 35 CPU-years on Google: symmetry compresses 2.2B cosets to 55.88M, set-cover absorbs neighbours into ~80 super-cosets, each actually solved. No counterexample. 2010-07-13: 3×3 HTM diameter = 20.</>, cls: 'is-major' },
  { year: 2011, zh: <>Erik Demaine 等人 (arXiv:1106.5736 "Algorithms for Solving Rubik's Cubes") 证 <TeX src="N \times N" /> 魔方上帝之数 = <TeX src="\Theta(N^{2}/\log N)" />,通过并行子算法 + cubie 对易类划分。这是 <TeX src="N \times N" /> 渐近的严格证明。</>, en: <>Erik Demaine et al. (arXiv:1106.5736 "Algorithms for Solving Rubik's Cubes") prove <TeX src="N \times N" /> God's number is <TeX src="\Theta(N^{2}/\log N)" /> via parallel sub-algorithms + cubie commuting-class partitioning. The rigorous <TeX src="N \times N" /> asymptotic.</> },
  { year: 2012, zh: <>Herbert Kociemba 用对易面计数证 Megaminx 下界 = 48 HTM。</>, en: <>Herbert Kociemba proves Megaminx lower bound = 48 HTM via commuting-faces counting.</> },
  { year: 2014, zh: <>Rokicki & Davidson 用同套陪集框架证 3×3 QTM 直径 = 26;Jakob Kogler 用 front-cross 陪集证 Rubik's Clock 直径 = 12;Rokicki 单独证 3×3 STM 直径 = 18。一年三个新精确直径。</>, en: <>Rokicki & Davidson prove 3×3 QTM diameter = 26 with the same coset framework; Jakob Kogler proves Rubik's Clock diameter = 12 via front-cross cosets; Rokicki separately proves 3×3 STM diameter = 18. Three new exact diameters in one year.</>, cls: 'is-major' },
  { year: 2017, zh: <>Shuang Chen (WCA 2008CHEN27) 用 722 GB 磁盘 BFS + 3816 对称陪集,证 Square-1 face-turn 直径 = 31。磁盘 BFS 第一次在 cube 领域达到这种规模。</>, en: <>Shuang Chen (WCA 2008CHEN27) uses 722 GB disk BFS + 3816 symmetry cosets to prove Square-1 face-turn diameter = 31. The first cubing-domain disk-BFS at this scale.</> },
  { year: 2018, zh: <>Sebastiano Tronto 与 Vincent Sheu 在 SpeedSolving 公布 4×4 OBTM 下界 <TeX src="\ge 35" />。</>, en: <>Sebastiano Tronto and Vincent Sheu publish the 4×4 OBTM lower bound <TeX src="\ge 35" /> on SpeedSolving.</> },
  { year: 2020, zh: <>Graham Siggins 创下 MBLD 世界纪录 62/65。MBLD 群论上完全平凡(<TeX src="20 \cdot k" /> 直径),记录是记忆 + 体力的极限。</>, en: <>Graham Siggins sets the MBLD world record 62/65. MBLD is group-theoretically trivial (diameter <TeX src="20 \cdot k" />); the record is a memory + endurance limit.</> },
  { year: 2022, zh: <>Yusheng Du 三阶 4.86s WR(已被 Yiheng Wang 4.86 平 + 后续超越),平均解 ~40 HTM,远高于 20 的理论最优。</>, en: <>Yusheng Du sets 3×3 WR at 4.86s (later tied / surpassed by Yiheng Wang), avg solution ~40 HTM, far above the 20 theoretical optimum.</> },
  { year: 2024, zh: <>Merino & Subercaseaux (arXiv:2501.00144) 提出"Demigod's number" —— 用 500k 随机样本 + Hoeffding 在 5 小时内证 <TeX src="D \le 36" />,误证概率 <TeX src="< 10^{-10}" />。详见 <Link href="/math/demigod" style={{ color: 'var(--accent)', textDecoration: 'none', borderBottom: '1px dotted currentColor' }}>专门页面</Link>。</>, en: <>Merino & Subercaseaux (arXiv:2501.00144) propose a "Demigod's number" — 500k random samples + Hoeffding prove <TeX src="D \le 36" /> in 5 hours, error probability <TeX src="< 10^{-10}" />. <Link href="/math/demigod" style={{ color: 'var(--accent)', textDecoration: 'none', borderBottom: '1px dotted currentColor' }}>Dedicated page</Link>.</> },
  { year: 2025, zh: <>cube20.org 发布 Rubik's Clock 完整距离分布,作为 2014 Kogler 证明的 11 年后独立复核。</>, en: <>cube20.org publishes Rubik's Clock full distance distribution as an independent re-verification of Kogler's 2014 proof, 11 years on.</> },
];

/* ───── page ───────────────────────────────────────────────────────── */

export default function GodNumberPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  useDocumentTitle('上帝之数', "God's Number", "上帝之數");
  const t = (zh: string, en: string, zhHant?: string) => i18n.language === 'zh-Hant' ? (zhHant ?? zh) : (isZh ? zh : en);

  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(['333', '222']));
  const toggle = (id: string) => setExpanded((s) => {
    const ns = new Set(s);
    if (ns.has(id)) ns.delete(id); else ns.add(id);
    return ns;
  });

  const orderedPuzzles = useMemo(() => {
    const map = new Map(PUZZLES.map((p) => [p.id, p]));
    return WCA_EVENT_ORDER.map((id) => map.get(id)).filter(Boolean) as PuzzleEntry[];
  }, []);

  return (
    <div className="god-page">
      <header className="god-header">
        <Link href="/math" className="god-back">
          <ArrowLeft size={16} />
          <span>{t('返回数学', 'Back to math hub', "返回數學")}</span>
        </Link>
      </header>

      <main className="god-main">
        {/* ────────────── HERO ────────────── */}
        <section className="god-hero">
          <div className="god-hero-eyebrow">{t('数学:扭计群论', 'Mathematics: combinatorial group theory', "數學:扭計群論")}</div>
          <h1 className="god-title">
            {t('上帝之数 ', "God's Number ", "上帝之數 ")}
            <span className="god-title-zh">{t('— 全 WCA 项目', '— across every WCA puzzle', "— 全 WCA 項目")}</span>
          </h1>
          <p className="god-lead">
            {i18n.language === 'zh-Hant' ? ((
                                    <>"上帝之數"是一個魔方解魔方所需的最少步數中最大的那個 —— 也就是這個魔方"最難的狀態"。形式化講,它就是 Cayley 圖的直徑:在群 <TeX src="G" /> 與生成元集 <TeX src="S" /> 下,起點 <TeX src="e" /> 到任意點 <TeX src="g" /> 的最短路徑長度的最大值。下面把 17 個 WCA 項目的直徑(精確或上下界)一一列出。</>
                                  )) : (isZh ? (
                                    <>"上帝之数"是一个魔方解魔方所需的最少步数中最大的那个 —— 也就是这个魔方"最难的状态"。形式化讲,它就是 Cayley 图的直径:在群 <TeX src="G" /> 与生成元集 <TeX src="S" /> 下,起点 <TeX src="e" /> 到任意点 <TeX src="g" /> 的最短路径长度的最大值。下面把 17 个 WCA 项目的直径(精确或上下界)一一列出。</>
                                  ) : (
                                    <>God's number is the maximum, over all states, of the minimum moves to solve. Formally it is the diameter of the Cayley graph of the puzzle group <TeX src="G" /> with generator set <TeX src="S" />. Below, every WCA puzzle is listed with its exact diameter or current bounds.</>
                                  ))}
          </p>

          {/* 关键公式 */}
          <div className="god-formula-block">
            <TeXBlock src={`D(G,\\, S) \\;=\\; \\max_{g \\in G}\\; \\min_{\\substack{w \\in S^{*} \\\\ w \\cdot e \\,=\\, g}}\\, |w|`} />
            <div className="god-formula-cap">
              {i18n.language === 'zh-Hant' ? ((
                                          <><TeX src="G" /> = 魔方群,<TeX src="S" /> = 合法轉動生成元,<TeX src="|w|" /> = 步數(按所選度量)</>
                                        )) : (isZh ? (
                                          <><TeX src="G" /> = 魔方群,<TeX src="S" /> = 合法转动生成元,<TeX src="|w|" /> = 步数(按所选度量)</>
                                        ) : (
                                          <><TeX src="G" /> = puzzle group, <TeX src="S" /> = legal generating moves, <TeX src="|w|" /> = word length (under the chosen metric)</>
                                        ))}
            </div>
          </div>
        </section>

        {/* ────────────── HIGHLIGHTS ────────────── */}
        <section className="god-highlights">
          <div className="god-hl-card">
            <div className="god-hl-num">20</div>
            <div className="god-hl-cap">{t('三阶 HTM 直径(精确)', '3×3 HTM diameter (exact)', "三階 HTM 直徑(精確)")}</div>
            <div className="god-hl-sub">Rokicki et al. 2010</div>
          </div>
          <div className="god-hl-card">
            <div className="god-hl-num">26</div>
            <div className="god-hl-cap">{t('三阶 QTM 直径(精确)', '3×3 QTM diameter (exact)', "三階 QTM 直徑(精確)")}</div>
            <div className="god-hl-sub">Rokicki & Davidson 2014</div>
          </div>
          <div className="god-hl-card">
            <div className="god-hl-num">35 CPU·yr</div>
            <div className="god-hl-cap">{t('Google 集群跑掉的算力', 'Google compute spent on the proof', "Google 叢集跑掉的算力")}</div>
            <div className="god-hl-sub">55.88M cosets · <TeX src="4.3 \times 10^{19}" /> states</div>
          </div>
          <div className="god-hl-card">
            <div className="god-hl-num"><TeX src="\Theta(N^{2}/\log N)" /></div>
            <div className="god-hl-cap">{i18n.language === 'zh-Hant' ? (<><TeX src="N \times N" /> 上帝之數漸近 (Demaine 2011)</>) : (isZh ? <><TeX src="N \times N" /> 上帝之数渐近 (Demaine 2011)</> : <><TeX src="N \times N" /> God's number asymptotic (Demaine 2011)</>)}</div>
            <div className="god-hl-sub">arXiv:1106.5736</div>
          </div>
        </section>

        {/* ────────────── READING ROADMAP ────────────── */}
        <section className="god-section">
          <h2>{t('阅读路线', 'Reading roadmap', "閱讀路線")}</h2>
          <p className="god-sec-lead">{t(
            '本页从浅入深分 13 节,每节都可独立阅读。下面给一份"首次阅读建议路线"和一份"按兴趣跳读"。',
            "The page has 13 sections, each readable in isolation. Below: a 'first-time' linear path and a 'by interest' jump-table.", "本頁從淺入深分 13 節,每節都可獨立閱讀。下面給一份\"首次閱讀建議路線\"和一份\"按興趣跳讀\"。"
          )}</p>
          <div className="god-roadmap">
            <div className="god-roadmap-col">
              <h3>{t('第一次读 (~15 分钟)', 'First read (~15 min)', "第一次讀 (~15 分鐘)")}</h3>
              <ol className="god-roadmap-ol">
                <li><b>{t('群论速通', 'Primer', "群論速通")}</b> — {t('搞懂"群、生成元、Cayley 图、直径"四个词', 'understand the four words: group / generators / Cayley graph / diameter', "搞懂\"群、生成元、Cayley 圖、直徑\"四個詞")}</li>
                <li><b>{t('度量切换', 'Metrics', "度量切換")}</b> — {t('明白 HTM vs QTM vs STM 之差', 'see why HTM ≠ QTM ≠ STM')}</li>
                <li><b>{t('17 项目网格', '17-puzzle grid', "17 項目網格")}</b> — {t('扫一眼,知道哪些精确、哪些只有上下界', 'scan: which are proven, which are bounded', "掃一眼,知道哪些精確、哪些只有上下界")}</li>
                <li><b>Superflip</b> — {t('看"最难"那一类状态长什么样', 'see what the "hardest" state actually looks like', "看\"最難\"那一類狀態長什麼樣")}</li>
                <li><b>{t('Rokicki 证明动画', 'Rokicki proof animator', "Rokicki 證明動畫")}</b> — {t('7 帧搞懂 2010 年那 35 CPU-年到底在算什么', '7 frames: what those 35 CPU-years actually computed', "7 幀搞懂 2010 年那 35 CPU-年到底在算什麼")}</li>
              </ol>
            </div>
            <div className="god-roadmap-col">
              <h3>{t('按兴趣跳读', 'Jump by interest', "按興趣跳讀")}</h3>
              <ul className="god-roadmap-ul">
                <li><span className="god-roadmap-tag">{t('数学', 'Math', "數學")}</span> {t('压缩链 → 阶段算法 → IDA*', 'Compression chain → Subgroup chain → IDA*', "壓縮鏈 → 階段演算法 → IDA*")}</li>
                <li><span className="god-roadmap-tag">{t('算法', 'Algorithm', "演算法")}</span> {t('IDA* 树 → 两阶段求解器 → 算法 8 卡', 'IDA* tree → Two-phase demo → 8 algorithm cards', "IDA* 樹 → 兩階段求解器 → 演算法 8 卡")}</li>
                <li><span className="god-roadmap-tag">{t('动手', 'Hands-on', "動手")}</span> {t('两阶段求解器 → 2×2 BFS → IDA* 滑块', 'Two-phase demo → 2×2 BFS → IDA* slider', "兩階段求解器 → 2×2 BFS → IDA* 滑塊")}</li>
                <li><span className="god-roadmap-tag">{t('历史', 'History', "歷史")}</span> {t('证明动画 → 历史时间线 → 参考资料', 'Proof animator → Timeline → References', "證明動畫 → 歷史時間線 → 參考資料")}</li>
                <li><span className="god-roadmap-tag">{t('数据', 'Data', "資料")}</span> {t('距离分布 → 17 项目网格 → 增长图', 'Distance distribution → 17-puzzle grid → Growth chart', "距離分佈 → 17 項目網格 → 增長圖")}</li>
                <li><span className="god-roadmap-tag">{t('未解', 'Open')}</span> {t('未解之谜 → 4×4 / Megaminx gap', 'Open problems → 4×4 / Megaminx gap', "未解之謎 → 4×4 / Megaminx gap")}</li>
              </ul>
              <p className="god-roadmap-tip">
                {t('💡 提示:页面所有公式可悬停查看 KaTeX 源;蓝色卡片表示"互动",一定要点开看。', '💡 Tip: hover any formula for KaTeX source; blue "interactive" cards reward clicking.', "💡 提示:頁面所有公式可懸停檢視 KaTeX 源;藍色卡片表示\"互動\",一定要點開看。")}
              </p>
            </div>
          </div>
        </section>

        {/* ────────────── GROUP-THEORY PRIMER ────────────── */}
        <section className="god-section">
          <h2>{t('两分钟群论速通', 'Two-minute group-theory primer', "兩分鐘群論速通")}</h2>
          <div className="god-primer-grid">
            <div className="god-primer-cell">
              <h3>{t('1. 魔方是一个群', '1. A cube is a group', "1. 魔方是一個群")}</h3>
              <p>{i18n.language === 'zh-Hant' ? ((
                                          <>每個合法狀態對應一個置換:把 8 個角塊的位置 + 朝向、12 個稜塊的位置 + 朝向打散重排。乘法 = 把兩個操作依次施加。單位元 = "還原態"。逆元 = "反演"。三階魔方的所有狀態構成群 <TeX src="G" />,階 <TeX src="|G| = 4.3 \times 10^{19}" />。</>
                                        )) : (isZh ? (
                                          <>每个合法状态对应一个置换:把 8 个角块的位置 + 朝向、12 个棱块的位置 + 朝向打散重排。乘法 = 把两个操作依次施加。单位元 = "还原态"。逆元 = "反演"。三阶魔方的所有状态构成群 <TeX src="G" />,阶 <TeX src="|G| = 4.3 \times 10^{19}" />。</>
                                        ) : (
                                          <>Every legal state is a permutation: 8 corners (pos + orientation) and 12 edges (pos + orientation) reshuffled. Multiplication = compose two operations. Identity = solved state. Inverse = invert the sequence. All 3×3 states form a group <TeX src="G" /> with <TeX src="|G| = 4.3 \times 10^{19}" />.</>
                                        ))}</p>
            </div>
            <div className="god-primer-cell">
              <h3>{t('2. 生成元 = "你能转的"', '2. Generators = "what you can turn"', "2. 生成元 = \"你能轉的\"")}</h3>
              <p>{i18n.language === 'zh-Hant' ? ((
                                          <>六個 90° 面轉 <TeX src="\{U, D, L, R, F, B\}" /> 與它們的 180° / 反轉構成生成元集 <TeX src="S" />。任何狀態都能寫成 <TeX src="S" /> 中元素的有限乘積 —— 這就是 <TeX src="G" /> 由 <TeX src="S" /> 生成。</>
                                        )) : (isZh ? (
                                          <>六个 90° 面转 <TeX src="\{U, D, L, R, F, B\}" /> 与它们的 180° / 反转构成生成元集 <TeX src="S" />。任何状态都能写成 <TeX src="S" /> 中元素的有限乘积 —— 这就是 <TeX src="G" /> 由 <TeX src="S" /> 生成。</>
                                        ) : (
                                          <>The six 90° face turns <TeX src="\{U, D, L, R, F, B\}" /> plus their inverses / doubles form generator set <TeX src="S" />. Every state is a finite product of elements of <TeX src="S" /> — that's "<TeX src="G" /> is generated by <TeX src="S" />".</>
                                        ))}</p>
            </div>
            <div className="god-primer-cell">
              <h3>{t('3. Cayley 图', '3. The Cayley graph', "3. Cayley 圖")}</h3>
              <p>{i18n.language === 'zh-Hant' ? ((
                                          <>把每個狀態當一個頂點,兩個狀態相差一個生成元就連一條邊。這張圖叫 Cayley 圖 <TeX src="\Gamma(G, S)" />。"解魔方" = 找一條從打亂狀態到單位元的路徑。</>
                                        )) : (isZh ? (
                                          <>把每个状态当一个顶点,两个状态相差一个生成元就连一条边。这张图叫 Cayley 图 <TeX src="\Gamma(G, S)" />。"解魔方" = 找一条从打乱状态到单位元的路径。</>
                                        ) : (
                                          <>Make a vertex for each state; draw an edge between two states differing by one generator. This is the Cayley graph <TeX src="\Gamma(G, S)" />. "Solving" = finding a path from your state to the identity.</>
                                        ))}</p>
            </div>
            <div className="god-primer-cell">
              <h3>{t('4. 直径 = 上帝之数', '4. Diameter = God\'s number', "4. 直徑 = 上帝之數")}</h3>
              <p>{i18n.language === 'zh-Hant' ? ((
                                          <>Cayley 圖裡"最短路徑的最大值"就是直徑 <TeX src="D(G, S)" />。也就是 —— 最壞情況下,最少要幾步才能還原。這就是上帝之數。</>
                                        )) : (isZh ? (
                                          <>Cayley 图里"最短路径的最大值"就是直径 <TeX src="D(G, S)" />。也就是 —— 最坏情况下,最少要几步才能还原。这就是上帝之数。</>
                                        ) : (
                                          <>The maximum, over all pairs of vertices, of the shortest-path length: that's the diameter <TeX src="D(G, S)" />. In other words, worst-case minimum-move count. That's God's number.</>
                                        ))}</p>
            </div>
            <div className="god-primer-cell">
              <h3>{isZh ? <>5. Lagrange 定理 ⇒ 陪集分解</> : <>5. Lagrange ⇒ coset decomposition</>}</h3>
              <p>{i18n.language === 'zh-Hant' ? ((
                                          <>任何子群 <TeX src="H \subset G" /> 都把 <TeX src="G" /> 切成 <TeX src="|G|/|H|" /> 個互不相交的等價類(陪集)。Kociemba 演算法用 <TeX src="H = \langle U, D, L^{2}, R^{2}, F^{2}, B^{2} \rangle" />(<TeX src="|H| \approx 1.95 \times 10^{10}" />)把 <TeX src="4.3 \times 10^{19}" /> 狀態劃成 2,217,093,120 個陪集——每個陪集只需求一次解,數量減少 10 個數量級。</>
                                        )) : (isZh ? (
                                          <>任何子群 <TeX src="H \subset G" /> 都把 <TeX src="G" /> 切成 <TeX src="|G|/|H|" /> 个互不相交的等价类(陪集)。Kociemba 算法用 <TeX src="H = \langle U, D, L^{2}, R^{2}, F^{2}, B^{2} \rangle" />(<TeX src="|H| \approx 1.95 \times 10^{10}" />)把 <TeX src="4.3 \times 10^{19}" /> 状态划成 2,217,093,120 个陪集——每个陪集只需求一次解,数量减少 10 个数量级。</>
                                        ) : (
                                          <>Any subgroup <TeX src="H \subset G" /> partitions <TeX src="G" /> into <TeX src="|G|/|H|" /> disjoint cosets. Kociemba's <TeX src="H = \langle U, D, L^{2}, R^{2}, F^{2}, B^{2} \rangle" /> (<TeX src="|H| \approx 1.95 \times 10^{10}" />) splits <TeX src="4.3 \times 10^{19}" /> states into 2,217,093,120 cosets — solve each once, 10 orders of magnitude saved.</>
                                        ))}</p>
            </div>
            <div className="god-primer-cell">
              <h3>{i18n.language === 'zh-Hant' ? (<>6. 對稱群 <TeX src="S_{48}" /> ⇒ 進一步壓縮</>) : (isZh ? <>6. 对称群 <TeX src="S_{48}" /> ⇒ 进一步压缩</> : <>6. Symmetry group <TeX src="S_{48}" /> ⇒ further squeeze</>)}</h3>
              <p>{i18n.language === 'zh-Hant' ? ((
                                          <>立方體本身有 48 個對稱(24 個旋轉 × 2 映象)。兩個狀態若在對稱下等價,其上帝之數相同。三階 22 億陪集模掉 <TeX src="S_{48}" /> 剩 ~5588 萬——這是 2010 證明的可行規模。</>
                                        )) : (isZh ? (
                                          <>立方体本身有 48 个对称(24 个旋转 × 2 镜像)。两个状态若在对称下等价,其上帝之数相同。三阶 22 亿陪集模掉 <TeX src="S_{48}" /> 剩 ~5588 万——这是 2010 证明的可行规模。</>
                                        ) : (
                                          <>The cube itself has 48 symmetries (24 rotations × 2 mirror). Two states equivalent under symmetry share a diameter. Quotienting the 2.2B cosets by <TeX src="S_{48}" /> leaves ~55.88M — the feasibility threshold that made the 2010 proof possible.</>
                                        ))}</p>
            </div>
          </div>
        </section>

        {/* ────────────── SUBGROUP CHAIN ────────────── */}
        <section className="god-section">
          <h2>{t('阶段算法 — 互动:Kociemba vs Thistlethwaite', 'Phase algorithms — interactive: Kociemba vs Thistlethwaite', "階段演算法 — 互動:Kociemba vs Thistlethwaite")}</h2>
          <p className="god-sec-lead">{i18n.language === 'zh-Hant' ? ((
                              <>陪集分解的實現方式有兩套主流。Thistlethwaite (1981) 把求解切成 4 個階段,每個階段凍結一個對稱性;Kociemba (1992) 簡化為 2 個階段。下面是兩套子群鏈的對比:每一層顯示 <TeX src="|G_{i}|" /> + 到下一層的陪集數 + 該階段的最壞步數。</>
                            )) : (isZh ? (
                              <>陪集分解的实现方式有两套主流。Thistlethwaite (1981) 把求解切成 4 个阶段,每个阶段冻结一个对称性;Kociemba (1992) 简化为 2 个阶段。下面是两套子群链的对比:每一层显示 <TeX src="|G_{i}|" /> + 到下一层的陪集数 + 该阶段的最坏步数。</>
                            ) : (
                              <>Two main flavours of coset decomposition. Thistlethwaite (1981) splits solving into 4 phases, each freezing one symmetry. Kociemba (1992) simplifies to 2. Below: the subgroup chains side by side, each layer showing <TeX src="|G_{i}|" /> + coset count to next + phase worst-case moves.</>
                            ))}</p>
          <Suspense fallback={<div className="god-loading">…</div>}>
            <SubgroupChain isZh={isZh} />
          </Suspense>
        </section>

        {/* ────────────── COSET COMPRESSION (2010 proof structure) ────────────── */}
        <section className="god-section">
          <h2>{t('2010 证明的压缩链 — 互动:从 4.3×10¹⁹ 走到 80 个 super-coset', 'The 2010 proof\'s compression chain — interactive: 4.3×10¹⁹ down to ~80 super-cosets', "2010 證明的壓縮鏈 — 互動:從 4.3×10¹⁹ 走到 80 個 super-coset")}</h2>
          <p className="god-sec-lead">{i18n.language === 'zh-Hant' ? ((
                              <>2010 年的證明不是"逐狀態掃一遍"。它把 <TeX src="4.3 \times 10^{19}" /> 狀態用 4 層數學結構層層摺疊:Lagrange 陪集 → 立方體對稱商 → 集合覆蓋 → 逐 super-coset IDA* 驗證。每一層用不同的數學工具,合起來讓 35 CPU-年成為可行。</>
                            )) : (isZh ? (
                              <>2010 年的证明不是"逐状态扫一遍"。它把 <TeX src="4.3 \times 10^{19}" /> 状态用 4 层数学结构层层折叠:Lagrange 陪集 → 立方体对称商 → 集合覆盖 → 逐 super-coset IDA* 验证。每一层用不同的数学工具,合起来让 35 CPU-年成为可行。</>
                            ) : (
                              <>The 2010 proof isn't "scan every state". It folds <TeX src="4.3 \times 10^{19}" /> states through 4 mathematical layers: Lagrange cosets → cube-symmetry quotient → set-cover compression → per-super-coset IDA* verification. Each layer pulls in a different tool; together they make 35 CPU-years feasible.</>
                            ))}</p>
          <Suspense fallback={<div className="god-loading">…</div>}>
            <CosetCompression isZh={isZh} />
          </Suspense>
        </section>

        {/* ────────────── TWO-PHASE INTERACTIVE ────────────── */}
        <section className="god-section">
          <h2>{t('两阶段求解器 — 互动:把一次解拆成 Phase 1 + Phase 2', 'Two-phase solver — interactive: split a solve into Phase 1 + Phase 2', "兩階段求解器 — 互動:把一次解拆成 Phase 1 + Phase 2")}</h2>
          <p className="god-sec-lead">{i18n.language === 'zh-Hant' ? ((
                              <>選一個 scramble,看 Kociemba 演算法怎麼先用幾步把狀態推進子群 <TeX src="H = \langle U, D, L^{2}, R^{2}, F^{2}, B^{2}\rangle" />,再在 <TeX src="H" /> 裡把它解掉。播放過程中"4 個不變數條形"會同步走零——這就是"進入 H"的幾何含義。</>
                            )) : (isZh ? (
                              <>选一个 scramble,看 Kociemba 算法怎么先用几步把状态推进子群 <TeX src="H = \langle U, D, L^{2}, R^{2}, F^{2}, B^{2}\rangle" />,再在 <TeX src="H" /> 里把它解掉。播放过程中"4 个不变量条形"会同步走零——这就是"进入 H"的几何含义。</>
                            ) : (
                              <>Pick a scramble and watch how Kociemba's algorithm first pushes the state into the subgroup <TeX src="H = \langle U, D, L^{2}, R^{2}, F^{2}, B^{2}\rangle" />, then solves inside <TeX src="H" />. The "4 invariant bars" drain to zero exactly when Phase 1 ends — that's the geometric meaning of "entering H".</>
                            ))}</p>
          <Suspense fallback={<div className="god-loading">…</div>}>
            <TwoPhaseDemo isZh={isZh} />
          </Suspense>
        </section>

        {/* ────────────── METRIC ────────────── */}
        <section className="god-section">
          <h2>{t('度量决定数字 — 互动:HTM / QTM / STM', 'The metric decides the number — interactive: HTM / QTM / STM', "度量決定數字 — 互動:HTM / QTM / STM")}</h2>
          <p className="god-sec-lead">{t(
            '上帝之数永远是 "图的直径",但图的边怎么连取决于"一步等于什么"。下面这三种度量是文献中最常见的:点 tab 切换,例子里的步会重新计数。',
            'God\'s number is always "graph diameter", but what edges exist depends on what counts as "one move". The three metrics below are the ones you\'ll see in the literature — click to switch, the example re-counts itself.', "上帝之數永遠是 \"圖的直徑\",但圖的邊怎麼連取決於\"一步等於什麼\"。下面這三種度量是文獻中最常見的:點 tab 切換,例子裡的步會重新計數。"
          )}</p>
          <Suspense fallback={<div className="god-loading">…</div>}>
            <MetricExplainer isZh={isZh} />
          </Suspense>
        </section>

        {/* ────────────── PUZZLES GRID ────────────── */}
        <section className="god-section">
          <h2>{t('全 WCA 项目的上帝之数', "God's number for every WCA event", "全 WCA 項目的上帝之數")}</h2>
          <p className="god-sec-lead">{t(
            '点任意卡片展开详情(算法、证明者、参考资料)。"已证"卡片有精确值;"上下界"卡片只有当前最好的上下界 —— 它们之间还存在缝隙,等待被合上。',
            'Click any card to expand details (algorithm, prover, references). "Proven" cards have exact values; "Bounds" cards show the best known gap, waiting to be closed.', "點任意卡片展開詳情(演算法、證明者、參考資料)。\"已證\"卡片有精確值;\"上下界\"卡片只有當前最好的上下界 —— 它們之間還存在縫隙,等待被合上。"
          )}</p>
          <div className="god-grid">
            {orderedPuzzles.map((p) => (
              <PuzzleCard key={p.id}
                          p={p}
                          isZh={isZh}
                          expanded={expanded.has(p.id)}
                          onToggle={() => toggle(p.id)} />
            ))}
          </div>
          <div className="god-grid-legend">
            <span><i className="god-dot is-exact" /> {t('已证精确值', 'Proven exact', "已證精確值")}</span>
            <span><i className="god-dot is-bounds" /> {t('只有上下界', 'Bounds only')}</span>
            <span><i className="god-dot is-trivial" /> {t('平凡 / 参数化', 'Trivial / parametric', "平凡 / 引數化")}</span>
          </div>
        </section>

        {/* ────────────── 3×3 DISTANCE DISTRIBUTION ────────────── */}
        <section className="god-section">
          <h2>{t('三阶最少步分布 — 互动:FMC 的天花板', '3×3 minimum-solution distribution — interactive: the FMC ceiling', "三階最少步分佈 — 互動:FMC 的天花板")}</h2>
          <p className="god-sec-lead">{i18n.language === 'zh-Hant' ? ((
                              <>把"距離 <TeX src="d" /> (HTM) 處有多少個三階狀態"畫出來,就是 FMC 選手實質要面對的"最少步分佈"。Rokicki 團隊公佈了 <TeX src="d = 0, \ldots, 15" /> 的精確值;<TeX src="d = 16, \ldots, 20" /> 因總和被 <TeX src="4.3 \times 10^{19}" /> 約束,只有估算。</>
                            )) : (isZh ? (
                              <>把"距离 <TeX src="d" /> (HTM) 处有多少个三阶状态"画出来,就是 FMC 选手实质要面对的"最少步分布"。Rokicki 团队公布了 <TeX src="d = 0, \ldots, 15" /> 的精确值;<TeX src="d = 16, \ldots, 20" /> 因总和被 <TeX src="4.3 \times 10^{19}" /> 约束,只有估算。</>
                            ) : (
                              <>Plot "how many 3×3 states are at distance <TeX src="d" /> (HTM)" and you get the distribution every FMC solver implicitly faces. Rokicki has published exact counts for <TeX src="d = 0, \ldots, 15" />; <TeX src="d = 16, \ldots, 20" /> are estimates constrained by the total sum <TeX src="4.3 \times 10^{19}" />.</>
                            ))}</p>
          <Suspense fallback={<div className="god-loading">…</div>}>
            <DistanceDistribution isZh={isZh} />
          </Suspense>
        </section>

        {/* ────────────── SUPERFLIP ────────────── */}
        <section className="god-section">
          <h2>{t('Superflip — 三阶上"最难"的状态', 'Superflip — the "hardest" 3×3 state', "Superflip — 三階上\"最難\"的狀態")}</h2>
          <p className="god-sec-lead">{t(
            '1995 年 Michael Reid 证明 superflip 需要恰好 20 HTM,把三阶下界推到 20;2010 年 Rokicki 团队证上界也是 20,合拢。下面渲染 superflip 的三维状态,给出两条最优解,并列出另外几个 distance-20 antipode 的代表。',
            'In 1995 Michael Reid proved superflip needs exactly 20 HTM, pushing the 3×3 lower bound to 20; in 2010 Rokicki\'s team proved the upper bound is also 20, closing the gap. Below: the 3-D superflip state, two optimal solutions, and a few other distance-20 antipode representatives.', "1995 年 Michael Reid 證明 superflip 需要恰好 20 HTM,把三階下界推到 20;2010 年 Rokicki 團隊證上界也是 20,合攏。下面渲染 superflip 的三維狀態,給出兩條最優解,並列出另外幾個 distance-20 antipode 的代表。"
          )}</p>
          <Suspense fallback={<div className="god-loading">…</div>}>
            <SuperflipShowcase isZh={isZh} />
          </Suspense>
        </section>

        {/* ────────────── GROWTH ────────────── */}
        <section className="god-section">
          <h2>{t('NxN 增长 — 互动:状态空间 vs 上帝之数', 'N×N growth — interactive: state space vs diameter', "NxN 增長 — 互動:狀態空間 vs 上帝之數")}</h2>
          <p className="god-sec-lead">{i18n.language === 'zh-Hant' ? ((
                              <>左軸 <TeX src="|G(N)|" /> 走雙指數級 (<TeX src="\sim 10^{N^{2}}" />),右軸上帝之數走多項式 / 多項式·對數。兩者的比就是"難度密度"。滑鼠懸停某個 <TeX src="N" /> 看具體值。</>
                            )) : (isZh ? (
                              <>左轴 <TeX src="|G(N)|" /> 走双指数级 (<TeX src="\sim 10^{N^{2}}" />),右轴上帝之数走多项式 / 多项式·对数。两者的比就是"难度密度"。鼠标悬停某个 <TeX src="N" /> 看具体值。</>
                            ) : (
                              <>Left axis grows double-exponentially (<TeX src="\sim 10^{N^{2}}" />); right axis grows polynomially with a log shave. Their ratio is the "difficulty density". Hover an <TeX src="N" /> for exact values.</>
                            ))}</p>
          <Suspense fallback={<div className="god-loading">…</div>}>
            <GrowthChart isZh={isZh} />
          </Suspense>
        </section>

        {/* ────────────── BFS ────────────── */}
        <section className="god-section">
          <h2>{t('2×2 现场 BFS — 你来证一遍 "直径 = 11"', '2×2 live BFS — re-prove "diameter = 11" yourself', "2×2 現場 BFS — 你來證一遍 \"直徑 = 11\"")}</h2>
          <p className="god-sec-lead">{i18n.language === 'zh-Hant' ? ((
                              <>2×2 群只有 367 萬狀態,一臺筆記本幾秒內 BFS 完整張圖,無需對稱壓縮 / 陪集 / GPU。下面這個按鈕在你瀏覽器裡 spawn 一個 worker 跑完所有 9 個 HTM 生成元 (<span className="god-mono">U U2 U' R R2 R' F F2 F'</span>) 的廣搜,並實時畫距離分佈。</>
                            )) : (isZh ? (
                              <>2×2 群只有 367 万状态,一台笔记本几秒内 BFS 完整张图,无需对称压缩 / 陪集 / GPU。下面这个按钮在你浏览器里 spawn 一个 worker 跑完所有 9 个 HTM 生成元 (<span className="god-mono">U U2 U' R R2 R' F F2 F'</span>) 的广搜,并实时画距离分布。</>
                            ) : (
                              <>The 2×2 group has only 3.67M states — a laptop BFSes the whole graph in seconds without symmetry / cosets / GPU. The button below spawns a worker that runs full BFS over the 9 HTM generators (<span className="god-mono">U U2 U' R R2 R' F F2 F'</span>) and streams the distance distribution to the chart.</>
                            ))}</p>
          <Suspense fallback={<div className="god-loading">…</div>}>
            <Bfs2x2Demo isZh={isZh} />
          </Suspense>
        </section>

        {/* ────────────── ALGO ────────────── */}
        <section className="god-section">
          <h2>{t('它们是怎么算出来的?', 'How are these numbers actually computed?', "它們是怎麼算出來的?")}</h2>
          <p className="god-sec-lead">{t(
            '8 种实战技术,从最简单的"扫一遍"到最大的"用对称结构吞掉对称等价类"。每种适合的群规模不同,下面按规模排:',
            'Eight real-world techniques, ordered by group size — from "BFS the lot" to "symmetry-quotient your way to feasibility".', "8 種實戰技術,從最簡單的\"掃一遍\"到最大的\"用對稱結構吞掉對稱等價類\"。每種適合的群規模不同,下面按規模排:"
          )}</p>
          <div className="god-algo-grid">
            <div className="god-algo-cell">
              <div className="god-algo-name">BFS</div>
              <div className="god-algo-desc">{i18n.language === 'zh-Hant' ? ((
                                          <>小群 (<TeX src="\le 10^{8}" />) 直接廣搜整張圖,1 位元組/state 存距離,幾秒-幾分鐘內得到完整分佈 + 直徑。本頁 "2×2 現場 BFS" 就是瀏覽器跑這個,Pyraminx / Skewb / Sq-1 (twist) 也都這麼算。</>
                                        )) : (isZh ? (
                                          <>小群 (<TeX src="\le 10^{8}" />) 直接广搜整张图,1 字节/state 存距离,几秒-几分钟内得到完整分布 + 直径。本页 "2×2 现场 BFS" 就是浏览器跑这个,Pyraminx / Skewb / Sq-1 (twist) 也都这么算。</>
                                        ) : (
                                          <>Tiny groups (<TeX src="\le 10^{8}" />): plain BFS over the whole graph, 1 byte/state for distance, full distribution + diameter in seconds-to-minutes. The "2×2 live BFS" above is exactly this. Pyraminx, Skewb, Sq-1 (twist) too.</>
                                        ))}</div>
            </div>
            <div className="god-algo-cell">
              <div className="god-algo-name">{t('双向 BFS', 'Bidirectional BFS', "雙向 BFS")}</div>
              <div className="god-algo-desc">{i18n.language === 'zh-Hant' ? ((
                                          <>從起點和終點同時 BFS,在中點會合 ⇒ 總搜尋空間從 <TeX src="b^{d}" /> 降到 <TeX src="2 \cdot b^{d/2}" />。Sq-1 twist 用過;通用 IDA* 求解器也用類似思路。</>
                                        )) : (isZh ? (
                                          <>从起点和终点同时 BFS,在中点会合 ⇒ 总搜索空间从 <TeX src="b^{d}" /> 降到 <TeX src="2 \cdot b^{d/2}" />。Sq-1 twist 用过;通用 IDA* 求解器也用类似思路。</>
                                        ) : (
                                          <>BFS from both ends, meet in the middle ⇒ search space drops from <TeX src="b^{d}" /> to <TeX src="2 \cdot b^{d/2}" />. Used for Sq-1 twist; the same trick powers many general IDA* solvers.</>
                                        ))}</div>
            </div>
            <div className="god-algo-cell">
              <div className="god-algo-name">IDA* + Pattern Database</div>
              <div className="god-algo-desc">{i18n.language === 'zh-Hant' ? ((
                                          <>中型群 (<TeX src="10^{9}\text{--}10^{12}" />):預計算某一組 cubie (e.g. "所有 corner") 的最短解距離表(佔幾百 MB),作為整體解的 admissible 下界 (heuristic <TeX src="h(s) \le d^{*}(s)" />)。主搜尋用 Iterative Deepening A* + 這個 <TeX src="h" />,效果碾壓純 BFS。Kociemba's P1/P2 表就是 PDB 的經典例子。</>
                                        )) : (isZh ? (
                                          <>中型群 (<TeX src="10^{9}\text{--}10^{12}" />):预计算某一组 cubie (e.g. "所有 corner") 的最短解距离表(占几百 MB),作为整体解的 admissible 下界 (heuristic <TeX src="h(s) \le d^{*}(s)" />)。主搜索用 Iterative Deepening A* + 这个 <TeX src="h" />,效果碾压纯 BFS。Kociemba's P1/P2 表就是 PDB 的经典例子。</>
                                        ) : (
                                          <>Mid-sized groups (<TeX src="10^{9}\text{--}10^{12}" />): precompute the shortest-solution table for a subset of cubies (e.g. all corners) — a few hundred MB — and use it as an admissible heuristic <TeX src="h(s) \le d^{*}(s)" /> for the full problem. Iterative Deepening A* + this <TeX src="h" /> crushes plain BFS. Kociemba's P1/P2 tables are the canonical example.</>
                                        ))}</div>
            </div>
            <div className="god-algo-cell">
              <div className="god-algo-name">{t('陪集分解 + 集合覆盖', 'Coset partition + set cover', "陪集分解 + 集合覆蓋")}</div>
              <div className="god-algo-desc">{i18n.language === 'zh-Hant' ? ((
                                          <>大群 (<TeX src="10^{19}+" />):按子群 <TeX src="H" /> 把 <TeX src="G" /> 劃成 <TeX src="|G|/|H|" /> 個陪集,每個陪集獨立求解。三階用 <TeX src="H = \langle U, D, L^{2}, R^{2}, F^{2}, B^{2} \rangle" />,<TeX src="|G|/|H| = 2.2 \times 10^{9}" />。再用 set cover 貪心選 ~80 個 super-cosets(每個含若干相鄰陪集),實際只對 super-coset 求解。</>
                                        )) : (isZh ? (
                                          <>大群 (<TeX src="10^{19}+" />):按子群 <TeX src="H" /> 把 <TeX src="G" /> 划成 <TeX src="|G|/|H|" /> 个陪集,每个陪集独立求解。三阶用 <TeX src="H = \langle U, D, L^{2}, R^{2}, F^{2}, B^{2} \rangle" />,<TeX src="|G|/|H| = 2.2 \times 10^{9}" />。再用 set cover 贪心选 ~80 个 super-cosets(每个含若干相邻陪集),实际只对 super-coset 求解。</>
                                        ) : (
                                          <>Huge groups (<TeX src="10^{19}+" />): split <TeX src="G" /> into <TeX src="|G|/|H|" /> cosets of a subgroup <TeX src="H" />, solve each independently. 3×3 uses <TeX src="H = \langle U, D, L^{2}, R^{2}, F^{2}, B^{2} \rangle" />, <TeX src="|G|/|H| = 2.2 \times 10^{9}" />. Then a greedy set-cover packs neighbouring cosets into ~80 super-cosets and you actually solve only those.</>
                                        ))}</div>
            </div>
            <div className="god-algo-cell">
              <div className="god-algo-name">{t('对称 / 反对称压缩', 'Symmetry / antisymmetry reduction', "對稱 / 反對稱壓縮")}</div>
              <div className="god-algo-desc">{i18n.language === 'zh-Hant' ? ((
                                          <>立方體 48 個對稱(24 旋轉 × 2 映象)+ 反對稱(逆元等價)總 96 個等價。兩個等價狀態的最優解長度必相等 ⇒ 一次解全。三階 22 億陪集模掉對稱剩 5588 萬 —— 這 40 倍壓縮是 2010 證明的 enabler。</>
                                        )) : (isZh ? (
                                          <>立方体 48 个对称(24 旋转 × 2 镜像)+ 反对称(逆元等价)总 96 个等价。两个等价状态的最优解长度必相等 ⇒ 一次解全。三阶 22 亿陪集模掉对称剩 5588 万 —— 这 40 倍压缩是 2010 证明的 enabler。</>
                                        ) : (
                                          <>The cube has 48 symmetries (24 rotations × 2 mirrors) plus antisymmetry (inverses are equivalent), 96 total. Equivalent states share their optimal solution length ⇒ solve once, propagate. The 3×3's 2.2B cosets shrink to 55.88M under symmetry — that 40× squeeze is the 2010 proof's enabler.</>
                                        ))}</div>
            </div>
            <div className="god-algo-cell">
              <div className="god-algo-name">{t('磁盘 BFS', 'Disk-based BFS', "磁碟 BFS")}</div>
              <div className="god-algo-desc">{i18n.language === 'zh-Hant' ? ((
                                          <>當 <TeX src="|G|" /> 超過記憶體時,把"前沿"按層批次寫到 SSD,用外存 sort + uniq 跨層去重。Sq-1 face-turn (Shuang Chen 2017) 用了 722 GB——每個狀態壓到 2 bits 才裝得下 <TeX src="1.2 \times 10^{13}" /> 個 twistable states。</>
                                        )) : (isZh ? (
                                          <>当 <TeX src="|G|" /> 超过内存时,把"前沿"按层批量写到 SSD,用外存 sort + uniq 跨层去重。Sq-1 face-turn (Shuang Chen 2017) 用了 722 GB——每个状态压到 2 bits 才装得下 <TeX src="1.2 \times 10^{13}" /> 个 twistable states。</>
                                        ) : (
                                          <>When <TeX src="|G|" /> outgrows RAM, batch-write each frontier layer to SSD; cross-layer dedup via external sort + uniq. Sq-1 face-turn (Shuang Chen 2017) used 722 GB — 2 bits/state to fit <TeX src="1.2 \times 10^{13}" /> twistable states.</>
                                        ))}</div>
            </div>
            <div className="god-algo-cell">
              <div className="god-algo-name">{t('Canonical-sequence 计数 (下界)', 'Canonical-sequence counting (lower bound)', "Canonical-sequence 計數 (下界)")}</div>
              <div className="god-algo-desc">{i18n.language === 'zh-Hant' ? ((
                                          <>不求解,只數 canonical 序列:深度 <TeX src="d" /> 的合法序列數 <TeX src="\le N \cdot M^{d-1}" />(同軸排除後)。Megaminx 用對易面遞推 <TeX src="t(n+1) = 36\, t(n) - 240\, t(n-1) - 320\, t(n-2)" />;讓 <TeX src="t(d) \ge |G|" /> 反推 <TeX src="d" /> 下界。Megaminx 48 / 4×4 35 都是這麼來的。</>
                                        )) : (isZh ? (
                                          <>不求解,只数 canonical 序列:深度 <TeX src="d" /> 的合法序列数 <TeX src="\le N \cdot M^{d-1}" />(同轴排除后)。Megaminx 用对易面递推 <TeX src="t(n+1) = 36\, t(n) - 240\, t(n-1) - 320\, t(n-2)" />;让 <TeX src="t(d) \ge |G|" /> 反推 <TeX src="d" /> 下界。Megaminx 48 / 4×4 35 都是这么来的。</>
                                        ) : (
                                          <>Don't solve, just count: legal canonical sequences at depth <TeX src="d" /> are <TeX src="\le N \cdot M^{d-1}" /> (after rejecting same-axis-as-previous). Megaminx uses a commuting-faces recurrence <TeX src="t(n+1) = 36\, t(n) - 240\, t(n-1) - 320\, t(n-2)" />; set <TeX src="t(d) \ge |G|" /> ⇒ lower bound on <TeX src="d" />. Megaminx 48, 4×4 35 came from here.</>
                                        ))}</div>
            </div>
            <div className="god-algo-cell">
              <div className="god-algo-name">{t('渐近构造 (Demaine)', 'Asymptotic construction (Demaine)', "漸近構造 (Demaine)")}</div>
              <div className="god-algo-desc">{i18n.language === 'zh-Hant' ? ((
                                          <>Demaine 等 2011:把 <TeX src="N \times N" /> 上的所有 cubie 分成 <TeX src="O(N^{2}/\log N)" /> 個 commuting class,每個用並行子演算法 <TeX src="O(\log N)" /> 步內解決。配合 canonical-sequence <TeX src="\Omega(N^{2}/\log N)" /> 下界,得到 <TeX src="\Theta(N^{2}/\log N)" /> 的嚴證。常數很大,只是漸近正確。</>
                                        )) : (isZh ? (
                                          <>Demaine 等 2011:把 <TeX src="N \times N" /> 上的所有 cubie 分成 <TeX src="O(N^{2}/\log N)" /> 个 commuting class,每个用并行子算法 <TeX src="O(\log N)" /> 步内解决。配合 canonical-sequence <TeX src="\Omega(N^{2}/\log N)" /> 下界,得到 <TeX src="\Theta(N^{2}/\log N)" /> 的严证。常数很大,只是渐近正确。</>
                                        ) : (
                                          <>Demaine et al. 2011: partition <TeX src="N \times N" /> cubies into <TeX src="O(N^{2}/\log N)" /> commuting classes; solve each in <TeX src="O(\log N)" /> parallel moves. Match with the canonical-sequence <TeX src="\Omega(N^{2}/\log N)" /> lower bound ⇒ <TeX src="\Theta(N^{2}/\log N)" />, rigorous. Constants are big; only asymptotic.</>
                                        ))}</div>
            </div>
          </div>

          {/* Interactive IDA* tree */}
          <div className="god-algo-ida-block">
            <h3>{t('IDA* + Pattern Database — 互动:启发函数怎么剪枝', 'IDA* + Pattern Database — interactive: how heuristics prune', "IDA* + Pattern Database — 互動:啟發函式怎麼剪枝")}</h3>
            <p className="god-sec-lead" style={{ marginBottom: 12 }}>{i18n.language === 'zh-Hant' ? ((
                                    <>下面是一棵教學版搜尋樹。換"啟發函式 h(s)"或拖 f-閾值,看子樹怎麼被消掉。識別綠色葉子 = 找到 distance-8 解 (本樹深度上限)。剪枝率上去 ⇒ Korf 啟發更緊 ⇒ 搜尋更快。</>
                                  )) : (isZh ? (
                                    <>下面是一棵教学版搜索树。换"启发函数 h(s)"或拖 f-阈值,看子树怎么被消掉。识别绿色叶子 = 找到 distance-8 解 (本树深度上限)。剪枝率上去 ⇒ Korf 启发更紧 ⇒ 搜索更快。</>
                                  ) : (
                                    <>A teaching-scale search tree. Switch the "heuristic h(s)" or drag the f-limit and watch subtrees collapse. Green leaf = a distance-8 solution (tree depth cap). Higher prune-rate ⇒ tighter heuristic ⇒ faster search.</>
                                  ))}</p>
            <Suspense fallback={<div className="god-loading">…</div>}>
              <IdaStarTree isZh={isZh} />
            </Suspense>
          </div>

          {/* IDA* pseudo-code */}
          <div className="god-algo-pseudo">
            <h3>{t('IDA* + Pattern Database 伪代码', 'IDA* + Pattern Database pseudocode', "IDA* + Pattern Database 虛擬碼")}</h3>
            <pre className="god-pseudo-code">{`function solve(start):
  for depth = 0, 1, 2, ..., 20:
    if dfs(start, depth, 0) is not None: return solution
  return None  // unreachable for 3×3 (we know depth ≤ 20)

function dfs(state, max_depth, g):
  h = pattern_db.lookup(state)        // admissible: h ≤ true distance
  if g + h > max_depth: return None
  if state == identity:  return []    // solved
  for move in legal_moves(state):
    if same_axis_as_previous(move): continue
    sub = dfs(apply(state, move), max_depth, g + 1)
    if sub is not None: return [move] + sub
  return None`}</pre>
            <p className="god-algo-pseudo-cap">{i18n.language === 'zh-Hant' ? ((
                                    <>一次 IDA* 求解一個狀態 (毫秒級)。如果對所有 ~5588 萬 super-cosets 都跑一次 IDA* 並保證 <TeX src="\le 20" /> 步,直徑就被壓實 = 20。</>
                                  )) : (isZh ? (
                                    <>一次 IDA* 求解一个状态 (毫秒级)。如果对所有 ~5588 万 super-cosets 都跑一次 IDA* 并保证 <TeX src="\le 20" /> 步,直径就被压实 = 20。</>
                                  ) : (
                                    <>One IDA* call solves one state (milliseconds). Run it on all ~55.88M super-cosets with the assertion <TeX src="\le 20" /> holds — and the diameter is nailed at 20.</>
                                  ))}</p>
          </div>
        </section>

        {/* ────────────── OPEN PROBLEMS ────────────── */}
        <section className="god-section">
          <h2>{t('未解之谜', 'Open problems', "未解之謎")}</h2>
          <p className="god-sec-lead">{t(
            '4 个 / 5 个项目精确直径至今未知。下面把每个未合拢的 gap 拆开来看:为什么难、怎么合拢、估算工作量。',
            "Four/five puzzles have no exact diameter to date. For each unfinished gap: why it's hard, what would close it, rough effort estimate.", "4 個 / 5 個項目精確直徑至今未知。下面把每個未合攏的 gap 拆開來看:為什麼難、怎麼合攏、估算工作量。"
          )}</p>
          <Suspense fallback={<div className="god-loading">…</div>}>
            <OpenProblems isZh={isZh} />
          </Suspense>
        </section>

        {/* ────────────── PROOF ANIMATOR ────────────── */}
        <section className="god-section">
          <h2>{t('两个里程碑证明 — 互动:逐帧讲', 'Two milestone proofs — interactive frame-by-frame', "兩個里程碑證明 — 互動:逐幀講")}</h2>
          <p className="god-sec-lead">{i18n.language === 'zh-Hant' ? ((
                              <>把"上帝之數 = 20"的兩個關鍵證明各拆成幾幀:Reid 1995 (下界 20,用 SGI Indigo 跑 90 小時) + Rokicki 2008→2010 (上界 20,Google 35 CPU-年)。每幀一句話 + 一個 SVG 圖 + 一行公式。</>
                            )) : (isZh ? (
                              <>把"上帝之数 = 20"的两个关键证明各拆成几帧:Reid 1995 (下界 20,用 SGI Indigo 跑 90 小时) + Rokicki 2008→2010 (上界 20,Google 35 CPU-年)。每帧一句话 + 一个 SVG 图 + 一行公式。</>
                            ) : (
                              <>The two key "God's number = 20" proofs split into frames: Reid 1995 (lower bound 20, SGI Indigo 90 hours) + Rokicki 2008→2010 (upper bound 20, Google 35 CPU-years). One sentence + one SVG + one formula per frame.</>
                            ))}</p>
          <Suspense fallback={<div className="god-loading">…</div>}>
            <ProofAnimator isZh={isZh} />
          </Suspense>
        </section>

        {/* ────────────── TIMELINE ────────────── */}
        <section className="god-section">
          <h2>{t('历史时间线', 'Timeline', "歷史時間線")}</h2>
          <ol className="god-timeline">
            {MILESTONES.map((m, i) => (
              <li key={i} className={`god-tl-item ${m.cls || ''}`}>
                <div className="god-tl-year">{m.year}</div>
                <div className="god-tl-dot" />
                <div className="god-tl-body">{(i18n.language.startsWith('zh') ? m.zh : m.en)}</div>
              </li>
            ))}
          </ol>
        </section>

        {/* ────────────── FAQ ────────────── */}
        <section className="god-section">
          <h2>{t('常见问题 + 词汇表', 'FAQ + glossary', "常見問題 + 詞彙表")}</h2>
          <p className="god-sec-lead">{t(
            '10 个常被问到的问题(为什么叫"上帝之数"、WCA 打乱跟它什么关系、CFOP 能达到吗、cube20.org 35 CPU 年放到今天怎么算……)+ 群论 / 算法术语速查表。',
            'Ten common questions ("why this nickname?", "are WCA scrambles near it?", "can CFOP reach 20?", "how much compute is 35 CPU-years today?"…) plus a group-theory / algorithm glossary.', "10 個常被問到的問題(為什麼叫\"上帝之數\"、WCA 打亂跟它什麼關係、CFOP 能達到嗎、cube20.org 35 CPU 年放到今天怎麼算……)+ 群論 / 演算法術語速查表。"
          )}</p>
          <Suspense fallback={<div className="god-loading">…</div>}>
            <FaqSection isZh={isZh} />
          </Suspense>
        </section>

        {/* ────────────── REFERENCES ────────────── */}
        <section className="god-section">
          <h2>{t('参考资料', 'References', "參考資料")}</h2>
          <ul className="god-refs">
            <li><a href="https://www.cube20.org/" target="_blank" rel="noopener noreferrer">cube20.org</a> — {t('Rokicki 团队的总站,所有三阶 / 魔表证明数据 + 完整距离分布', 'Rokicki team\'s hub: 3×3 / Clock proof data + full distance distributions', "Rokicki 團隊的總站,所有三階 / 魔錶證明資料 + 完整距離分佈")}</li>
            <li><a href="https://www.cube20.org/qtm/" target="_blank" rel="noopener noreferrer">cube20.org / QTM</a> — {t('三阶 QTM 直径 = 26 证明数据 (2014)', '3×3 QTM diameter = 26 proof data (2014)', "三階 QTM 直徑 = 26 證明資料 (2014)")}</li>
            <li><a href="https://www.cube20.org/clock/" target="_blank" rel="noopener noreferrer">cube20.org / Clock</a> — {t('Rubik\'s Clock 直径 = 12 与完整分布 (2025-03-04)', 'Rubik\'s Clock diameter = 12 and full distribution (2025-03-04)', "Rubik's Clock 直徑 = 12 與完整分佈 (2025-03-04)")}</li>
            <li><a href="https://epubs.siam.org/doi/abs/10.1137/120867366" target="_blank" rel="noopener noreferrer">Rokicki et al., SIAM J. Discrete Math 2014</a> — {t('同行评议版 "The Diameter of the Rubik\'s Cube Group Is Twenty"', 'Peer-reviewed paper "The Diameter of the Rubik\'s Cube Group Is Twenty"', "同行評議版 \"The Diameter of the Rubik's Cube Group Is Twenty\"")}</li>
            <li><a href="https://arxiv.org/abs/1106.5736" target="_blank" rel="noopener noreferrer">Demaine et al. 2011 — arXiv:1106.5736</a> — <MathText>{t('"Algorithms for Solving Rubik\'s Cubes",NxN 上帝之数 Θ(N²/log N) 严证', '"Algorithms for Solving Rubik\'s Cubes", rigorous Θ(N²/log N) for N×N', "\"Algorithms for Solving Rubik's Cubes\",NxN 上帝之數 Θ(N²/log N) 嚴證")}</MathText></li>
            <li><a href="https://kociemba.org/cube.htm" target="_blank" rel="noopener noreferrer">Herbert Kociemba — Two-phase algorithm</a> — {t('Kociemba 自己的算法描述与实现指南', 'Algorithm description + implementation guide by the author', "Kociemba 自己的演算法描述與實現指南")}</li>
            <li><a href="https://kociemba.org/themen/megaminx/megasol.html" target="_blank" rel="noopener noreferrer">Kociemba — Megaminx lower bound</a> — {t('Megaminx 下界 48 的对易面计数证明', 'Megaminx 48 lower bound via commuting-faces counting', "Megaminx 下界 48 的對易面計數證明")}</li>
            <li><a href="https://www.jaapsch.net/puzzles/" target="_blank" rel="noopener noreferrer">Jaap Scherphuis\' puzzle pages</a> — {t('2×2 / Skewb / Pyraminx / Square-1 / Clock 的状态数 + BFS 数据', 'state counts + BFS data for 2×2, Skewb, Pyraminx, Square-1, Clock', "2×2 / Skewb / Pyraminx / Square-1 / Clock 的狀態數 + BFS 資料")}</li>
            <li><a href="https://www.speedsolving.com/threads/square-one-can-be-solved-in-31-moves-in-face-turn-metric.67363/" target="_blank" rel="noopener noreferrer">Shuang Chen — Sq-1 face-turn = 31</a> — {t('722 GB 磁盘 BFS 求解过程帖 (2017-12)', '722 GB disk-BFS write-up (2017-12)', "722 GB 磁碟 BFS 求解過程帖 (2017-12)")}</li>
            <li><a href="https://www.speedsolving.com/threads/gods-number-for-clock-found.47822/" target="_blank" rel="noopener noreferrer">Jakob Kogler — Clock = 12</a> — {t('2014-05 原始证明帖', 'Original 2014-05 proof thread', "2014-05 原始證明帖")}</li>
            <li><a href="https://www.speedsolving.com/threads/lower-bound-for-megaminx-in-htm-and-qtm.35724/" target="_blank" rel="noopener noreferrer">Speedsolving — Megaminx bound</a> — {t('Megaminx HTM/QTM 下界讨论合集', 'Megaminx HTM/QTM bound discussion thread', "Megaminx HTM/QTM 下界討論合集")}</li>
            <li><a href="https://arxiv.org/abs/2501.00144" target="_blank" rel="noopener noreferrer">Merino & Subercaseaux 2024 — arXiv:2501.00144</a> — {t('"Demigod\'s number" 36 HTM 概率近似 oracle', '"Demigod\'s number" — 36 HTM probabilistic oracle', "\"Demigod's number\" 36 HTM 機率近似 oracle")}</li>
            <li><a href="https://web.mit.edu/sp.268/www/rubik.pdf" target="_blank" rel="noopener noreferrer">Tom Davis — Group Theory via Rubik\'s Cube</a> — {t('MIT 入门讲义,把魔方当群论教材', 'MIT primer treating the cube as a group-theory textbook', "MIT 入門講義,把魔方當群論教材")}</li>
            <li><a href="https://en.wikipedia.org/wiki/God%27s_algorithm" target="_blank" rel="noopener noreferrer">Wikipedia — God\'s algorithm</a> — {t('上帝之数与上帝算法的标准百科词条', 'Encyclopedic article on God\'s number / God\'s algorithm', "上帝之數與上帝演算法的標準百科詞條")}</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
