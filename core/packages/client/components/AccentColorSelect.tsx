'use client';
import './settings-typography.css';

import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { HexColorPicker } from 'react-colorful';
import { CompactSelect } from '@/components/CompactSelect';
import { ACCENT_COLORS, findAccentColor, type AccentId } from '@/lib/accent-colors';
import { applyAccent, previewAccent, readAccent } from '@/lib/theme';
import { tr } from '@/i18n/tr';
import './accent-color-select.css';

export default function AccentColorSelect() {
  const [accent, setAccent] = useState<AccentId | null>(null);
  const [customHex, setCustomHex] = useState<string>(ACCENT_COLORS[0].swatch);
  const custom = accent?.startsWith('#') ?? false;
  const previewingRef = useRef(false);
  const endPreview = () => {
    if (!previewingRef.current) return;
    previewingRef.current = false;
    previewAccent(readAccent());
  };
  useEffect(() => () => endPreview(), []);
  useEffect(() => {
    const refresh = () => {
      const value = readAccent();
      setAccent(value);
      if (value?.startsWith('#')) setCustomHex(value);
    };
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
    { value: 'custom', name: tr({ zh: '自定义', en: 'Custom' }), swatch: customHex },
  ];
  const current = options.find(option => option.value === (custom ? 'custom' : accent ?? '')) ?? options[0];
  const colorLabel = (option: typeof current) => <span className="accent-color-label">
    <i className="accent-color-select-swatch" style={{ background: option.swatch }} aria-hidden="true" />
    <span>{option.name}</span>
  </span>;

  return <div className="accent-color-select">
    <span>{tr({ zh: '强调色', en: 'Accent color' })}</span>
    <div className="accent-color-controls">
    <CompactSelect className="accent-color-select-value" popupClassName="settings-typography accent-color-menu"
      label={colorLabel(current)} value={custom ? 'custom' : accent ?? ''}
      ariaLabel={tr({ zh: '强调色', en: 'Accent color' })}
      items={options.map(option => ({ value: option.value, label: <span className="accent-color-option">
        <Check className="accent-color-check" aria-hidden="true" />{colorLabel(option)}
      </span> }))}
      onPreview={value => {
        if (value === null) endPreview();
        else {
          previewingRef.current = true;
          previewAccent(findAccentColor(value === 'custom' ? customHex : value)?.id ?? null);
        }
      }}
      onOpenChange={open => { if (!open) endPreview(); }}
      onChange={value => {
        previewingRef.current = false;
        applyAccent(findAccentColor(value === 'custom' ? customHex : value)?.id ?? null);
      }} />
    {custom && <div className="accent-color-custom">
      <CompactSelect className="accent-color-picker-trigger" popupClassName="settings-typography accent-color-menu accent-color-picker"
        ariaLabel={tr({ zh: '自定义强调色', en: 'Custom accent color' })}
        label={<i className="accent-color-select-swatch" style={{ background: accent ?? customHex }} aria-hidden="true" />}
        items={[]} onChange={() => {}} showArrow={false} unstyledTrigger
        panelContent={<HexColorPicker color={accent ?? customHex}
          onChange={value => applyAccent(value as AccentId)} />} />
      <input className="accent-color-hex-input" type="text" value={customHex} maxLength={7} spellCheck={false}
        aria-label={tr({ zh: 'HEX 色值', en: 'HEX color' })}
        aria-invalid={!findAccentColor(customHex)}
        onChange={event => {
          setCustomHex(event.target.value);
          const color = findAccentColor(event.target.value);
          if (color?.id.startsWith('#')) applyAccent(color.id);
        }}
        onBlur={() => setCustomHex(readAccent() ?? ACCENT_COLORS[0].swatch)}
        onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} />
    </div>}
    </div>
  </div>;
}
