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
import { Infinity as InfinityIcon, Sigma, Dices, Ruler, Boxes, Percent, ListOrdered } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useT } from "@/hooks/useT";
import { tr } from '@/i18n/tr';

interface Card {
  to: string;
  Icon: typeof Sigma;
  zh: { title: string; desc: string };
  en: { title: string; desc: string };
}

const CARDS: Card[] = [
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
  {
    to: '/math/gcd-sequence',
    Icon: ListOrdered,
    zh: { title: '公因子数列', desc: '一道数论证明题:每一项都与之前所有项有公因子的贪心数列,最终满足 a(n+T) = a(n) + L' },
    en: { title: 'Common-factor sequence', desc: 'A number-theory proof: a greedy sequence sharing a factor with every earlier term is eventually linear-periodic a(n+T) = a(n) + L' }
},
];

export default function MathLandingPage() {
  useTranslation();
  useDocumentTitle('数学', 'Math');
  const t = useT();

  return (
    <div className="math-hub-page">
      <style>{INLINE_CSS}</style>
      <BackHome />
      <header className="hub-header">
        <h1>{t('数学', 'Math')}</h1>
      </header>
      <div className="hub-grid">
        {CARDS.map((c) => (
          <Link key={c.to} href={c.to} className="hub-card">
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
