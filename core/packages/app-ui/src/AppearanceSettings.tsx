'use client';

import { useEffect, useState } from 'react';
import { Check, Monitor, Moon, Sun } from 'lucide-react';
import { HexColorPicker } from 'react-colorful';
import { CompactSelect } from '@cuberoot/timer-ui/compact-select';
import BoolToggle from '@cuberoot/timer-ui/bool-toggle';
import {
  ACCENT_COLORS, findAccentColor, PALETTES, HOME_BACKGROUNDS, HOME_BACKGROUND_ASSETS,
  resolveHomeBackground, type AccentId, type AppearancePreferences, type HomeBackgroundChoice,
} from '@cuberoot/shared/appearance';
import '@cuberoot/timer-ui/compact-select.css';
import './app-appearance-settings.css';
import './settings-typography.css';
import { readRememberedAppearanceBackground } from './appearance-storage';

type Language = AppearancePreferences['locale'];
type Patch = Partial<AppearancePreferences>;
type Preview = (patch: Patch | null) => void;

export function AppearanceThemeControl({ language, theme, palette, onChange, onPreview }: {
  language: Language; theme: AppearancePreferences['theme']; palette: AppearancePreferences['palette'];
  onChange: (patch: Patch) => void; onPreview?: Preview;
}) {
  const options = [
    { value: 'system', label: <span className="accent-color-label"><Monitor size={18} />{{ zh: '跟随系统', en: 'System' }[language]}</span> },
    { value: 'dark', label: <span className="accent-color-label"><Moon size={18} />{{ zh: '深色', en: 'Dark' }[language]}</span> },
    { value: 'light', label: <span className="accent-color-label"><Sun size={18} />{{ zh: '浅色', en: 'Light' }[language]}</span> },
    ...PALETTES.map(item => ({ value: item.id, label: <span className="accent-color-label">
      <i className="accent-color-select-swatch" style={{ background: item.swatch[1] }} aria-hidden="true" />{item[language]}
    </span> })),
  ];
  const value = palette ?? theme;
  const patch = (selected: string): Patch => selected === 'system' || selected === 'light' || selected === 'dark'
    ? { theme: selected, palette: null } : { palette: PALETTES.find(item => item.id === selected)!.id };
  const label = { zh: '外观', en: 'Appearance' }[language];
  return <div className="accent-color-select"><span>{label}</span>
    <CompactSelect className="accent-color-select-value" popupClassName="settings-typography accent-color-menu"
      ariaLabel={label} value={value} label={options.find(item => item.value === value)?.label}
      items={options.map(item => ({ value: item.value, label: <span className="accent-color-option">
        <Check className="accent-color-check" aria-hidden="true" />{item.label}</span> }))}
      onPreview={selected => onPreview?.(selected === null ? null : patch(selected))}
      onOpenChange={open => { if (!open) onPreview?.(null); }} onChange={selected => onChange(patch(selected))} />
  </div>;
}

export function AppearanceAccentControl({ language, value, onChange, onPreview }: {
  language: Language; value: AccentId | null; onChange: (value: AccentId | null) => void;
  onPreview?: (value: AccentId | null | undefined) => void;
}) {
  const [customHex, setCustomHex] = useState<string>(value?.startsWith('#') ? value : ACCENT_COLORS[0].swatch);
  const custom = value?.startsWith('#') ?? false;
  useEffect(() => { if (value?.startsWith('#')) setCustomHex(value); }, [value]);
  const options = [
    { value: '', name: { zh: '跟随配色', en: 'Follow color theme' }[language], swatch: 'var(--accent)' },
    ...ACCENT_COLORS.map(color => ({ value: color.id, name: color[language], swatch: color.swatch })),
    { value: 'custom', name: { zh: '自定义', en: 'Custom' }[language], swatch: customHex },
  ];
  const current = options.find(option => option.value === (custom ? 'custom' : value ?? '')) ?? options[0];
  const colorLabel = (option: typeof current) => <span className="accent-color-label">
    <i className="accent-color-select-swatch" style={{ background: option.swatch }} aria-hidden="true" /><span>{option.name}</span>
  </span>;
  const resolve = (selected: string) => findAccentColor(selected === 'custom' ? customHex : selected)?.id ?? null;
  const label = { zh: '强调色', en: 'Accent color' }[language];
  return <div className="accent-color-select"><span>{label}</span><div className="accent-color-controls">
    <CompactSelect className="accent-color-select-value" popupClassName="settings-typography accent-color-menu"
      label={colorLabel(current)} value={custom ? 'custom' : value ?? ''} ariaLabel={label}
      items={options.map(option => ({ value: option.value, label: <span className="accent-color-option">
        <Check className="accent-color-check" aria-hidden="true" />{colorLabel(option)}</span> }))}
      onPreview={selected => onPreview?.(selected === null ? undefined : resolve(selected))}
      onOpenChange={open => { if (!open) onPreview?.(undefined); }} onChange={selected => onChange(resolve(selected))} />
    {custom && <div className="accent-color-custom">
      <CompactSelect className="accent-color-picker-trigger" popupClassName="settings-typography accent-color-menu accent-color-picker"
        ariaLabel={{ zh: '自定义强调色', en: 'Custom accent color' }[language]}
        label={<i className="accent-color-select-swatch" style={{ background: value ?? customHex }} aria-hidden="true" />}
        items={[]} onChange={() => {}} showArrow={false} unstyledTrigger
        panelContent={<HexColorPicker color={value ?? customHex} onChange={color => onChange(color as AccentId)} />} />
      <input className="accent-color-hex-input" type="text" value={customHex} maxLength={7} spellCheck={false}
        aria-label={{ zh: 'HEX 色值', en: 'HEX color' }[language]} aria-invalid={!findAccentColor(customHex)}
        onChange={event => {
          setCustomHex(event.target.value);
          const color = findAccentColor(event.target.value);
          if (color?.id.startsWith('#')) onChange(color.id);
        }} onBlur={() => setCustomHex(value ?? ACCENT_COLORS[0].swatch)}
        onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} />
    </div>}
  </div></div>;
}

