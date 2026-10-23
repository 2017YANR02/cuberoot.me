'use client';

import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { CompactSelect } from '@/components/CompactSelect';
import { ACCENT_COLORS, findAccentColor, type AccentId } from '@/lib/accent-colors';
import { applyAccent, readAccent } from '@/lib/theme';
import { tr } from '@/i18n/tr';
import './accent-color-select.css';

export default function AccentColorSelect() {
  const [accent, setAccent] = useState<AccentId | null>(null);
  useEffect(() => {
    const refresh = () => setAccent(readAccent());
    refresh();
    window.addEventListener('theme-change', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('theme-change', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const options = [
    { value: '', name: tr({ zh: '跟随配色', en: 'Follow color theme' }), swatch: 'var(--accent)' },
    ...ACCENT_COLORS.map(color => ({ value: color.id, name: tr(color), swatch: color.swatch })),
  ];
  const current = options.find(option => option.value === (accent ?? '')) ?? options[0];
  const colorLabel = (option: typeof current) => <span className="accent-color-label">
    <i className="accent-color-select-swatch" style={{ background: option.swatch }} aria-hidden="true" />
    <span>{option.name}</span>
  </span>;

  return <div className="accent-color-select">
    <span>{tr({ zh: '强调色', en: 'Accent color' })}</span>
    <CompactSelect className="accent-color-select-value" popupClassName="accent-color-menu"
      label={colorLabel(current)} value={accent ?? ''}
      ariaLabel={tr({ zh: '强调色', en: 'Accent color' })}
      items={options.map(option => ({ value: option.value, label: <span className="accent-color-option">
        <Check className="accent-color-check" aria-hidden="true" />{colorLabel(option)}
      </span> }))}
      onChange={value => applyAccent(findAccentColor(value)?.id ?? null)} />
  </div>;
}
