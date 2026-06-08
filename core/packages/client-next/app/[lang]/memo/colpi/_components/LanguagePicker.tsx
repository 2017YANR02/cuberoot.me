'use client';

/**
 * Popup language picker — clones the upstream "Select words language" modal.
 * Two exports:
 *   <LanguagePicker> — self-contained trigger + popup (used in submit form)
 *   <LangPopup>      — popup body only, controlled via open prop (used by the
 *                       grid-corner trigger inside ColpiClient)
 */
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Flag } from '@/components/Flag';
import { LANGS, LANG_MAP, langDisplay } from '../_lib/langs';
import { ChevronDown, X, Globe } from 'lucide-react';
import { tr } from '@/i18n/tr';
import i18n from '@/i18n/i18n-client';

interface PopupProps {
  value: string;
  onChange: (code: string) => void;
  isZh: boolean;
  includeAll?: boolean;
  onClose: () => void;
  popupClassName?: string;
  title?: ReactNode;
}

export function LangPopup({
  value, onChange, isZh, includeAll = false, onClose, popupClassName, title,
}: PopupProps) {
  return (
    <div
      className={`colpi-langpicker-popup ${popupClassName ?? ''}`}
      role="dialog"
      aria-label={tr({ zh: '选择语言', en: 'Select language',
          zhHant: "選擇語言"
    })}
    >
      <div className="colpi-langpicker-popup-head">
        <span>{title ?? (tr({ zh: '选择语言', en: 'Select words language',
            zhHant: "選擇語言"
        }))}</span>
        <button type="button" onClick={onClose} aria-label="Close">
          <X size={14} />
        </button>
      </div>
      <div className="colpi-langpicker-grid">
        {includeAll && (
          <button
            type="button"
            className={`colpi-langpicker-item ${value === 'all' ? 'on' : ''}`}
            onClick={() => { onChange('all'); onClose(); }}
          >
            <Globe size={14} className="colpi-langpicker-flag" />
            <span>{tr({ zh: '全部', en: 'All' })}</span>
          </button>
        )}
        {LANGS.map(l => (
          <button
            type="button"
            key={l.code}
            className={`colpi-langpicker-item ${value === l.code ? 'on' : ''}`}
            onClick={() => { onChange(l.code); onClose(); }}
            title={l.code}
          >
            <Flag iso2={l.iso2} className="colpi-langpicker-flag" />
            <span>{(i18n.language === 'zh-Hant' ? (l.zhHant ?? l.zh) : (i18n.language.startsWith('zh') ? l.zh : l.en))}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

interface Props {
  value: string;
  onChange: (code: string) => void;
  isZh: boolean;
  includeAll?: boolean;
}

/** Self-contained trigger button + popup. Used in the submit form. */
export default function LanguagePicker({
  value, onChange, isZh, includeAll = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const current = value === 'all' ? null : LANG_MAP[value] ?? null;

  return (
    <div className="colpi-langpicker" ref={wrapRef}>
      <button
        type="button"
        className="colpi-langpicker-trigger"
        onClick={() => setOpen(o => !o)}
        title={tr({ zh: '词条语言', en: 'Word language',
            zhHant: "詞條語言"
        })}
      >
        {current ? (
          <Flag iso2={current.iso2} className="colpi-langpicker-flag" />
        ) : (
          <Globe size={14} />
        )}
        <span className="colpi-langpicker-label">
          {value === 'all'
            ? (tr({ zh: '全部语言', en: 'All langs',
                zhHant: "全部語言"
            }))
            : langDisplay(value, isZh)}
        </span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <LangPopup
          value={value}
          onChange={onChange}
          isZh={isZh}
          includeAll={includeAll}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
