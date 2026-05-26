'use client';

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
        {isZh ? '选手' : 'Persons'}
      </button>
      <button
        type="button"
        className={value === 'results' ? 'active' : ''}
        onClick={() => onChange('results')}
      >
        {isZh ? '成绩' : 'Results'}
      </button>
    </div>
  );
}
