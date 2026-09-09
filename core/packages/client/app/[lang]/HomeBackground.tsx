'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { ImageIcon } from 'lucide-react';
import { CompactSelect } from '@/components/CompactSelect';
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
        onChange={value => { setFailedScene(null); setChoice(value); }}
      />
    </div>;
  return { background, control };
}
