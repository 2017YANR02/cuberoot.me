'use client';

/**
 * /scramble — 打乱工具入口。
 * 生成和求解为主要入口；花式与跨项目批量求解次之，其余专项工具使用紧凑卡片。
 * 桌面使用六列便当盒，窄屏按相同优先级排列为两列。
 */
import Link from '@/components/AppLink';
import BackHome from '@/components/BackHome';
import { useT } from "@/hooks/useT";
import { tr } from '@/i18n/tr';

interface Card {
  to: string;
  area: string;
  size: 'primary' | 'secondary' | 'compact';
  zh: { title: string };
  en: { title: string };
}

const CARDS: Card[] = [
  { to: '/scramble/gen', area: 'generate', size: 'primary', zh: { title: '生成' }, en: { title: 'Generate' } },
  { to: '/scramble/solver', area: 'solve', size: 'primary', zh: { title: '求解' }, en: { title: 'Solve' } },
  { to: '/scramble/pattern', area: 'pattern', size: 'secondary', zh: { title: '花式' }, en: { title: 'Pattern' } },
  { to: '/scramble/batch-solver', area: 'batch', size: 'secondary', zh: { title: '批量求解' }, en: { title: 'Batch Solver' } },
  { to: '/scramble/symmetry', area: 'symmetry', size: 'compact', zh: { title: '对称型' }, en: { title: 'Symmetry' } },
  { to: '/scramble/hardest', area: 'hardest', size: 'compact', zh: { title: '最难开局' }, en: { title: 'Hardest' } },
  { to: '/scramble/mcc', area: 'mcc', size: 'compact', zh: { title: 'MCC' }, en: { title: 'MCC' } },
  { to: '/scramble/sub-solver', area: 'subsolver', size: 'compact', zh: { title: '子群求解' }, en: { title: 'Subsolver' } },
];

export default function ScrambleHubPage() {
  const t = useT();

  return (
    <div className="scramble-hub-page">
      <BackHome />
      <style>{INLINE_CSS}</style>
      <header className="scramble-hub-header">
        <h1>{t('打乱', 'Scramble')}</h1>
      </header>
      <div className="scramble-hub-grid">
        {CARDS.map((c) => (
          <Link
            key={c.to}
            href={c.to}
            prefetch={false}
            className={`scramble-hub-card scramble-hub-card--${c.size}`}
            data-site-surface="panel"
            style={{ gridArea: c.area }}
          >
            <div className="scramble-hub-card-title">{tr(c).title}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

const INLINE_CSS = `
.scramble-hub-page {
  max-width: 1120px;
  margin: 0 auto;
  padding: 1.5rem 1rem 3rem;
  color: var(--foreground);
}
.scramble-hub-page .scramble-hub-header {
  margin-bottom: 1.5rem;
}
.scramble-hub-page .scramble-hub-header h1 {
  margin: 0;
  font-size: 2rem;
  font-weight: 600;
  letter-spacing: -0.01em;
}
.scramble-hub-page .scramble-hub-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  grid-template-rows: minmax(13rem, auto) repeat(2, minmax(5.5rem, auto));
  grid-template-areas:
    "generate generate generate solve solve solve"
    "pattern pattern batch batch symmetry hardest"
    "pattern pattern batch batch mcc subsolver";
  gap: 0.75rem;
}
.scramble-hub-page .scramble-hub-card {
  display: flex;
  align-items: flex-end;
  min-width: 0;
  padding: 1rem;
  border: 1px solid var(--border-default);
  border-radius: 12px;
  color: var(--foreground);
  text-decoration: none;
}
.scramble-hub-page .scramble-hub-card:hover {
  border-color: var(--accent);
}
.scramble-hub-page .scramble-hub-card:hover .scramble-hub-card-title {
  color: var(--accent);
}
.scramble-hub-page .scramble-hub-card:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 3px;
}
.scramble-hub-page .scramble-hub-card:active {
  transform: translateY(1px);
}
.scramble-hub-page .scramble-hub-card-title {
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.3;
  overflow-wrap: anywhere;
}
.scramble-hub-page .scramble-hub-card--primary {
  padding: 1.5rem;
}
.scramble-hub-page .scramble-hub-card--primary .scramble-hub-card-title {
  font-size: 2rem;
}
.scramble-hub-page .scramble-hub-card--secondary .scramble-hub-card-title {
  font-size: 1.25rem;
}
@media (max-width: 720px) {
  .scramble-hub-page .scramble-hub-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-template-rows: none;
    grid-template-areas: none;
    grid-auto-rows: minmax(5.5rem, auto);
  }
  .scramble-hub-page .scramble-hub-card { grid-area: auto !important; }
  .scramble-hub-page .scramble-hub-card--primary { min-height: 10rem; }
  .scramble-hub-page .scramble-hub-card--secondary { min-height: 8rem; }
}
@media (max-width: 480px) {
  .scramble-hub-page { padding: 1rem 0.75rem 2rem; }
  .scramble-hub-page .scramble-hub-header h1 { font-size: 1.5rem; }
  .scramble-hub-page .scramble-hub-card--primary { padding: 1rem; }
  .scramble-hub-page .scramble-hub-card--primary .scramble-hub-card-title { font-size: 1.5rem; }
}
`;
