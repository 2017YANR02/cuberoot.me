'use client';

/**
 * /math — hub for math subpages
 *   /math/group  —— Rubik's Cube & group theory (long-form, 26 sections)
 *   /math/god    —— God's Number across all 17 WCA puzzles
 *
 * 1:1 port from packages/client-vite/src/pages/math/MathLandingPage.tsx (Vite SPA).
 */
import Link from '@/components/AppLink';
import BackHome from '@/components/BackHome';
import { useTranslation } from 'react-i18next';
import { Infinity as InfinityIcon, Sigma, Dices, Ruler, Boxes, Percent } from '@app-foundation/icons/lucide';
import { useT } from "@/hooks/useT";
import { tr } from '@/i18n/tr';

interface Card {
  to: string;
  Icon: typeof Sigma;
  zh: { title: string; desc: string };
  en: { title: string; desc: string };
}

const GRH_PATH = '/math/generalized-riemann-hypothesis';

const CARDS: Card[] = [
  {
    to: '/math/cube-graph',
    Icon: Boxes,
    zh: { title: '魔方与图论', desc: '三维魔方与 54 枚贴纸的圆环、扇形映射同步转动，理解置换与凯莱图的区别' },
    en: { title: 'Rubik’s Cube & Graph Theory', desc: 'Turn a cube alongside ring and sector maps of its 54 stickers, and explore permutations and Cayley graphs' },
  },
  {
    to: '/math/navier-stokes',
    Icon: Sigma,
    zh: { title: '关于纳维–斯托克斯千禧年大奖难题', desc: 'OpenAI 文章全文中文翻译，含研究过程、同期研究、原图与图注' },
    en: { title: 'On the Navier–Stokes Millennium Prize Problem', desc: 'The OpenAI article with a full Chinese translation, original figures, and captions' },
  },
  {
    to: '/math/god',
    Icon: InfinityIcon,
    zh: { title: '上帝之数', desc: '17 个 WCA 项目的群直径 (精确值 / 上下界) + 群论 + 现场 BFS' },
    en: { title: "God's number", desc: 'Cayley-graph diameter for all 17 WCA puzzles (exact / bounds) + group theory + live BFS' }
},
  {
    to: '/math/demigod',
    Icon: Dices,
    zh: { title: '半神之数', desc: 'Merino & Subercaseaux 2024:用 500k 样本 + Hoeffding 证 D ≤ 36,概率上界互动版' },
    en: { title: "Demigod's number", desc: 'Merino & Subercaseaux 2024: 500k samples + Hoeffding prove D ≤ 36 — the high-probability bound interactive' }
},
  {
    to: '/math/group',
    Icon: Sigma,
    zh: { title: '魔方与群', desc: '群论长文 62 节,100+ 互动可视化面板,KaTeX 渲染' },
    en: { title: 'Cube as a group', desc: '62-section group-theory essay, 100+ interactive visual panels, KaTeX-rendered' }
},
  {
    to: '/math/kernel',
    Icon: Boxes,
    zh: { title: '群论内核', desc: '模拟器怎么把每个魔方变成真实的群 G:PG 与置换两条路、BSGS、忠实的 |G|,14 个魔方实时数据' },
    en: { title: 'Group-theory kernel', desc: 'How the simulator turns each puzzle into its real group G: the PG & permutation paths, BSGS, faithful |G|, live data for 14 puzzles' }
},
  {
    to: '/math/probability',
    Icon: Percent,
    zh: { title: '情况概率与旋转对称', desc: '为什么 H perm 是 1/72:AUF 轨道、Burnside 计数,62208 个顶层状态现场枚举自证' },
    en: { title: 'Case probability & symmetry', desc: 'Why H perm is 1/72: AUF orbits, Burnside counting, all 62,208 last-layer states enumerated live' }
},
  {
    to: '/math/lsll',
    Icon: Boxes,
    zh: { title: 'LSLL 情况计数', desc: '最后一槽 + 顶层为什么是 583,284:原始态 → 两侧 AUF 的 Z4×Z4 商 → Burnside,含只商起手 AUF 的 2,332,800' },
    en: { title: 'Counting LSLL cases', desc: 'Why last-slot + last-layer is 583,284: raw states → two-sided AUF Z4×Z4 quotient → Burnside, incl. the pre-AUF-only 2,332,800' }
},
  {
    to: '/math/unit-distance',
    Icon: Ruler,
    zh: { title: '单位距离问题', desc: 'OpenAI 2026:AI 自主推翻 Erdős 1946 平面单位距离猜想,5 个互动可视化' },
    en: { title: 'Unit distance problem', desc: 'OpenAI 2026: AI autonomously disproves Erdős 1946 planar unit-distance conjecture — 5 interactive visualisations' }
},
];

