/**
 * /math — hub for math subpages
 *   /math/group  —— Rubik's Cube & group theory (long-form, 26 sections)
 *   /math/god    —— God's Number across all 17 WCA puzzles
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Infinity as InfinityIcon, Sigma, Dices, Ruler } from 'lucide-react';
import LangToggle from '../../components/LangToggle';
import ThemeToggle from '../../components/ThemeToggle';
import { useDocumentTitle } from '../../utils/useDocumentTitle';

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
    en: { title: "God's number", desc: 'Cayley-graph diameter for all 17 WCA puzzles (exact / bounds) + group theory + live BFS' },
  },
  {
    to: '/math/demigod',
    Icon: Dices,
    zh: { title: '半神之数', desc: 'Merino & Subercaseaux 2024:用 500k 样本 + Hoeffding 证 D ≤ 36,概率上界互动版' },
    en: { title: "Demigod's number", desc: 'Merino & Subercaseaux 2024: 500k samples + Hoeffding prove D ≤ 36 — the high-probability bound interactive' },
  },
  {
    to: '/math/group',
    Icon: Sigma,
    zh: { title: '魔方与群', desc: '群论长文 26 节,25 个互动面板,KaTeX 渲染' },
    en: { title: 'Cube as a group', desc: '26-section group-theory essay, 25 interactive panels, KaTeX-rendered' },
  },
  {
    to: '/math/unit-distance',
    Icon: Ruler,
    zh: { title: '单位距离问题', desc: 'OpenAI 2026:AI 自主推翻 Erdős 1946 平面单位距离猜想,5 个互动可视化' },
    en: { title: 'Unit distance problem', desc: 'OpenAI 2026: AI autonomously disproves Erdős 1946 planar unit-distance conjecture — 5 interactive visualisations' },
  },
];

export default function MathLandingPage() {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  useDocumentTitle('数学', 'Math');
  const t = (zh: string, en: string) => (isZh ? zh : en);

  return (
    <div className="math-hub-page">
      <style>{INLINE_CSS}</style>
      <header className="hub-header">
        <h1>{t('数学', 'Math')}</h1>
        <div className="hub-toggles">
          <LangToggle variant="inline" />
          <ThemeToggle />
        </div>
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
