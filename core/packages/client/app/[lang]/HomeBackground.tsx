'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { ImageIcon } from 'lucide-react';
import { CompactSelect } from '@/components/CompactSelect';
import { persistItem } from '@/lib/safe-storage';
import { useEffectiveTheme } from '@/lib/theme';
import { tr } from '@/i18n/tr';
import './home-background.css';

const STORAGE_KEY = 'home-background.v1';
const ASSET_ROOT = '/assets/home-backgrounds/v1';
const SCENES = [
  { id: '01', zh: '雪山初晴', en: 'Snowy Dawn', position: '50%' },
  { id: '02', zh: '暮色松岭', en: 'Sunset Pines', position: '50%' },
  { id: '03', zh: '蓝夜远山', en: 'Moonlit Peaks', position: '50%' },
  { id: '04', zh: '沙海日落', en: 'Desert Sunset', position: '50%' },
  { id: '05', zh: '紫夜沙丘', en: 'Violet Dunes', position: '50%' },
  { id: '06', zh: '青绿峡谷', en: 'Jade Canyon', position: '65%' },
  { id: '07', zh: '粉彩阶庭', en: 'Pastel Courtyard', position: '75%' },
  { id: '08', zh: '月下迷宫', en: 'Moonlit Labyrinth', position: '30%' },
  { id: '09', zh: '浮岛花园', en: 'Floating Gardens', position: '65%' },
  { id: '10', zh: '沙丘之门', en: 'Dune Gateway', position: '70%' },
] as const;
type Choice = 'auto' | 'none' | typeof SCENES[number]['id'];

function readChoice(): Choice {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'auto' || saved === 'none' || SCENES.some(scene => scene.id === saved)) {
      return saved as Choice;
    }
  } catch { /* Storage may be unavailable; the picker still works for this visit. */ }
  return 'auto';
}

/** Homepage-only decoration and preference; never changes the site's appearance settings. */
export default function useHomeBackground() {
  const [choice, setChoice] = useState<Choice>('auto');
  const [ready, setReady] = useState(false);
  const theme = useEffectiveTheme();
  const [failedScene, setFailedScene] = useState<string | null>(null);

  useEffect(() => {
    setChoice(readChoice());
    setReady(true);
    const sync = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) setChoice(readChoice());
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  const sceneId = choice === 'auto' ? (theme === 'dark' ? '03' : '01') : choice;
  const scene = SCENES.find(item => item.id === sceneId);
  const autoLabel = tr({ zh: '随明暗切换', en: 'Follow light / dark' });
  const noneLabel = tr({ zh: '无背景', en: 'No background' });
  const selectedLabel = choice === 'auto' ? autoLabel : scene ? tr(scene) : noneLabel;
  const items = [
    { value: 'auto' as Choice, label: autoLabel },
    { value: 'none' as Choice, label: noneLabel },
    ...SCENES.map(item => ({
      value: item.id as Choice,
      label: <span className="home-background-option">
        {/* eslint-disable-next-line @next/next/no-img-element -- Tiny local WebP thumbnails. */}
        <img src={`${ASSET_ROOT}/${item.id}-thumb.webp`} alt="" width={64} height={36} loading="lazy" />
        <span>{tr(item)}</span>
      </span>,
    })),
  ];

  const background = ready && scene && failedScene !== scene.id ? <div
      className="home-scenery" aria-hidden="true"
      style={{ '--home-scene-position': scene.position } as CSSProperties}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- One precompressed decorative image, selected locally. */}
      <img key={scene.id} src={`${ASSET_ROOT}/${scene.id}.webp`} alt=""
        onError={() => setFailedScene(scene.id)} />
    </div> : null;
  const control = <div className="home-background-control">
      <div className="appearance-sec-label appearance-sec-div">{tr({ zh: '主页背景', en: 'Homepage background' })}</div>
      <CompactSelect<Choice>
        label={<span className="home-background-label"><ImageIcon size={15} />{selectedLabel}</span>}
        valueText={selectedLabel} ariaLabel={tr({ zh: '选择主页背景', en: 'Choose homepage background' })}
        value={choice} items={items} popupClassName="home-background-menu"
        onChange={value => { setFailedScene(null); setChoice(value); persistItem(STORAGE_KEY, value); }}
      />
    </div>;
  return { background, control };
}
