/**
 * Multi-language picker for FMC scramble sheet (per round).
 * Mirrors the tnoodle UI "Translations" panel: a checkbox grid of all 26 locales
 * with Select All / Select None convenience buttons.
 */
import { useState } from 'react';
import { ChevronDown, ChevronUp, Languages } from 'lucide-react';
import {
  TNOODLE_LOCALES,
  LOCALE_DISPLAY_NAME,
  LOCALE_DISPLAY_NAME_EN,
  type TnoodleLocale,
} from './tnoodle_translate';

interface Props {
  selected: TnoodleLocale[];
  onChange: (next: TnoodleLocale[]) => void;
  isZh: boolean;
}

export default function TranslationsPicker({ selected, onChange, isZh }: Props) {
  const [open, setOpen] = useState(false);
  const selectedSet = new Set(selected);
  const summary = selected.length === 0
    ? (isZh ? '未选择语言' : 'No languages')
    : selected.length === TNOODLE_LOCALES.length
      ? (isZh ? '全部语言' : 'All languages')
      : selected.length <= 3
        ? selected.map((l) => (isZh ? LOCALE_DISPLAY_NAME[l] : LOCALE_DISPLAY_NAME_EN[l])).join(', ')
        : `${selected.length} ${isZh ? '种语言' : 'languages'}`;

  const toggle = (locale: TnoodleLocale) => {
    if (selectedSet.has(locale)) {
      onChange(selected.filter((l) => l !== locale));
    } else {
      onChange([...selected, locale]);
    }
  };

  return (
    <div className="gen-tn-translations">
      <button
        type="button"
        className="gen-tn-translations-summary"
        onClick={() => setOpen((o) => !o)}
        title={isZh ? '为 FMC 解题纸选择翻译语言' : 'Choose translations for FMC solution sheet'}
      >
        <Languages size={14} />
        <span className="gen-tn-translations-label">{isZh ? '翻译' : 'Translations'}</span>
        <span className="gen-tn-translations-count">{summary}</span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {open && (
        <div className="gen-tn-translations-body">
          <div className="gen-tn-translations-actions">
            <button
              type="button"
              className="gen-tn-translations-btn"
              onClick={() => onChange([...TNOODLE_LOCALES])}
            >
              {isZh ? '全选' : 'Select All'}
            </button>
            <button
              type="button"
              className="gen-tn-translations-btn"
              onClick={() => onChange([])}
            >
              {isZh ? '清空' : 'Select None'}
            </button>
          </div>
          <div className="gen-tn-translations-grid">
            {TNOODLE_LOCALES.map((locale) => (
              <label key={locale} className="gen-tn-translations-cell">
                <input
                  type="checkbox"
                  checked={selectedSet.has(locale)}
                  onChange={() => toggle(locale)}
                />
                <span>{isZh ? LOCALE_DISPLAY_NAME[locale] : LOCALE_DISPLAY_NAME_EN[locale]}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