export function AppearanceBackdropControls({ language, enabled, contrast, onEnabledChange, onContrastChange }: {
  language: Language; enabled: boolean; contrast: AppearancePreferences['contrast'];
  onEnabledChange: (enabled: boolean) => void; onContrastChange: (value: AppearancePreferences['contrast']) => void;
}) {
  return <><label className="appearance-background-row"><span>{{ zh: '底图', en: 'Backdrop' }[language]}</span>
    <select className="appearance-background-select" value={enabled ? 'image' : 'solid'}
      onChange={event => onEnabledChange(event.target.value === 'image')}>
      <option value="solid">{{ zh: '纯色', en: 'Solid color' }[language]}</option>
      <option value="image">{{ zh: '背景', en: 'Image' }[language]}</option>
    </select></label>
    <BoolToggle value={contrast === 'soft'} onChange={enabled => onContrastChange(enabled ? 'soft' : 'normal')}
      label={{ zh: '低对比度', en: 'Low contrast' }[language]} />
  </>;
}

export function AppearanceBackgroundControl({ language, choice, scheme, assetRoot = HOME_BACKGROUND_ASSETS, onChange, onPreview }: {
  language: Language; choice: HomeBackgroundChoice; scheme: 'light' | 'dark'; assetRoot?: string;
  onChange: (choice: HomeBackgroundChoice) => void; onPreview?: (choice: HomeBackgroundChoice | null) => void;
}) {
  const active = resolveHomeBackground(choice, scheme);
  return <div className="site-background-control" role="group" aria-label={{ zh: '全站背景', en: 'Site background' }[language]}>
    <div className="site-background-grid">{HOME_BACKGROUNDS.map(item => <button key={item.id} type="button"
      aria-pressed={active?.id === item.id} className="site-background-option"
      onPointerEnter={event => { if (event.pointerType !== 'touch') onPreview?.(item.id); }}
      onPointerLeave={() => onPreview?.(null)} onFocus={() => onPreview?.(item.id)} onBlur={() => onPreview?.(null)}
      onClick={() => onChange(item.id)}>
      <img src={`${assetRoot}/${item.id}-thumb.webp`} alt="" width={128} height={72} />
      <span className="site-background-caption"><span>{item[language]}</span>
        <span className="site-background-check">{active?.id === item.id && <Check size={13} />}</span></span>
    </button>)}</div>
  </div>;
}

export interface AppearanceSettingsProps {
  value: AppearancePreferences;
  effectiveTheme: 'light' | 'dark';
  onChange: (patch: Patch) => void;
  onPreview?: Preview;
  backgroundAssetRoot?: string;
}

/** Controlled controls shared by the website and installed clients; hosts own persistence. */
export function AppearanceSettings({ value, effectiveTheme, onChange, onPreview, backgroundAssetRoot }: AppearanceSettingsProps) {
  const backgroundKey = effectiveTheme === 'dark' ? 'darkBackground' : 'lightBackground';
  const choice = value[backgroundKey];
  const enabled = !!resolveHomeBackground(choice, effectiveTheme);
  return <div className="appearance-settings-body">
    <div className="appearance-setting-rows">
      <AppearanceThemeControl language={value.locale} theme={value.theme} palette={value.palette} onChange={onChange} onPreview={onPreview} />
      <AppearanceAccentControl language={value.locale} value={value.accent} onChange={accent => onChange({ accent })}
        onPreview={accent => onPreview?.(accent === undefined ? null : { accent })} />
      <AppearanceBackdropControls language={value.locale} enabled={enabled} contrast={value.contrast}
        onEnabledChange={enabled => onChange({ [backgroundKey]: enabled ? readRememberedAppearanceBackground(effectiveTheme) : 'none' })}
        onContrastChange={contrast => onChange({ contrast })} />
    </div>
    {enabled && <AppearanceBackgroundControl language={value.locale} choice={choice} scheme={effectiveTheme} assetRoot={backgroundAssetRoot}
      onChange={choice => onChange({ [backgroundKey]: choice })}
      onPreview={choice => onPreview?.(choice === null ? null : { [backgroundKey]: choice })} />}
  </div>;
}