export default function MathLandingPage() {
  useTranslation();
  const t = useT();

  return (
    <div className="math-hub-page">
      <style>{INLINE_CSS}</style>
      <BackHome />
      <header className="hub-header">
        <h1>{t('数学', 'Math')}</h1>
      </header>
      <section className="hub-feature" aria-labelledby="grh-feature-title">
        <h2 id="grh-feature-title">
          <Link href={GRH_PATH}>{t('广义黎曼猜想', 'Generalized Riemann Hypothesis')}</Link>
        </h2>
        <p>{t('经典黎曼猜想的形式化证明已通过 Lean 验证。了解它与狄利克雷 L 函数的关系，查看本机核验结果。', 'Lean has verified the formal proof of the classical Riemann hypothesis. Explore its connection to Dirichlet L-functions and see our local verification results.')}</p>
        <div className="hub-feature-links">
          <Link href={GRH_PATH + '#proof-route'}>{t('查看证明路线', 'Explore the proof')}</Link>
          <Link href={GRH_PATH + '#live'}>{t('查看核验结果', 'View verification results')}</Link>
        </div>
      </section>
      <div className="hub-grid">
        {CARDS.map((c) => (
          <Link key={c.to} href={c.to} prefetch={false} className="hub-card">
            <c.Icon size={28} />
            <div className="hub-card-title">{tr(c).title}</div>
            <div className="hub-card-desc">{tr(c).desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

const INLINE_CSS = `
.math-hub-page {
  max-width: 880px;
  margin: 0 auto;
  padding: 1.5rem 1rem 3rem;
  color: var(--foreground);
}
.hub-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}
.hub-toggles {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.hub-header h1 {
  margin: 0;
  font-size: 2rem;
  font-weight: 600;
  letter-spacing: -0.01em;
}
.math-hub-page .hub-feature {
  margin: 1rem 0 1.5rem;
  padding: 1rem 1.25rem;
  border-inline-start: .2rem solid var(--accent);
  background: var(--card);
}
.hub-feature h2 { margin: 0; font-size: 1.4rem; line-height: 1.3; }
.hub-feature h2 a { color: inherit; }
.hub-feature p { margin: .4rem 0 .7rem; color: var(--muted-foreground); }
.hub-feature-links { display: flex; flex-wrap: wrap; gap: .35rem 1.5rem; }
.hub-feature a { text-underline-offset: .2em; }
.hub-feature-links a, .hub-feature a:hover { color: var(--accent); text-decoration: underline; }
.hub-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
}
.hub-card {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1.25rem;
  background: var(--card);
  border: 1px solid var(--border-default);
  border-radius: 10px;
  color: var(--foreground);
  text-decoration: none;
  transition: transform 0.12s ease, border-color 0.12s ease;
}
.hub-card:hover {
  border-color: var(--accent);
  transform: translateY(-2px);
}
.hub-card-title {
  font-size: 1.15rem;
  font-weight: 600;
}
.hub-card-desc {
  color: var(--muted-foreground);
  font-size: 0.9rem;
  line-height: 1.45;
}
@media (max-width: 480px) {
  .math-hub-page { padding: 1rem 0.75rem 2rem; }
  .hub-header h1 { font-size: 1.5rem; }
}
`;
