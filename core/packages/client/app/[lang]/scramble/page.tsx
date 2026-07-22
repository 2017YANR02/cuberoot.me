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
import BackHome from '@/components/BackHome';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useT } from "@/hooks/useT";
import { tr } from '@/i18n/tr';

interface Card {
  to: string;
  zh: { title: string };
  en: { title: string };
}

const CARDS: Card[] = [
  { to: '/scramble/gen', zh: { title: '生成' }, en: { title: 'Generate' } },
  { to: '/scramble/solver', zh: { title: '求解' }, en: { title: 'Solve' } },
  { to: '/scramble/pattern', zh: { title: '花式' }, en: { title: 'Pattern' } },
  { to: '/scramble/mcc', zh: { title: 'MCC' }, en: { title: 'MCC' } },
  { to: '/scramble/batch-solver', zh: { title: '批量求解' }, en: { title: 'Batch Solver' } },
  { to: '/scramble/sub-solver', zh: { title: '子群求解' }, en: { title: 'Subsolver' } },
];

export default function ScrambleHubPage() {
  const t = useT();
  useDocumentTitle('打乱', 'Scramble');

  return (
    <div className="scramble-hub-page">
      <BackHome />
      <style>{INLINE_CSS}</style>
      <header className="hub-header">
        <h1>{t('打乱', 'Scramble')}</h1>
      </header>
      <div className="hub-grid">
        {CARDS.map((c) => (
          <Link key={c.to} href={c.to} className="hub-card">
            <div className="hub-card-title">{tr(c).title}</div>
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
  display: flex;
  flex-wrap: wrap;
  gap: 2rem;
}
.hub-card {
  color: var(--foreground);
  text-decoration: none;
}
.hub-card:hover .hub-card-title {
  color: var(--accent);
}
.hub-card-title {
  font-size: 1.15rem;
  font-weight: 600;
}
@media (max-width: 480px) {
  .scramble-hub-page { padding: 1rem 0.75rem 2rem; }
  .hub-header h1 { font-size: 1.5rem; }
}
`;
