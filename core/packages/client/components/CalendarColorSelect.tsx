'use client';

import { CompactSelect } from '@/components/CompactSelect';
import { tr, useLang } from '@/i18n/tr';
import { CALENDAR_COLOR_DEFS, colorHex, colorName } from '@/lib/calendar-colors';
import { useEffectiveTheme } from '@/lib/theme';
import './CalendarColorSelect.css';

interface Props {
  value: string;
  onChange: (color: string) => void;
  /** Provided for events, whose empty override inherits their calendar's color. */
  defaultColor?: string;
}

export default function CalendarColorSelect({ value, onChange, defaultColor }: Props) {
  const theme = useEffectiveTheme();
  const isZh = useLang() === 'zh';
  const label = (color: string, name: string) => <span className="calendar-color-label"><span className="calendar-color-chip" style={{ background: colorHex(color, theme) }} aria-hidden="true" />{name}</span>;
  const items = CALENDAR_COLOR_DEFS.map((c) => ({ value: c.key as string, name: tr(c), label: label(c.key, tr(c)) }));
  // Imported Google aliases share the same selection; custom hex remains lossless.
  const selected = CALENDAR_COLOR_DEFS.find((c) => c.key === value || `google:${c.hex}` === value.toLowerCase())?.key ?? value;
  if (value && !items.some((c) => c.value === selected)) {
    const name = colorName(value, isZh);
    items.push({ value, name, label: label(value, name) });
  }
  const defaultLabel = tr({ zh: '默认颜色', en: 'Default color' });
  if (defaultColor !== undefined) items.push({ value: '', name: defaultLabel, label: label(defaultColor, defaultLabel) });
  const current = items.find((item) => item.value === selected);

  return <CompactSelect className="calendar-color-select" popupClassName="calendar-color-menu" items={items} value={selected} label={current?.label ?? defaultLabel} ariaLabel={current?.name ?? defaultLabel} onChange={onChange} />;
}
