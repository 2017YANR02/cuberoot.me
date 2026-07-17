'use client';

/**
 * /math/group — Rubik's Cube and group theory.
 * A long-form math essay of 60+ interactive sections. Each section lives in its
 * own lazy-loaded module under _components/sections/ and is registered in
 * EXT_COMPONENTS below; this file is the page shell (hero, index/TOC, per-slug
 * section mount, prev/next nav).
 *
 * Cube animations use the cubing.js TwistyPlayer wrapper (_components/TwistyMini);
 * invariants use _components/cube_state.ts (verified against R, RU, superflip).
 */
import { useEffect, useMemo } from 'react';
import Link from '@/components/AppLink';
import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import { SlugContext, useLang, TeX, TeXBlock, type Lang } from './_components/primitives';
import { TwistyMini } from './_components/TwistyMini';
import HomeLink from '@/components/HomeLink';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import './group_theory.css';
import { tr } from '@/i18n/tr';

// ── Extended sections §33–§62 (self-contained files, lazy-loaded per slug so the
//    base page chunk stays lean — only the active section's code is fetched) ──
const EXT_COMPONENTS: Record<string, ReturnType<typeof dynamic>> = {
  'wreath-product': dynamic(() => import('./_components/sections/WreathProduct'), { ssr: false }),
  'semidirect-product': dynamic(() => import('./_components/sections/SemidirectProduct'), { ssr: false }),
  'sylow': dynamic(() => import('./_components/sections/SylowTheorems'), { ssr: false }),
  'composition-series': dynamic(() => import('./_components/sections/CompositionSeries'), { ssr: false }),
  'solvable-nilpotent': dynamic(() => import('./_components/sections/SolvableNilpotent'), { ssr: false }),
  'abelian-classification': dynamic(() => import('./_components/sections/AbelianClassification'), { ssr: false }),
  'automorphism-group': dynamic(() => import('./_components/sections/AutomorphismGroup'), { ssr: false }),
  'cyclic-modular': dynamic(() => import('./_components/sections/CyclicModular'), { ssr: false }),
  'dihedral': dynamic(() => import('./_components/sections/DihedralGroups'), { ssr: false }),
  'platonic-symmetry': dynamic(() => import('./_components/sections/PlatonicSymmetry'), { ssr: false }),
  'frieze-groups': dynamic(() => import('./_components/sections/FriezeGroups'), { ssr: false }),
  'wallpaper-groups': dynamic(() => import('./_components/sections/WallpaperGroups'), { ssr: false }),
  'point-groups-crystal': dynamic(() => import('./_components/sections/PointGroupsCrystal'), { ssr: false }),
  'reflection-coxeter': dynamic(() => import('./_components/sections/ReflectionCoxeter'), { ssr: false }),
  'plane-isometries': dynamic(() => import('./_components/sections/PlaneIsometries'), { ssr: false }),
  'polya-cube-colorings': dynamic(() => import('./_components/sections/PolyaCubeColorings'), { ssr: false }),
  'cycle-index': dynamic(() => import('./_components/sections/CycleIndex'), { ssr: false }),
  'class-equation': dynamic(() => import('./_components/sections/ClassEquation'), { ssr: false }),
  'character-table': dynamic(() => import('./_components/sections/CharacterTable'), { ssr: false }),
  'young-tableaux': dynamic(() => import('./_components/sections/YoungTableaux'), { ssr: false }),
  'representation-basics': dynamic(() => import('./_components/sections/RepresentationBasics'), { ssr: false }),
  'fourier-on-groups': dynamic(() => import('./_components/sections/FourierOnGroups'), { ssr: false }),
  'quaternion-group': dynamic(() => import('./_components/sections/QuaternionGroup'), { ssr: false }),
  'free-groups': dynamic(() => import('./_components/sections/FreeGroups'), { ssr: false }),
  'cayley-theorem': dynamic(() => import('./_components/sections/CayleyTheorem'), { ssr: false }),
  'orbit-stabilizer': dynamic(() => import('./_components/sections/OrbitStabilizer'), { ssr: false }),
  'matrix-lie-groups': dynamic(() => import('./_components/sections/MatrixLieGroups'), { ssr: false }),
  'galois-connection': dynamic(() => import('./_components/sections/GaloisConnection'), { ssr: false }),
  'growth-of-groups': dynamic(() => import('./_components/sections/GrowthOfGroups'), { ssr: false }),
  'expander-ramanujan': dynamic(() => import('./_components/sections/ExpanderRamanujan'), { ssr: false }),
  'refs': dynamic(() => import('./_components/sections/References'), { ssr: false }),
  'structure': dynamic(() => import('./_components/sections/StructureTheorem'), { ssr: false }),
  'beyond': dynamic(() => import('./_components/sections/BeyondTheCube'), { ssr: false }),
  'open-problems': dynamic(() => import('./_components/sections/OpenProblems'), { ssr: false }),
  'order': dynamic(() => import('./_components/sections/ScaleComparisonSection'), { ssr: false }),
  'other-puzzles': dynamic(() => import('./_components/sections/OtherPuzzles'), { ssr: false }),
  'representations': dynamic(() => import('./_components/sections/RepresentationGlimpse'), { ssr: false }),
  'gods-number': dynamic(() => import('./_components/sections/GodsNumber'), { ssr: false }),
  'lights-out': dynamic(() => import('./_components/sections/LightsOut'), { ssr: false }),
  'peg-solitaire': dynamic(() => import('./_components/sections/PegSolitaire'), { ssr: false }),
  'hamiltonian': dynamic(() => import('./_components/sections/HamiltonianPaths'), { ssr: false }),
  'two-face-pgl': dynamic(() => import('./_components/sections/TwoFacePGL'), { ssr: false }),
  'rotational-puzzles': dynamic(() => import('./_components/sections/RotationalPuzzles'), { ssr: false }),
  'useful-math': dynamic(() => import('./_components/sections/UsefulMath'), { ssr: false }),
  'what-is-a-group': dynamic(() => import('./_components/sections/WhatIsAGroup'), { ssr: false }),
  'lagrange': dynamic(() => import('./_components/sections/LagrangeCosets'), { ssr: false }),
  'quotient': dynamic(() => import('./_components/sections/QuotientGroups'), { ssr: false }),
  'permutation-groups': dynamic(() => import('./_components/sections/PermutationGroups'), { ssr: false }),
  'algorithms': dynamic(() => import('./_components/sections/SolvingAlgorithms'), { ssr: false }),
  'distance': dynamic(() => import('./_components/sections/DistanceDistribution'), { ssr: false }),
  'random-walks': dynamic(() => import('./_components/sections/RandomWalks'), { ssr: false }),
  'cube-group': dynamic(() => import('./_components/sections/CubeGroup'), { ssr: false }),
  'state-vector': dynamic(() => import('./_components/sections/StateVector'), { ssr: false }),
  'invariants': dynamic(() => import('./_components/sections/Invariants'), { ssr: false }),
  'order-of-element': dynamic(() => import('./_components/sections/OrderOfElement'), { ssr: false }),
  'conjugation': dynamic(() => import('./_components/sections/Conjugation'), { ssr: false }),
  'commutators': dynamic(() => import('./_components/sections/Commutators'), { ssr: false }),
  'thistlethwaite': dynamic(() => import('./_components/sections/Thistlethwaite'), { ssr: false }),
  'patterns': dynamic(() => import('./_components/sections/Patterns'), { ssr: false }),
  'cayley': dynamic(() => import('./_components/sections/CayleyGraph'), { ssr: false }),
  'homomorphisms': dynamic(() => import('./_components/sections/Homomorphisms'), { ssr: false }),
  'actions-burnside': dynamic(() => import('./_components/sections/ActionsBurnside'), { ssr: false }),
  'computational': dynamic(() => import('./_components/sections/Computational'), { ssr: false }),
};

