'use client';

import { useT } from '@/hooks/useT';
import type { AlgNotationStyle } from '@/lib/alg-notation-display';
import './alg-notation-style-select.css';

interface Props {
  value: AlgNotationStyle;
  onChange: (value: AlgNotationStyle) => void;
  className?: string;
}

/** Shared notation-style menu for algorithm pages and the notation guide. */
export default function AlgNotationStyleSelect({ value, onChange, className }: Props) {
  const t = useT();

  return (
    <select
      className={`alg-notation-style-select${className ? ` ${className}` : ''}`}
      value={value}
      onChange={event => onChange(event.target.value as AlgNotationStyle)}
      aria-label={t('转动记号', 'Move notation')}
    >
      <option value="standard">{t('英文', 'English')}</option>
      <option value="zh-compact">{t('紧凑', 'Compact')}</option>
      <option value="dumb">{t('傻瓜', 'Foolproof')}</option>
    </select>
  );
}
