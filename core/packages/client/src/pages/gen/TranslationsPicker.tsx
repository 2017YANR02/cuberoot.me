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
import { Flag } from '../../utils/flag';

/** Locale → iso2. Empty string for languages without a single national flag (Breton, Esperanto). */
const LOCALE_TO_ISO2: Record<TnoodleLocale, string> = {
  br: '',          // Breton — Brittany region, no country (uses inline SVG below)
  da: 'dk',
  de: 'de',
  en: 'gb',        // British English
  eo: '',          // Esperanto — constructed (uses inline SVG below)
  es: 'es',
  et: 'ee',
  fi: 'fi',
  fr: 'fr',
  hr: 'hr',
  hu: 'hu',
  id: 'id',
  it: 'it',
  ja: 'jp',
  ko: 'kr',
  nb: 'no',
  pl: 'pl',
  pt: 'pt',
  'pt-BR': 'br',
  rm: 'ch',        // Romansh — Swiss
  ro: 'ro',
  ru: 'ru',
  sl: 'si',
  vi: 'vn',
  'zh-CN': 'cn',
  'zh-TW': 'tw',
};

/** Inline SVGs for non-national languages (Brezhoneg/Esperanto). */
const LOCALE_INLINE_FLAG: Partial<Record<TnoodleLocale, string>> = {
  // Gwenn-ha-du(布列塔尼旗):9 道横纹(5 黑 4 白)+ 左上角白色 ermine 角
  // 简化版省去 ermine 斑点(尺寸太小看不清),保留白色角 + 横纹
  br: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20" preserveAspectRatio="none">
    <rect width="30" height="20" fill="#ffffff"/>
    <rect y="0"      width="30" height="2.222" fill="#000"/>
    <rect y="4.444"  width="30" height="2.222" fill="#000"/>
    <rect y="8.889"  width="30" height="2.222" fill="#000"/>
    <rect y="13.333" width="30" height="2.222" fill="#000"/>
    <rect y="17.778" width="30" height="2.222" fill="#000"/>
    <rect width="11" height="9" fill="#fff"/>
  </svg>`,
  // Verda Stelo(世界语旗):绿底,左上 1/4 白色方块,内含绿色五角星
  eo: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20" preserveAspectRatio="none">
    <rect width="30" height="20" fill="#009933"/>
    <rect width="10" height="6.667" fill="#fff"/>
    <polygon points="5,0.83 5.56,2.56 7.38,2.56 5.91,3.63 6.47,5.35 5,4.29 3.53,5.35 4.09,3.63 2.62,2.56 4.44,2.56" fill="#009933"/>
  </svg>`,
};

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
            {TNOODLE_LOCALES.map((locale) => {
              const iso2 = LOCALE_TO_ISO2[locale];
              const inlineSvg = LOCALE_INLINE_FLAG[locale];
              const hasFlag = !!iso2 || !!inlineSvg;
              const isSel = selectedSet.has(locale);
              return (
                <label
                  key={locale}
                  className={`gen-tn-translations-cell${isSel ? ' is-selected' : ''}${hasFlag ? '' : ' no-flag'}`}
                >
                  <input
                    type="checkbox"
                    className="gen-tn-translations-input"
                    checked={isSel}
                    onChange={() => toggle(locale)}
                  />
                  {iso2 ? (
                    <Flag
                      iso2={iso2}
                      spanClassName="country-flag"
                      imgClassName="country-flag-ct"
                    />
                  ) : inlineSvg ? (
                    <span
                      className="country-flag-ct"
                      dangerouslySetInnerHTML={{ __html: inlineSvg }}
                    />
                  ) : null}
                  <span>{isZh ? LOCALE_DISPLAY_NAME[locale] : LOCALE_DISPLAY_NAME_EN[locale]}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
