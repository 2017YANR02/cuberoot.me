/**
 * SettingDrawer — 右侧滑出设置面板。
 * 灵敏度 / 缩放 / 透视 / 厚度 / 镂空 / 箭头。
 * 持久化 localStorage 'stack.settings'。
 */
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { useEffect } from 'react';
import World from './cuber/world';
import './setting-drawer.css';

export interface StackSettings {
  sensitivity: number;
  scale: number;
  perspective: number;
  thickness: boolean;
  hollow: boolean;
  arrow: boolean;
}

export const DEFAULT_SETTINGS: StackSettings = {
  sensitivity: 50,
  scale: 50,
  perspective: 50,
  thickness: true,
  hollow: false,
  arrow: false,
};

const STORAGE_KEY = 'stack.settings';

export function loadSettings(): StackSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<StackSettings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: StackSettings): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // ignore
  }
}

// 把 0~100 → 实际数值。scale 50 = 1.0 (upstream 默认), 范围 0.5 ~ 1.5。
function mapSensitivity(v: number): number { return 0.1 + (v / 100) * 1.4; }   // 0.1 ~ 1.5
function mapScale(v: number): number { return 0.5 + v / 100; }                  // 0.5 ~ 1.5
function mapPerspective(v: number): number { return 2 + (v / 100) * 8; }        // 2 ~ 10

export function applySettings(world: World, s: StackSettings): void {
  world.controller.sensitivity = mapSensitivity(s.sensitivity);
  world.scale = mapScale(s.scale);
  world.perspective = mapPerspective(s.perspective);
  world.cube.arrow = s.arrow;
  for (const cubelet of world.cube.cubelets) {
    cubelet.thickness = s.thickness;
    cubelet.hollow = s.hollow;
  }
  world.dirty = true;
  world.cube.dirty = true;
  world.resize();
}

interface Props {
  open: boolean;
  onClose: () => void;
  settings: StackSettings;
  onChange: (s: StackSettings) => void;
}

export default function SettingDrawer({ open, onClose, settings, onChange }: Props) {
  const { i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const set = <K extends keyof StackSettings>(key: K, value: StackSettings[K]) => {
    onChange({ ...settings, [key]: value });
  };

  const t = (zh: string, en: string) => (isZh ? zh : en);

  return (
    <>
      <div className="stack-drawer-backdrop" onClick={onClose} />
      <aside className="stack-drawer" role="dialog" aria-label={t('设置', 'Settings')}>
        <header className="stack-drawer-head">
          <h2>{t('设置', 'Settings')}</h2>
          <button onClick={onClose} title={t('关闭', 'Close')}><X size={16} /></button>
        </header>
        <div className="stack-drawer-body">
          <Slider label={t('灵敏度', 'Sensitivity')} value={settings.sensitivity} onChange={(v) => set('sensitivity', v)} />
          <Slider label={t('缩放', 'Scale')} value={settings.scale} onChange={(v) => set('scale', v)} />
          <Slider label={t('透视', 'Perspective')} value={settings.perspective} onChange={(v) => set('perspective', v)} />
          <Toggle label={t('立体贴片', 'Sticker thickness')} value={settings.thickness} onChange={(v) => set('thickness', v)} />
          <Toggle label={t('镂空', 'Hollow')} value={settings.hollow} onChange={(v) => set('hollow', v)} />
          <Toggle label={t('显示朝向箭头', 'Orientation arrows')} value={settings.arrow} onChange={(v) => set('arrow', v)} />
          <button
            className="stack-drawer-reset"
            onClick={() => onChange(DEFAULT_SETTINGS)}
          >
            {t('恢复默认', 'Reset to defaults')}
          </button>
        </div>
      </aside>
    </>
  );
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="stack-slider">
      <div className="stack-slider-row">
        <span>{label}</span>
        <span className="stack-slider-val">{value}</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="stack-toggle">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}