function NewSectionMount({ slug }: { slug: string }) {
  const C = EXT_COMPONENTS[slug];
  return C ? <C /> : null;
}

// TeX / TeXBlock / SlugContext / GTSec / L / useLang live in ./_components/primitives;
// the TwistyMini cube player lives in ./_components/TwistyMini. Slug is undefined on
// the index page or one of the TOC ids on a section sub-page; GTSec renders only when
// its id matches the slug, so one return body serves both modes.

function IndexStatsStrip() {
  return (
    <div className="gt-index-stats">
      <div className="gt-index-stat">
        <div className="gt-index-stat-val">4.33 × 10<sup>19</sup></div>
        <div className="gt-index-stat-label">|G|</div>
        <div className="gt-index-stat-cap">{tr({ zh: '魔方可达状态', en: 'reachable cube states'
        })}</div>
      </div>
      <div className="gt-index-stat">
        <div className="gt-index-stat-val">20</div>
        <div className="gt-index-stat-label">{tr({ zh: '上帝之数 HTM', en: "God's number (HTM)"
        })}</div>
        <div className="gt-index-stat-cap">{tr({ zh: '群的直径 = 最长最短解', en: 'group diameter — longest optimal solve'
        })}</div>
      </div>
      <div className="gt-index-stat">
        <div className="gt-index-stat-val">31 + 45</div>
        <div className="gt-index-stat-label">{tr({ zh: '小节 · 互动面板', en: 'sections · interactive panels'
        })}</div>
        <div className="gt-index-stat-cap">{tr({ zh: 'KaTeX 公式 · cubing.js 动画', en: 'KaTeX formulas · cubing.js animations'
        })}</div>
      </div>
    </div>
  );
}

