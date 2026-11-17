'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { HOME_BACKGROUND_ASSETS, resolveHomeBackground, type HomeBackgroundChoice } from '@cuberoot/shared/appearance';
import './appearance-background.css';

/** One decorative layer; hosts provide asset origins, never executable code. */
export function AppearanceBackground({ choice, scheme, assetRoot = HOME_BACKGROUND_ASSETS, enabled = true, manageDocument = true }: {
  choice: HomeBackgroundChoice;
  scheme: 'light' | 'dark';
  assetRoot?: string;
  enabled?: boolean;
  manageDocument?: boolean;
}) {
  const scene = resolveHomeBackground(choice, scheme);
  const source = scene ? `${assetRoot.replace(/\/$/, '')}/${scene.id}.webp` : null;
  const [failedSource, setFailedSource] = useState<string | null>(null);
  useEffect(() => { setFailedSource(null); }, [choice, scheme, assetRoot]);
  const active = enabled && scene && source !== failedSource;
  const material = active ? scene.id : enabled ? 'transparent' : null;
  useEffect(() => {
    if (!manageDocument) return;
    if (material) document.body.dataset.siteScenery = material;
    else delete document.body.dataset.siteScenery;
    return () => { delete document.body.dataset.siteScenery; };
  }, [material, manageDocument]);
  if (!active || !source) return null;
  return <div className="site-scenery" aria-hidden="true"
    style={{ '--site-scene-position': scene.position } as CSSProperties}>
    <img key={source} src={source} alt="" onError={() => setFailedSource(source)} />
  </div>;
}
