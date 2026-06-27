'use client';

/**
 * /scramble — hub for the 打乱-相关 子工具
 *   /scramble/stats     —— 打乱难度分布(WCA 1.2M 历史样本)
 *   /scramble/gen       —— 批量生成打乱
 *   /scramble/analyzer  —— 3x3 CFOP 打乱分析
 *   /scramble/solver    —— 统一求解(?event= 分发):3×3 cubeopt 最优解+状态求解、
 *                          2×2/金字塔/斜转 Rust WASM 全空间精确表、SQ1 两阶段近最优
 *   /scramble/pattern   —— 著名 NxN 图案集
 *
 * 1:1 port from packages/client-vite/src/pages/scramble/ScrambleHubPage.tsx (Vite SPA).
 */
import Link from '@/components/AppLink';
import { Dices, Sparkles, Wand2 } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useT } from "@/hooks/useT";
import { tr } from '@/i18n/tr';

interface Card {
  to: string;
  Icon: typeof Dices;
  zh: { title: string; desc: string };
  en: { title: string; desc: string };
}

const CARDS: Card[] = [
  {
    to: '/scramble/gen',
    Icon: Dices,
    zh: { title: '生成', desc: '17 个 WCA 项目的随机状态打乱,tnoodle 风格 PDF' },
    en: { title: 'Generate', desc: 'Random-state scrambles for 17 WCA events, tnoodle-style PDF' }
},
  {
    to: '/scramble/solver',
    Icon: Sparkles,
    zh: { title: '求解', desc: '3×3 最优解 / 逐阶段 / CFOP / DR,2×2×2 / 金字塔 / 斜转最优解,打乱步数分布' },
    en: { title: 'Solve', desc: 'Optimal 3×3 / stage / CFOP / DR, plus 2×2×2 / Pyraminx / Skewb optimal solvers and step distributions' }
},
  {
    to: '/scramble/pattern',
    Icon: Wand2,
    zh: { title: '图案', desc: '著名 3x3 / 4x4 / 5x5 / 6x6 / 7x7 图案集 (棋盘 / 十字 / 立方体中立方等)' },
    en: { title: 'Pattern', desc: 'Famous pretty patterns for 3×3 / 4×4 / 5×5 / 6×6 / 7×7 (checkerboard, cross, cube-in-cube, …)' }
},
];

export default function ScrambleHubPage() {
  const t = useT();
  useDocumentTitle('打乱', 'Scramble');

  return (
    <div className="scramble-hub-page">
      <style>{INLINE_CSS}</style>
      <header className="hub-header">
        <h1>{t('打乱', 'Scramble')}</h1>
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
.scramble-hub-page {
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
.hub-lead {
  color: var(--muted-foreground);
  margin: 0 0 1.5rem;
  line-height: 1.6;
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
  .scramble-hub-page { padding: 1rem 0.75rem 2rem; }
  .hub-header h1 { font-size: 1.5rem; }
}
`;