function IndexOrderBlock() {
  return (
    <div className="gt-index-order">
      <div className="gt-index-section-head">{tr({ zh: '本文核心定理 · |G| 的封闭式', en: "core theorem · closed form for |G|"
    })}</div>
      <div className="gt-index-order-eq">
        <TeXBlock src={`|G| \\;=\\; \\frac{8!\\,\\cdot\\,3^{7}\\,\\cdot\\,12!\\,\\cdot\\,2^{11}}{2} \\;=\\; 43{,}252{,}003{,}274{,}489{,}856{,}000`} />
      </div>
      <div className="gt-index-order-legend">
        <div><b>8!</b><span>{tr({ zh: '角块排列', en: 'corner perms'
        })}</span></div>
        <div><b>3<sup>7</sup></b><span>{tr({ zh: '角块朝向', en: 'corner twists'
        })}<br /><em>Σco ≡ 0</em></span></div>
        <div><b>12!</b><span>{tr({ zh: '棱块排列', en: 'edge perms'
        })}</span></div>
        <div><b>2<sup>11</sup></b><span>{tr({ zh: '棱块翻面', en: 'edge flips'
        })}<br /><em>Σeo ≡ 0</em></span></div>
        <div><b>÷ 2</b><span>{tr({ zh: '角棱同奇偶', en: 'parity match'
        })}<br /><em>sgn(c) = sgn(e)</em></span></div>
      </div>
      <div className="gt-index-order-foot">
        <span>= 2<sup>27</sup> · 3<sup>14</sup> · 5<sup>3</sup> · 7<sup>2</sup> · 11</span>
        <Link href="/math/group/order">→ §4 {tr({ zh: '完整推导', en: 'full derivation'
        })}</Link>
        <Link href="/math/group/invariants">→ §5 {tr({ zh: '三守恒律证明', en: "why ÷ 2 / ÷ 3 / ÷ 2"
        })}</Link>
      </div>
    </div>
  );
}

