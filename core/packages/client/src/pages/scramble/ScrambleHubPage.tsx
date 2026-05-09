/**
 * /scramble — hub for the 4 打乱-相关 子工具
 *   /scramble/stats     —— 打乱难度分布(WCA 1.2M 历史样本)
 *   /scramble/gen       —— 批量生成打乱
 *   /scramble/analyzer  —— 3x3 CFOP 打乱分析
 *   /scramble/solver    —— cubeopt 最优解 + 状态求解
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BarChart3, Dices, Microscope, Sparkles } from 'lucide-react';
import LangToggle from '../../components/LangToggle';

interface Card {
  to: string;
  Icon: typeof BarChart3;
  zh: { title: string; desc: string };
  en: { title: string; desc: string };
}

const CARDS: Card[] = [
  {
    to: '/scramble/gen',
    Icon: Dices,
    zh: { title: '生成', desc: '17 个 WCA 项目的随机状态打乱,tnoodle 风格 PDF' },
    en: { title: 'Generate', desc: 'Random-state scrambles for 17 WCA events, tnoodle-style PDF' },
  },
  {
    to: '/scramble/solver',
    Icon: Sparkles,
    zh: { title: '求解', desc: '3x3 任意状态最少步公式 — wasm 多线程' },
    en: { title: 'Solve', desc: 'Optimal HTM solution for any 3x3 state — multithreaded wasm' },
  },
  {
    to: '/scramble/analyzer',
    Icon: Microscope,
    zh: { title: '分析', desc: '3x3 打乱 → 6 色 cross / F2L / OLL / PLL 完整 CFOP 解' },
    en: { title: 'Analyze', desc: '3x3 scramble → all-color cross / F2L / OLL / PLL CFOP paths' },
  },
  {
    to: '/scramble/stats',
    Icon: BarChart3,
    zh: { title: '分布', desc: 'WCA 历史 1,200,000 条三阶打乱阶段最优步数分布' },
    en: { title: 'Distribution', desc: 'Stage-optimal HTM distribution over 1.2M WCA 3x3 scrambles' },
  },
];

export default function ScrambleHubPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  const t = (zh: string, en: string) => (isZh ? zh : en);

  return (
    <div className="scramble-hub-page">
      <style>{INLINE_CSS}</style>
      <header className="hub-header">
        <h1>{t('打乱', 'Scramble')}</h1>
        <LangToggle variant="inline" />
      </header>
      <div className="hub-grid">
        {CARDS.map((c) => (
          <Link key={c.to} to={c.to} className="hub-card">
            <c.Icon size={28} />
            <div className="hub-card-title">{(isZh ? c.zh : c.en).title}</div>
            <div className="hub-card-desc">{(isZh ? c.zh : c.en).desc}</div>
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
  color: var(--text);
}
.hub-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}
.hub-header h1 {
  margin: 0;
  font-size: 2rem;
  font-weight: 600;
  letter-spacing: -0.01em;
}
.hub-lead {
  color: var(--text-muted, #aaa);
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
  background: var(--panel, #1f1f1f);
  border: 1px solid var(--border, #333);
  border-radius: 10px;
  color: var(--text);
  text-decoration: none;
  transition: transform 0.12s ease, border-color 0.12s ease;
}
.hub-card:hover {
  border-color: var(--accent, #ff8800);
  transform: translateY(-2px);
}
.hub-card-title {
  font-size: 1.15rem;
  font-weight: 600;
}
.hub-card-desc {
  color: var(--text-muted, #aaa);
  font-size: 0.9rem;
  line-height: 1.45;
}
@media (max-width: 480px) {
  .scramble-hub-page { padding: 1rem 0.75rem 2rem; }
  .hub-header h1 { font-size: 1.5rem; }
}
`;
