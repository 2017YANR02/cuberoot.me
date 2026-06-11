'use client';

/**
 * /scramble — hub for the 打乱-相关 子工具
 *   /scramble/stats     —— 打乱难度分布(WCA 1.2M 历史样本)
 *   /scramble/gen       —— 批量生成打乱
 *   /scramble/analyzer  —— 3x3 CFOP 打乱分析
 *   /scramble/solver    —— cubeopt 最优解 + 状态求解
 *   /scramble/pocket    —— 2x2x2 整解最优求解(Rust WASM 全空间精确表)
 *   /scramble/pattern   —— 著名 NxN 图案集
 *
 * 1:1 port from packages/client/src/pages/scramble/ScrambleHubPage.tsx (Vite SPA).
 */
import Link from '@/components/AppLink';
import { useTranslation } from 'react-i18next';
import { BarChart3, Box, Dices, Microscope, Sparkles, Wand2 } from 'lucide-react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import i18n from '@/i18n/i18n-client';

interface Card {
  to: string;
  Icon: typeof BarChart3;
  zh: { title: string; desc: string };
  en: { title: string; desc: string };
    zhHant?: { title: string; desc: string };
}

const CARDS: Card[] = [
  {
    to: '/scramble/gen',
    Icon: Dices,
    zh: { title: '生成', desc: '17 个 WCA 项目的随机状态打乱,tnoodle 风格 PDF' },
    en: { title: 'Generate', desc: 'Random-state scrambles for 17 WCA events, tnoodle-style PDF' },
      zhHant: { title: '生成', desc: '17 個 WCA 項目的隨機狀態打亂,tnoodle 風格 PDF' }
},
  {
    to: '/scramble/solver',
    Icon: Sparkles,
    zh: { title: '求解', desc: '3x3 任意状态最少步公式 — wasm 多线程' },
    en: { title: 'Solve', desc: 'Optimal HTM solution for any 3x3 state — multithreaded wasm' },
      zhHant: { title: '求解', desc: '3x3 任意狀態最少步公式 — wasm 多執行緒' }
},
  {
    to: '/scramble/analyzer',
    Icon: Microscope,
    zh: { title: '分析', desc: '3x3 打乱 → 6 色 cross / F2L / OLL / PLL 完整 CFOP 解' },
    en: { title: 'Analyze', desc: '3x3 scramble → all-color cross / F2L / OLL / PLL CFOP paths' },
      zhHant: { title: '分析', desc: '3x3 打亂 → 6 色 cross / F2L / OLL / PLL 完整 CFOP 解' }
},
  {
    to: '/scramble/stats',
    Icon: BarChart3,
    zh: { title: '分布', desc: 'WCA 历史 1,200,000 条三阶打乱阶段最优步数分布' },
    en: { title: 'Distribution', desc: 'Stage-optimal HTM distribution over 1.2M WCA 3x3 scrambles' },
      zhHant: { title: '分佈', desc: 'WCA 歷史 1,200,000 條三階打亂階段最優步數分佈' }
},
  {
    to: '/scramble/pocket',
    Icon: Box,
    zh: { title: '2x2x2 求解', desc: '任意 2x2x2 打乱的整解最优 HTM 解 — 全空间精确表' },
    en: { title: '2x2x2 Solve', desc: 'Optimal HTM solution for any 2x2x2 scramble — exact full-space table' },
      zhHant: { title: '2x2x2 求解', desc: '任意 2x2x2 打亂的整解最優 HTM 解 — 全空間精確表' }
},
  {
    to: '/scramble/pattern',
    Icon: Wand2,
    zh: { title: '图案', desc: '著名 3x3 / 4x4 / 5x5 / 6x6 / 7x7 图案集 (棋盘 / 十字 / 立方体中立方等)' },
    en: { title: 'Pattern', desc: 'Famous pretty patterns for 3×3 / 4×4 / 5×5 / 6×6 / 7×7 (checkerboard, cross, cube-in-cube, …)' },
      zhHant: { title: '圖案', desc: '著名 3x3 / 4x4 / 5x5 / 6x6 / 7x7 圖案集 (棋盤 / 十字 / 立方體中立方等)' }
},
];

export default function ScrambleHubPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const t = (zh: string, en: string, zhHant?: string) => i18n.language === 'zh-Hant' ? (zhHant ?? zh) : (isZh ? zh : en);
  useDocumentTitle('打乱', 'Scramble', "打亂");

  return (
    <div className="scramble-hub-page">
      <style>{INLINE_CSS}</style>
      <header className="hub-header">
        <h1>{t('打乱', 'Scramble', "打亂")}</h1>
      </header>
      <div className="hub-grid">
        {CARDS.map((c) => (
          <Link key={c.to} href={c.to} className="hub-card">
            <c.Icon size={28} />
            <div className="hub-card-title">{((i18n.language === 'zh-Hant' ? (c.zhHant ?? c.zh) : (i18n.language.startsWith('zh') ? c.zh : c.en))).title}</div>
            <div className="hub-card-desc">{((i18n.language === 'zh-Hant' ? (c.zhHant ?? c.zh) : (i18n.language.startsWith('zh') ? c.zh : c.en))).desc}</div>
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
