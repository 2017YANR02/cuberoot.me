'use client';

import { CalendarDays, Earth, LayoutGrid, List } from '@app-foundation/icons/lucide';
import { tr } from '@/i18n/tr';
import { COMPETITION_VIEWS, type CompetitionView } from '@/lib/competition-calendar';
import './competition-view-toggle.css';

const VIEWS = {
  calendar: { Icon: CalendarDays, label: { zh: '日历', en: 'Calendar' } },
  card: { Icon: LayoutGrid, label: { zh: '卡片', en: 'Cards' } },
  list: { Icon: List, label: { zh: '列表', en: 'List' } },
  globe: { Icon: Earth, label: { zh: '地球', en: 'Globe' } },
};

export function CompetitionViewToggle({ view, onViewChange }: {
  view: CompetitionView;
  onViewChange: (view: CompetitionView) => void;
}) {
  return (
    <div className="competition-view-toggle" role="tablist" aria-label={tr({ zh: '视图切换', en: 'View toggle' })}>
      {COMPETITION_VIEWS.map(option => {
        const { Icon, label } = VIEWS[option];
        const name = tr(label);
        return (
          <button
            key={option}
            type="button"
            role="tab"
            aria-selected={option === view}
            className={`competition-view-btn${option === view ? ' is-active' : ''}`}
            onClick={() => onViewChange(option)}
            aria-label={name}
            title={name}
          >
            <Icon size={16} strokeWidth={1.75} />
          </button>
        );
      })}
    </div>
  );
}
