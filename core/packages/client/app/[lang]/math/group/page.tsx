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
import { TOC, TOC_THEMES } from './_data/toc';

// ── Extended sections §33–§62 (self-contained files, lazy-loaded per slug so the
//    base page chunk stays lean — only the active section's code is fetched) ──
//
// These deliberately do NOT pass `ssr: false`. They used to, which meant the
// prose — the most substantial original writing on the site — never reached the
// server HTML: /math/group/<slug> prerendered to ~155 characters of prev/next
// navigation and nothing else. Search engines that render JS eventually saw it;
// assistants and link unfurlers, which do not render, saw an empty page.
//
// Dropping the flag is safe: only one section renders per URL (GTSec matches the
// slug), so the HTML grows by one section, not sixty-three. The cube players are
// the only browser-dependent part and TwistyMini already defers
// `import('cubing/twisty')` into an effect, so it renders an empty container on
// the server and hydrates into a player on the client.
const EXT_COMPONENTS: Record<string, ReturnType<typeof dynamic>> = {
  'wreath-product': dynamic(() => import('./_components/sections/WreathProduct')),
  'semidirect-product': dynamic(() => import('./_components/sections/SemidirectProduct')),
  'sylow': dynamic(() => import('./_components/sections/SylowTheorems')),
  'composition-series': dynamic(() => import('./_components/sections/CompositionSeries')),
  'solvable-nilpotent': dynamic(() => import('./_components/sections/SolvableNilpotent')),
  'abelian-classification': dynamic(() => import('./_components/sections/AbelianClassification')),
  'automorphism-group': dynamic(() => import('./_components/sections/AutomorphismGroup')),
  'cyclic-modular': dynamic(() => import('./_components/sections/CyclicModular')),
  'dihedral': dynamic(() => import('./_components/sections/DihedralGroups')),
  'platonic-symmetry': dynamic(() => import('./_components/sections/PlatonicSymmetry')),
  'frieze-groups': dynamic(() => import('./_components/sections/FriezeGroups')),
  'wallpaper-groups': dynamic(() => import('./_components/sections/WallpaperGroups')),
  'point-groups-crystal': dynamic(() => import('./_components/sections/PointGroupsCrystal')),
  'reflection-coxeter': dynamic(() => import('./_components/sections/ReflectionCoxeter')),
  'plane-isometries': dynamic(() => import('./_components/sections/PlaneIsometries')),
  'polya-cube-colorings': dynamic(() => import('./_components/sections/PolyaCubeColorings')),
  'cycle-index': dynamic(() => import('./_components/sections/CycleIndex')),
  'class-equation': dynamic(() => import('./_components/sections/ClassEquation')),
  'character-table': dynamic(() => import('./_components/sections/CharacterTable')),
  'young-tableaux': dynamic(() => import('./_components/sections/YoungTableaux')),
  'representation-basics': dynamic(() => import('./_components/sections/RepresentationBasics')),
  'fourier-on-groups': dynamic(() => import('./_components/sections/FourierOnGroups')),
  'quaternion-group': dynamic(() => import('./_components/sections/QuaternionGroup')),
  'free-groups': dynamic(() => import('./_components/sections/FreeGroups')),
  'cayley-theorem': dynamic(() => import('./_components/sections/CayleyTheorem')),
  'orbit-stabilizer': dynamic(() => import('./_components/sections/OrbitStabilizer')),
  'matrix-lie-groups': dynamic(() => import('./_components/sections/MatrixLieGroups')),
  'galois-connection': dynamic(() => import('./_components/sections/GaloisConnection')),
  'growth-of-groups': dynamic(() => import('./_components/sections/GrowthOfGroups')),
  'expander-ramanujan': dynamic(() => import('./_components/sections/ExpanderRamanujan')),
  'refs': dynamic(() => import('./_components/sections/References')),
  'structure': dynamic(() => import('./_components/sections/StructureTheorem')),
  'beyond': dynamic(() => import('./_components/sections/BeyondTheCube')),
  'open-problems': dynamic(() => import('./_components/sections/OpenProblems')),
  'order': dynamic(() => import('./_components/sections/ScaleComparisonSection')),
  'other-puzzles': dynamic(() => import('./_components/sections/OtherPuzzles')),
  'representations': dynamic(() => import('./_components/sections/RepresentationGlimpse')),
  'gods-number': dynamic(() => import('./_components/sections/GodsNumber')),
  'lights-out': dynamic(() => import('./_components/sections/LightsOut')),
  'peg-solitaire': dynamic(() => import('./_components/sections/PegSolitaire')),
  'hamiltonian': dynamic(() => import('./_components/sections/HamiltonianPaths')),
  'two-face-pgl': dynamic(() => import('./_components/sections/TwoFacePGL')),
  'rotational-puzzles': dynamic(() => import('./_components/sections/RotationalPuzzles')),
  'useful-math': dynamic(() => import('./_components/sections/UsefulMath')),
  'what-is-a-group': dynamic(() => import('./_components/sections/WhatIsAGroup')),
  'lagrange': dynamic(() => import('./_components/sections/LagrangeCosets')),
  'quotient': dynamic(() => import('./_components/sections/QuotientGroups')),
  'permutation-groups': dynamic(() => import('./_components/sections/PermutationGroups')),
  'algorithms': dynamic(() => import('./_components/sections/SolvingAlgorithms')),
  'distance': dynamic(() => import('./_components/sections/DistanceDistribution')),
  'random-walks': dynamic(() => import('./_components/sections/RandomWalks')),
  'cube-group': dynamic(() => import('./_components/sections/CubeGroup')),
  'state-vector': dynamic(() => import('./_components/sections/StateVector')),
  'invariants': dynamic(() => import('./_components/sections/Invariants')),
  'order-of-element': dynamic(() => import('./_components/sections/OrderOfElement')),
  'conjugation': dynamic(() => import('./_components/sections/Conjugation')),
  'commutators': dynamic(() => import('./_components/sections/Commutators')),
  'thistlethwaite': dynamic(() => import('./_components/sections/Thistlethwaite')),
  'patterns': dynamic(() => import('./_components/sections/Patterns')),
  'cayley': dynamic(() => import('./_components/sections/CayleyGraph')),
  'homomorphisms': dynamic(() => import('./_components/sections/Homomorphisms')),
  'actions-burnside': dynamic(() => import('./_components/sections/ActionsBurnside')),
  'computational': dynamic(() => import('./_components/sections/Computational')),
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
            {tr({ zh: '所有棱翻面 — 第一个被证明离还原最远的态', en: 'All edges flipped — the first position proved maximally far from solved'
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

