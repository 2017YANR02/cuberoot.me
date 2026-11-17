'use client';

import { useEffect, useRef } from 'react';
import { CompactSelect } from '@cuberoot/timer-ui/compact-select';
import { ArrowLeft } from 'lucide-react';
import { AppearanceSettings, type AppearanceSettingsProps } from './AppearanceSettings';

/** App-level page; the host owns navigation and restores the previous surface. */
export function AppAppearanceSettings({ onClose, ...props }: AppearanceSettingsProps & { onClose: () => void }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const restoreFocus = previous?.matches(':focus-visible') ?? false;
    headingRef.current?.focus({ preventScroll: true });
    return () => { if (restoreFocus && previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, []);
  return <section className="app-appearance-settings" aria-label={{ zh: '外观', en: 'Appearance' }[props.value.locale]}>
    <header className="app-appearance-settings-header">
      <button className="app-appearance-settings-back" type="button" onClick={onClose}
        aria-label={{ zh: '返回', en: 'Back' }[props.value.locale]}><ArrowLeft size={20} /></button>
      <h1 ref={headingRef} tabIndex={-1} className="app-appearance-settings-title">{{ zh: '外观', en: 'Appearance' }[props.value.locale]}</h1>
    </header>
    <div className="app-appearance-settings-scroll settings-typography">
      <div className="app-appearance-settings-language accent-color-select">
        <span>{{ zh: '语言', en: 'Language' }[props.value.locale]}</span>
        <CompactSelect className="accent-color-select-value" popupClassName="settings-typography accent-color-menu"
          ariaLabel={{ zh: '语言', en: 'Language' }[props.value.locale]} value={props.value.locale}
          label={{ zh: '简体中文', en: 'English' }[props.value.locale]}
          items={[{ value: 'en', label: 'English' }, { value: 'zh', label: '简体中文' }]}
          onChange={locale => props.onChange({ locale })} />
      </div>
      <AppearanceSettings {...props} />
    </div>
  </section>;
}
