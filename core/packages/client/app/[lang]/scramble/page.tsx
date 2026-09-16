'use client';

/**
 * /scramble — 打乱工具入口。
 * 生成和求解为主要入口；花式与跨项目批量求解次之，其余专项工具使用紧凑卡片。
 * 桌面分为两张主卡、两张中卡和四张专业工具卡；窄屏按同一顺序排列为两列。
 */
import Link from '@/components/AppLink';
import BackHome from '@/components/BackHome';
import { useT } from "@/hooks/useT";
import { tr } from '@/i18n/tr';
import type { CSSProperties } from 'react';

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
            className={`scramble-hub-card scramble-hub-card--${c.size} scramble-hub-card--${c.area}`}
            data-site-surface="panel"
            style={{
              gridArea: c.area,
              '--scramble-card-art': `url("/scramble-card-art/${c.area}.webp")`,
            } as CSSProperties}
          >
            <span className="scramble-hub-art" aria-hidden="true">
              <span className="scramble-hub-art-image" />
              {c.area === 'generate' && (
                <span className="scramble-hub-art-formula">
                  {"F B2 R B' U2 R B' U B' R2 U2 D2 F' R2 D2 F U2 B' D2 F' U"}
                </span>
              )}
              {c.area === 'hardest' && <span className="scramble-hub-art-note">H* 20</span>}
              {c.area === 'subsolver' && <span className="scramble-hub-art-note">U / R / F</span>}
            </span>
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
  grid-template-columns: repeat(4, minmax(0, 1fr));
  grid-template-areas:
    "generate generate solve solve"
    "pattern pattern batch batch"
    "symmetry hardest mcc subsolver";
  gap: 0.75rem;
}
.scramble-hub-page .scramble-hub-card {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-width: 0;
  padding: 1.25rem;
  border: 1px solid var(--border-default);
  border-radius: 12px;
  color: var(--foreground);
  text-decoration: none;
}
/* Illustration and title occupy separate rows; artwork never fades across text. */
.scramble-hub-page .scramble-hub-art {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  height: 5.75rem;
  min-width: 0;
  pointer-events: none;
  user-select: none;
}
.scramble-hub-page .scramble-hub-art-image {
  flex: 1;
  width: 100%;
  min-height: 0;
  background-image: var(--scramble-card-art);
  background-repeat: no-repeat;
  background-position: center;
  background-size: contain;
  opacity: 0.9;
}
.scramble-hub-page .scramble-hub-card--primary .scramble-hub-art {
  height: 11rem;
}
.scramble-hub-page .scramble-hub-card--secondary .scramble-hub-art {
  height: 8rem;
}
.scramble-hub-page .scramble-hub-card--generate .scramble-hub-art-image {
  max-height: 7rem;
}
.scramble-hub-page .scramble-hub-card--batch .scramble-hub-art-image {
  max-height: 6rem;
}
.scramble-hub-page .scramble-hub-card--symmetry .scramble-hub-art-image {
  max-width: 12rem;
  max-height: 5.75rem;
}
.scramble-hub-page .scramble-hub-art-formula,
.scramble-hub-page .scramble-hub-art-note {
  color: var(--muted-foreground);
  font-family: ui-monospace, monospace;
  font-variant-numeric: tabular-nums;
  line-height: 1.5;
  text-align: center;
}
.scramble-hub-page .scramble-hub-art-formula {
  max-width: 100%;
  font-size: 0.75rem;
}
.scramble-hub-page .scramble-hub-art-note {
  font-size: 0.8125rem;
}
.scramble-hub-page .scramble-hub-card:hover,
.scramble-hub-page .scramble-hub-card:focus-visible {
  border-color: var(--accent);
}
.scramble-hub-page .scramble-hub-card:hover .scramble-hub-card-title,
.scramble-hub-page .scramble-hub-card:focus-visible .scramble-hub-card-title {
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
  margin-top: auto;
  font-size: 1.125rem;
  font-weight: 600;
  line-height: 1.3;
  overflow-wrap: anywhere;
}
.scramble-hub-page .scramble-hub-card--primary .scramble-hub-card-title {
  font-size: 1.75rem;
}
.scramble-hub-page .scramble-hub-card--secondary .scramble-hub-card-title {
  font-size: 1.375rem;
}
@media (max-width: 720px) {
  .scramble-hub-page .scramble-hub-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-template-rows: none;
    grid-template-areas: none;
  }
  .scramble-hub-page .scramble-hub-card { grid-area: auto !important; }
  .scramble-hub-page .scramble-hub-card--primary .scramble-hub-art { height: 8rem; }
  .scramble-hub-page .scramble-hub-card--secondary .scramble-hub-art { height: 6rem; }
  .scramble-hub-page .scramble-hub-art-formula { display: none; }
}
@media (max-width: 480px) {
  .scramble-hub-page { padding: 1rem 0.75rem 2rem; }
  .scramble-hub-page .scramble-hub-header h1 { font-size: 1.5rem; }
  .scramble-hub-page .scramble-hub-card { padding: 1rem; }
  .scramble-hub-page .scramble-hub-card--primary .scramble-hub-card-title { font-size: 1.375rem; }
  .scramble-hub-page .scramble-hub-card--secondary .scramble-hub-card-title { font-size: 1.125rem; }
}
`;
