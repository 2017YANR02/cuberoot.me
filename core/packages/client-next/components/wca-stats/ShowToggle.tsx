'use client';

import { tr } from '@/i18n/tr';


// Ported from packages/client/src/pages/wca_stats/ShowToggle.tsx.

export type ShowMode = 'persons' | 'results';

interface Props {
  value: ShowMode;
  onChange: (v: ShowMode) => void;
  isZh: boolean;
}

export default function ShowToggle({ value, onChange, isZh }: Props) {
  return (
    <div className="wse-show-toggle">
      <button
        type="button"
        className={value === 'persons' ? 'active' : ''}
        onClick={() => onChange('persons')}
      >
        {tr({ zh: '选手', en: 'Persons',
            zhHant: "選手"
        })}
      </button>
      <button
        type="button"
        className={value === 'results' ? 'active' : ''}
        onClick={() => onChange('results')}
      >
        {tr({ zh: '成绩', en: 'Results',
            zhHant: "成績"
        })}
      </button>
    </div>
  );
}
