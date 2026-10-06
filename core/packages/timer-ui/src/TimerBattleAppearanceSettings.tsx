import { useState, useRef, useEffect } from 'react';
import { LOCAL_BATTLE_BG_MAX_BYTES, type LocalBattlePreferences } from '@cuberoot/shared/timer';
const COPY = {
  en: { background: 'Background', color: 'Background color', image: 'Image', set: 'Set', reset: 'Reset', opacity: 'Opacity', scale: 'Scramble size', failed: 'Unable to read image', large: 'Image too large, ≤4MB' },
  zh: { background: '背景', color: '背景色', image: '图片', set: '已上传', reset: '重置', opacity: '不透明度', scale: '打乱大小', failed: '无法读取图片', large: '图片太大，≤4MB' },
};
export function TimerBattleAppearanceSettings({ language, playerCount, value, onChange }: {
  language: 'en' | 'zh'; playerCount: number;
  value: Pick<LocalBattlePreferences, 'bgColors' | 'bgImages' | 'bgOpacity' | 'scrambleScale'>;
  onChange(patch: Partial<LocalBattlePreferences>): void;
}) {
  const copy = COPY[language], [error, setError] = useState('');
  const current = useRef(value); current.current = value;
  const versions = useRef([0, 0, 0, 0]);
  useEffect(() => () => { versions.current = versions.current.map(n => n + 1); }, []);
  return <fieldset className="timer-battle-appearance"><legend>{copy.background}</legend>
    <label>{copy.scale}<input type="range" min={.5} max={2} step={.1} value={value.scrambleScale} onChange={e => onChange({ scrambleScale: Number(e.target.value) })} /></label>
    {Array.from({ length: playerCount }, (_, id) => <div key={id} className="timer-battle-background-row">
      <span>P{id + 1}</span>
      {/* Native color input requires a literal initial user-selected color. */}
      <input type="color" aria-label={`P${id + 1} ${copy.color}`} value={value.bgColors[id] || '#000000'} onChange={e => { versions.current[id]++; onChange({
        bgColors: value.bgColors.map((color, i) => i === id ? e.target.value : color), bgImages: value.bgImages.map((image, i) => i === id ? null : image),
      }); }} />
      <label>{value.bgImages[id] ? copy.set : copy.image}<input type="file" accept="image/*" aria-label={`P${id + 1} ${copy.image}`} onChange={e => {
        const file = e.target.files?.[0]; e.target.value = ''; if (!file) return;
        const version = ++versions.current[id];
        if (file.size > LOCAL_BATTLE_BG_MAX_BYTES) { setError(copy.large); return; }
        const reader = new FileReader();
        reader.onerror = () => { if (versions.current[id] === version) setError(copy.failed); };
        reader.onload = () => { if (versions.current[id] !== version) return; if (typeof reader.result !== 'string' || !reader.result.startsWith('data:image/')) { setError(copy.failed); return; }
          setError(''); onChange({ bgImages: current.current.bgImages.map((image, i) => i === id ? reader.result as string : image), bgColors: current.current.bgColors.map((color, i) => i === id ? '' : color) }); };
        reader.readAsDataURL(file);
      }} /></label>
      <button type="button" onClick={() => { versions.current[id]++; onChange({ bgColors: value.bgColors.map((color, i) => i === id ? '' : color), bgImages: value.bgImages.map((image, i) => i === id ? null : image) }); }}>{copy.reset}</button>
    </div>)}
    <label>{copy.opacity}<span>{value.bgOpacity.toFixed(2)}</span><input type="range" min={.1} max={1} step={.05} value={value.bgOpacity} onChange={e => onChange({ bgOpacity: Number(e.target.value) })} /></label>
    {error && <p role="alert">{error}</p>}
  </fieldset>;
}