function IndexFeaturedCube() {
  const lang = useLang();
  const SUPERFLIP = "U R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2";
  return (
    <div className="gt-index-featured">
      <div className="gt-index-featured-meta">{tr({ zh: '特写 · SUPERFLIP', en: 'feature · SUPERFLIP'
    })}</div>
      <div className="gt-index-featured-body">
        <div className="gt-index-featured-cube">
          <TwistyMini alg={SUPERFLIP} />
        </div>
        <div className="gt-index-featured-text">
          <h3 className="gt-index-featured-title">
            {tr({ zh: '所有棱翻面 — 离还原最远的 3 个态之一', en: 'All edges flipped — one of three positions maximally far from solved'
            })}
          </h3>
          <p>
            {lang === 'zh'
              ? <>每条棱的位置都对,但全部翻面 (<TeX src={`c_p = e,\\ e_p = e,\\ c_o = 0,\\ e_o = (1,1,\\ldots,1)`} />)。<strong>HTM 下恰好 20 步可解,且不能更短</strong> — 这正是 2010 年 Rokicki 等人证明 God's number = 20 时第一个被锁死的下界。</>
              : <>Every edge sits in its home slot, but all are flipped (<TeX src={`c_p = e,\\ e_p = e,\\ c_o = 0,\\ e_o = (1,1,\\ldots,1)`} />). <strong>Solvable in exactly 20 HTM moves, and no fewer</strong> — the lower bound nailed down first when Rokicki et al. proved God's number = 20 in 2010.</>}
          </p>
          <pre className="gt-index-featured-alg">{SUPERFLIP}</pre>
          <div className="gt-index-featured-cta">
            <Link href="/math/group/gods-number">§11 {tr({ zh: '上帝之数 = 20 ↗', en: "God's number = 20 ↗"
            })}</Link>
            <Link href="/math/group/order-of-element">§7 {tr({ zh: '元素的阶 ↗', en: 'order of an element ↗'
            })}</Link>
            <Link href="/math/group/patterns">§13 {tr({ zh: '图案画廊 ↗', en: 'pattern gallery ↗'
            })}</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function IndexHighlightCards() {
  const lang = useLang();
  const cards: { id: string; num: string; titleZh: string; titleEn: string; teaserZh: string; teaserEn: string; formula: string
 }[] = [
    {
      id: 'what-is-a-group', num: '§1',
      titleZh: '四条公理', titleEn: 'Four axioms',
      teaserZh: '封闭 · 结合 · 单位 · 逆 — 为什么魔方"就是"一个群',
      teaserEn: 'Closure · associativity · identity · inverse — why the cube literally is a group',
      formula: `G_1 \\;G_2 \\;G_3 \\;G_4`
    },
    {
      id: 'invariants', num: '§5',
      titleZh: '三守恒律 + 证明',
      titleEn: 'Three invariants + proofs',
      teaserZh: '角向 mod 3,棱向 mod 2,角棱奇偶同 — 为什么只有 1/12 可达',
      teaserEn: 'Σco mod 3, Σeo mod 2, parity match — why only 1/12 of "free" states are reachable',
      formula: `\\textstyle\\sum c_o \\equiv 0,\\;\\sum e_o \\equiv 0`
    },
    {
      id: 'gods-number', num: '§11',
      titleZh: '上帝之数 = 20',
      titleEn: "God's number = 20",
      teaserZh: '35 CPU 年遍历 4.3 京状态:没有一个需要 21 步',
      teaserEn: '35 CPU-years brute-forced 4.3 × 10¹⁹ states — none needs 21 moves',
      formula: `\\mathrm{diam}(\\Gamma(G,S)) = 20`
    },
    {
      id: 'cayley', num: '§14',
      titleZh: 'Cayley 图',
      titleEn: 'Cayley graph',
      teaserZh: '顶点 = 状态 · 边 = 转面 · 直径 = 上帝之数 · BFS = 最优解',
      teaserEn: 'Vertices = states · edges = face turns · diameter = God\'s number · BFS = optimal solver',
      formula: `\\Gamma(G,\\, S)`
    },
  ];
  return (
    <div className="gt-index-cards">
      <div className="gt-index-section-head">{tr({ zh: '亮点 · 四个关键概念', en: 'highlights · four pivotal ideas'
    })}</div>
      <div className="gt-index-cards-grid">
        {cards.map(c => (
          <Link key={c.id} href={`/math/group/${c.id}`} className="gt-index-card">
            <div className="gt-index-card-num">{c.num}</div>
            <div className="gt-index-card-title">{lang === 'zh' ? c.titleZh : c.titleEn}</div>
            <div className="gt-index-card-formula"><TeX src={c.formula} /></div>
            <div className="gt-index-card-teaser">{lang === 'zh' ? c.teaserZh : c.teaserEn}</div>
            <div className="gt-index-card-arrow">→</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

const TOC_THEMES: { id: string; zh: string; en: string; descZh: string; descEn: string; range: string; secs: string[]
 }[] = [
  { id: 'foundations', zh: '基础', en: 'Foundations',
    descZh: '公理 · 生成元 · 状态向量 · |G| · 守恒律 · 结构定理',
    descEn: 'axioms · generators · state vector · order · invariants · structure theorem',
    range: '§1 – §6', secs: ['what-is-a-group','cube-group','state-vector','order','invariants','structure']
},
  { id: 'core', zh: '群论核心', en: 'Core group theory',
    descZh: '元素的阶 · 共轭 · 换位子 · 子群链 · 上帝之数',
    descEn: 'element order · conjugation · commutators · Thistlethwaite chain · God\'s number',
    range: '§7 – §11', secs: ['order-of-element','conjugation','commutators','thistlethwaite','gods-number']
},
  { id: 'visual', zh: '拓展 · 几何与图案', en: 'Extensions · geometry & patterns',
    descZh: '走得更远 · 图案画廊 · Cayley 图 · 其它拼图 · 未解问题',
    descEn: 'beyond · pattern gallery · Cayley graph · other puzzles · open problems',
    range: '§12 – §16', secs: ['beyond','patterns','cayley','other-puzzles','open-problems']
},
  { id: 'advanced', zh: '进阶代数', en: 'Advanced algebra',
    descZh: '同态 · 群作用 + Burnside · Lagrange + 陪集 · 商群 · 对称群与交错群',
    descEn: 'homomorphisms · actions + Burnside · Lagrange + cosets · quotients · S_n / A_n',
    range: '§17 – §21', secs: ['homomorphisms','actions-burnside','lagrange','quotient','permutation-groups']
},
  { id: 'computation', zh: '计算 · 算法 · 表示', en: 'Computation · algorithms · representation',
    descZh: '解法算法 · 距离分布 · 随机游走 · BSGS · 表示论一瞥',
    descEn: 'solving algorithms · distance distribution · random walks · BSGS · representation theory',
    range: '§22 – §26', secs: ['algorithms','distance','random-walks','computational','representations']
},
  { id: 'puzzles', zh: '拼图数学 · jaapsch.net', en: 'Puzzle mathematics · jaapsch.net',
    descZh: 'Lights Out · 孔明棋 · Hamilton · PGL₂(𝔽₅) · 图旋转拼图 · 有用数学',
    descEn: 'Lights Out · peg solitaire · Hamilton · PGL₂(𝔽₅) · rotational graph puzzles · useful math',
    range: '§27 – §32', secs: ['lights-out','peg-solitaire','hamiltonian','two-face-pgl','rotational-puzzles','useful-math']
},
  { id: 'structure', zh: '群的结构', en: 'Structure of groups',
    descZh: '圈积、半直积、Sylow、合成列、可解与幂零、阿贝尔分类、自同构群',
    descEn: 'wreath, semidirect, Sylow, series, solvable & nilpotent, abelian, Aut',
    range: '§33 – §39', secs: ['wreath-product','semidirect-product','sylow','composition-series','solvable-nilpotent','abelian-classification','automorphism-group']
},
  { id: 'symmetry', zh: '对称与几何', en: 'Symmetry & geometry',
    descZh: '循环群、二面体群、柏拉图立体、带饰群、墙纸群、点群、Coxeter、平面等距',
    descEn: 'cyclic, dihedral, Platonic solids, frieze, wallpaper, point groups, Coxeter, isometries',
    range: '§40 – §47', secs: ['cyclic-modular','dihedral','platonic-symmetry','frieze-groups','wallpaper-groups','point-groups-crystal','reflection-coxeter','plane-isometries']
},
  { id: 'counting', zh: '计数与表示', en: 'Counting & representation',
    descZh: 'Burnside–Pólya、轮换指标、类方程、特征标表、Young 图、不可约分解、傅里叶',
    descEn: 'Burnside–Pólya, cycle index, class equation, character tables, Young tableaux, irreps, Fourier',
    range: '§48 – §54', secs: ['polya-cube-colorings','cycle-index','class-equation','character-table','young-tableaux','representation-basics','fourier-on-groups']
},
  { id: 'frontiers', zh: '更多群与前沿', en: 'More groups & frontiers',
    descZh: '四元数群、自由群、Cayley 定理、轨道稳定子、矩阵与李群、伽罗瓦、增长、扩张图',
    descEn: 'quaternions, free groups, Cayley, orbit–stabiliser, Lie groups, Galois, growth, expanders',
    range: '§55 – §62', secs: ['quaternion-group','free-groups','cayley-theorem','orbit-stabilizer','matrix-lie-groups','galois-connection','growth-of-groups','expander-ramanujan']
},
];

function IndexThemedTOC() {
  const lang = useLang();
  const byId = useMemo(() => new Map(TOC.map(t => [t.id, t])), []);
  return (
    <nav className="gt-index-toc" aria-label="Table of contents">
      <div className="gt-index-section-head">{tr({ zh: '目录 · 62 节按主题分组', en: 'contents · 62 sections, grouped by theme'
    })}</div>
      <div className="gt-index-toc-themes">
        {TOC_THEMES.map(theme => (
          <div key={theme.id} className="gt-index-theme">
            <div className="gt-index-theme-head">
              <span className="gt-index-theme-range">{theme.range}</span>
              <span className="gt-index-theme-name">{tr(theme)}</span>
              <span className="gt-index-theme-desc">{lang === 'zh' ? theme.descZh : theme.descEn}</span>
            </div>
            <ul className="gt-index-theme-list">
              {theme.secs.map(id => {
                const t = byId.get(id);
                if (!t) return null;
                return (
                  <li key={id}>
                    <Link href={`/math/group/${id}`}>
                      <span className="gt-index-theme-num">§{t.num}</span>
                      <span className="gt-index-theme-title">{tr(t)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        <div className="gt-index-theme gt-index-theme-refs">
          <div className="gt-index-theme-head">
            <span className="gt-index-theme-range">REF</span>
            <span className="gt-index-theme-name">{tr({ zh: '参考文献', en: 'References'
            })}</span>
            <span className="gt-index-theme-desc">{tr({ zh: '12 条 · 教材 · 论文 · 网络资源', en: '12 entries · textbooks · papers · web resources'
            })}</span>
          </div>
          <ul className="gt-index-theme-list">
            <li>
              <Link href={`/math/group/refs`}>
                <span className="gt-index-theme-num">REF</span>
                <span className="gt-index-theme-title">{tr({ zh: '参考文献', en: 'Bibliography'
                })}</span>
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function GroupTheoryPage() {
  const lang = useLang();
  useDocumentTitle('群论', 'Group Theory');
  const params = useParams<{ slug?: string | string[] }>();
  const rawSlug = params?.slug;
  const slug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;
  const isIndex = !slug;
  const validSlugs = useMemo(() => new Set(TOC.map(t => t.id)), []);
  const slugValid = !slug || validSlugs.has(slug);
  // Scroll to top on slug change (and language preserve via existing i18n)
  useEffect(() => { if (typeof window !== 'undefined') window.scrollTo(0, 0); }, [slug]);

  return (
    <SlugContext.Provider value={slug}>
    <div className="gt-page">
      <div className="gt-topbar">
        {isIndex
          ? <HomeLink className="gt-back">← {tr({ zh: '返回', en: 'home' })}</HomeLink>
          : <Link href="/math/group" className="gt-back">← {tr({ zh: '目录', en: 'contents'
        })}</Link>}
      </div>

      {isIndex && (
      <header className="gt-hero">
        <div className="gt-hero-meta">{tr({ zh: '理论 · GROUP THEORY', en: 'THEORY · GROUP THEORY'
        })}</div>
        <h1 className="gt-hero-title">
          {lang === 'zh'
            ? <>魔方<span className="gt-bold">与群</span></>
            : <>The Rubik's Cube,<br /><span className="gt-bold">as a Group</span></>}
        </h1>
        <p className="gt-hero-sub">
          {tr({ zh: '4,325 京个状态 不是混沌,是一个有序代数对象。一篇带图、带动画、带互动的代数学小课。', en: '43 quintillion positions is not chaos. It is a beautifully structured algebraic object. An illustrated, interactive primer.'
        })}
        </p>
        <div className="gt-hero-byline">
          {tr({ zh: 'cuberoot · 2026 · 62 节 · 100+ 互动 & 视觉面板 · 数学公式 KaTeX 渲染', en: 'cuberoot · 2026 · 62 sections · 100+ interactive & visual panels · KaTeX-rendered math'
        })}
        </div>
      </header>
      )}

      {!slugValid && (
        <div className="gt-aside" style={{ maxWidth: 720, margin: '40px auto' }}>
          {lang === 'zh'
            ? <>未知小节 <code className="gt-mono">{slug}</code>。 <Link href="/math/group">返回目录</Link>。</>
            : <>Unknown section <code className="gt-mono">{slug}</code>. <Link href="/math/group">Back to contents</Link>.</>}
        </div>
      )}

      {isIndex && <IndexStatsStrip />}
      {isIndex && <IndexOrderBlock />}
      {isIndex && <IndexFeaturedCube />}
      {isIndex && <IndexHighlightCards />}
      {isIndex && <IndexThemedTOC />}














      {/* ═══════════════ §32 Useful Mathematics ════════════════════════ */}



      {/* Extended sections §33–§62 + §REF (refs): self-contained files, lazy-loaded per slug */}
      {!isIndex && slug && EXT_COMPONENTS[slug] && <NewSectionMount slug={slug} />}

      {!isIndex && slugValid && <SectionNav slug={slug!} lang={lang} />}

      <div className="gt-end-mark">∎</div>

      <div className="gt-foot">cuberoot.me · {tr({ zh: '魔方与群论', en: 'Rubik\'s Cube as a Group'
    })} · 2026</div>
    </div>
    </SlugContext.Provider>
  );
}

// ── Section-page navigation footer (prev / next / back to TOC) ────────────
function SectionNav({ slug }: { slug: string; lang: Lang }) {
  const all = TOC;
  const idx = all.findIndex(s => s.id === slug);
  if (idx < 0) return null;
  const prev = idx > 0 ? all[idx - 1] : null;
  const next = idx < all.length - 1 ? all[idx + 1] : null;
  return (
    <nav className="gt-section-nav" aria-label="section navigation">
      <div className="gt-section-nav-cell gt-section-nav-prev">
        {prev ? (
          <Link href={`/math/group/${prev.id}`}>
            <div className="gt-section-nav-dir">← {tr({ zh: '上一节', en: 'previous'
            })}</div>
            <div className="gt-section-nav-num">§{prev.num}</div>
            <div className="gt-section-nav-title">{tr(prev)}</div>
          </Link>
        ) : <div className="gt-section-nav-empty" />}
      </div>
      <div className="gt-section-nav-cell gt-section-nav-toc">
        <Link href="/math/group">
          <div className="gt-section-nav-dir">↑ {tr({ zh: '回到目录', en: 'contents'
        })}</div>
        </Link>
      </div>
      <div className="gt-section-nav-cell gt-section-nav-next">
        {next ? (
          <Link href={`/math/group/${next.id}`}>
            <div className="gt-section-nav-dir">{tr({ zh: '下一节', en: 'next'
            })} →</div>
            <div className="gt-section-nav-num">§{next.num}</div>
            <div className="gt-section-nav-title">{tr(next)}</div>
          </Link>
        ) : <div className="gt-section-nav-empty" />}
      </div>
    </nav>
  );
}

const TOC: { id: string; num: string; zh: string; en: string
 }[] = [
  { id: 'what-is-a-group',   num: '1',  zh: '什么是群',                 en: 'What is a group?'
},
  { id: 'cube-group',         num: '2',  zh: '魔方群 G',                 en: 'The cube group G' },
  { id: 'state-vector',       num: '3',  zh: '状态向量 (cp, co, ep, eo)', en: 'State vector'
},
  { id: 'order',              num: '4',  zh: 'G 的阶',                  en: 'The order |G|'
},
  { id: 'invariants',         num: '5',  zh: '三个守恒律 + 证明',         en: 'Three invariants + proofs'
},
  { id: 'structure',          num: '6',  zh: '结构定理',                 en: 'Structure theorem'
},
  { id: 'order-of-element',   num: '7',  zh: '元素的阶',                 en: 'Order of an element'
},
  { id: 'conjugation',        num: '8',  zh: '共轭与共轭类',              en: 'Conjugation'
},
  { id: 'commutators',        num: '9',  zh: '换位子 + 中心',            en: 'Commutators + centre'
},
  { id: 'thistlethwaite',     num: '10', zh: 'Thistlethwaite 子群链',    en: 'Subgroup chain'
},
  { id: 'gods-number',        num: '11', zh: '上帝之数 = 20',           en: "God's number = 20"
},
  { id: 'beyond',             num: '12', zh: '走得更远',                en: 'Beyond the cube'
},
  { id: 'patterns',           num: '13', zh: '著名图案画廊',             en: 'Famous patterns'
},
  { id: 'cayley',             num: '14', zh: 'Cayley 图',              en: 'Cayley graph'
},
  { id: 'other-puzzles',      num: '15', zh: '其它扭转拼图',             en: 'Other twisting puzzles'
},
  { id: 'open-problems',      num: '16', zh: '未解问题',                 en: 'Open problems'
},
  { id: 'homomorphisms',      num: '17', zh: '同态与第一同构定理',        en: 'Homomorphisms'
},
  { id: 'actions-burnside',   num: '18', zh: '群作用 + Burnside',         en: 'Group actions + Burnside' },
  { id: 'lagrange',           num: '19', zh: '拉格朗日定理 + 陪集',        en: 'Lagrange + cosets' },
  { id: 'quotient',           num: '20', zh: '正规子群 + 商群',            en: 'Normal subgroups + quotients'
},
  { id: 'permutation-groups', num: '21', zh: '置换群 Sₙ 与交错群 Aₙ',       en: 'Symmetric & alternating groups'
},
  { id: 'algorithms',         num: '22', zh: '解魔方的算法',               en: 'Solving algorithms'
},
  { id: 'distance',           num: '23', zh: '距离分布与 20 步证明',       en: 'Distance distribution'
},
  { id: 'random-walks',       num: '24', zh: '群上的随机游走',             en: 'Random walks on G'
},
  { id: 'computational',      num: '25', zh: '计算群论:BSGS 与 Schreier–Sims', en: 'Computational group theory'
},
  { id: 'representations',    num: '26', zh: '表示论一瞥',                en: 'A glimpse of representation theory'
},
  { id: 'lights-out',         num: '27', zh: 'Lights Out 与 𝔽₂ 线性代数',  en: 'Lights Out · linear algebra over 𝔽₂'
},
  { id: 'peg-solitaire',      num: '28', zh: '孔明棋 · 三染色不变量',       en: 'Peg solitaire · 3-colouring invariant'
},
  { id: 'hamiltonian',        num: '29', zh: 'Hamilton 路径 + Gray 码',     en: 'Hamiltonian paths + Gray codes'
},
  { id: 'two-face-pgl',       num: '30', zh: '两面 6 角 ≅ PGL₂(𝔽₅) ≅ S₅',  en: 'Two-face corners ≅ PGL₂(𝔽₅) ≅ S₅'
},
  { id: 'rotational-puzzles', num: '31', zh: '图上的旋转拼图 · (x,y,z)',    en: 'Rotational puzzles on graphs · (x,y,z)'
},
  { id: 'useful-math',        num: '32', zh: '有用数学 · 排列可视化',         en: 'Useful mathematics · permutation visualiser'
},
  { id: 'wreath-product',      num: '33', zh: '圈积 Wreath',                en: 'Wreath products'
},
  { id: 'semidirect-product',  num: '34', zh: '半直积',                    en: 'Semidirect products'
},
  { id: 'sylow',               num: '35', zh: 'Sylow 定理',                en: 'Sylow theorems' },
  { id: 'composition-series',  num: '36', zh: '合成列与 Jordan–Hölder',    en: 'Composition series'
},
  { id: 'solvable-nilpotent',  num: '37', zh: '可解群与幂零群',            en: 'Solvable & nilpotent'
},
  { id: 'abelian-classification', num: '38', zh: '有限阿贝尔群基本定理',    en: 'Finite abelian groups'
},
  { id: 'automorphism-group',  num: '39', zh: '自同构群 Aut(G)',           en: 'Automorphism groups'
},
  { id: 'cyclic-modular',      num: '40', zh: '循环群与模算术',            en: 'Cyclic & modular'
},
  { id: 'dihedral',            num: '41', zh: '二面体群 Dₙ',               en: 'Dihedral groups'
},
  { id: 'platonic-symmetry',   num: '42', zh: '柏拉图立体的对称群',        en: 'Platonic symmetry'
},
  { id: 'frieze-groups',       num: '43', zh: '七种带饰群',                en: 'The 7 frieze groups'
},
  { id: 'wallpaper-groups',    num: '44', zh: '十七种墙纸群',              en: 'The 17 wallpaper groups'
},
  { id: 'point-groups-crystal', num: '45', zh: '点群与晶体学',             en: 'Point groups & crystals'
},
  { id: 'reflection-coxeter',  num: '46', zh: '反射群与 Coxeter 群',       en: 'Reflection & Coxeter'
},
  { id: 'plane-isometries',    num: '47', zh: '平面等距群',                en: 'Plane isometries' },
  { id: 'polya-cube-colorings', num: '48', zh: '数立方体染色 (Burnside–Pólya)', en: 'Counting cube colourings'
},
  { id: 'cycle-index',         num: '49', zh: '轮换指标多项式',            en: 'Cycle-index polynomial'
},
  { id: 'class-equation',      num: '50', zh: '类方程',                    en: 'The class equation'
},
  { id: 'character-table',     num: '51', zh: '特征标表',                  en: 'Character tables'
},
  { id: 'young-tableaux',      num: '52', zh: 'Young 图与 Sₙ 表示',        en: 'Young tableaux'
},
  { id: 'representation-basics', num: '53', zh: '表示与不可约分解',        en: 'Representations'
},
  { id: 'fourier-on-groups',   num: '54', zh: '群上的傅里叶分析',          en: 'Fourier on groups'
},
  { id: 'quaternion-group',    num: '55', zh: '四元数群 Q₈',              en: 'Quaternion group Q₈'
},
  { id: 'free-groups',         num: '56', zh: '自由群与约简字',            en: 'Free groups'
},
  { id: 'cayley-theorem',      num: '57', zh: 'Cayley 定理',              en: "Cayley's theorem" },
  { id: 'orbit-stabilizer',    num: '58', zh: '轨道–稳定子定理',          en: 'Orbit–stabiliser'
},
  { id: 'matrix-lie-groups',   num: '59', zh: '矩阵群与李群',              en: 'Matrix & Lie groups'
},
  { id: 'galois-connection',   num: '60', zh: '伽罗瓦理论与可解性',        en: 'Galois & solvability'
},
  { id: 'growth-of-groups',    num: '61', zh: '群的增长',                  en: 'Growth of groups'
},
  { id: 'expander-ramanujan',  num: '62', zh: '扩张图与 Ramanujan 图',     en: 'Expanders & Ramanujan'
},
  { id: 'refs',               num: 'REF', zh: '参考文献',                   en: 'References'
},
];
