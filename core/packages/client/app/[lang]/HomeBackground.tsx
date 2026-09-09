'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { Check } from 'lucide-react';
import { useHomeBackgroundChoice } from '@/hooks/useHomeBackgroundChoice';
import { HOME_BACKGROUND_ASSETS as ASSET_ROOT, HOME_BACKGROUNDS as SCENES, resolveHomeBackground, type HomeBackgroundChoice as Choice } from '@/lib/home-backgrounds';
import { useEffectiveTheme } from '@/lib/theme';
import { tr } from '@/i18n/tr';
import './home-background.css';

/** Homepage-only decoration and preference; never changes the site's appearance settings. */
export default function useHomeBackground() {
  const [choice, setChoice] = useHomeBackgroundChoice();
  const [ready, setReady] = useState(false);
  const theme = useEffectiveTheme();
  const [failedScene, setFailedScene] = useState<string | null>(null);

  useEffect(() => {
    setReady(true);
  }, []);

  const scene = resolveHomeBackground(choice, theme);
  const autoLabel = tr({ zh: '随明暗切换', en: 'Follow light / dark' });
  const noneLabel = tr({ zh: '无背景', en: 'No background' });
  const selectBackground = (value: Choice) => {
    setFailedScene(null);
    setChoice(value);
  };

  const background = ready && scene && failedScene !== scene.id ? <div
      className="home-scenery" aria-hidden="true"
      style={{ '--home-scene-position': scene.position } as CSSProperties}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- One precompressed decorative image, selected locally. */}
      <img key={scene.id} src={`${ASSET_ROOT}/${scene.id}.webp`} alt=""
        onError={() => setFailedScene(scene.id)} />
    </div> : null;
  const control = <div className="home-background-control" role="group" aria-label={tr({ zh: '主页背景', en: 'Homepage background' })}>
      <div className="appearance-sec-label">{tr({ zh: '主页背景', en: 'Homepage background' })}</div>
      <div className="home-background-modes">
        {([{ value: 'auto', label: autoLabel }, { value: 'none', label: noneLabel }] as const).map(item => (
          <button key={item.value} type="button" role="menuitemradio" aria-checked={choice === item.value}
            className="home-background-mode" onClick={() => selectBackground(item.value)}>
            <span className="home-background-check">{choice === item.value && <Check size={13} />}</span>
            {item.label}
          </button>
        ))}
      </div>
      <div className="home-background-grid">
        {SCENES.map(item => (
          <button key={item.id} type="button" role="menuitemradio" aria-checked={choice === item.id}
            className="home-background-option" onClick={() => selectBackground(item.id)}>
            {/* eslint-disable-next-line @next/next/no-img-element -- Tiny local WebP thumbnails. */}
            <img src={`${ASSET_ROOT}/${item.id}-thumb.webp`} alt="" width={128} height={72} />
            <span className="home-background-caption"><span>{tr(item)}</span>
              <span className="home-background-check">{choice === item.id && <Check size={13} />}</span>
            </span>
          </button>
        ))}
      </div>
    </div>;
  return { background, control };
}
