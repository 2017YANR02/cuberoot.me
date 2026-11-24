'use client';

import { useEffect, useId, useRef, type RefObject } from 'react';

function createLensMap(): string | undefined {
  const size = 48;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) return;

  const map = context.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const index = (y * size + x) * 4;
      // Linear inward sampling keeps both axes monotonic across the lens.
      map.data[index] = 255 * (0.5 - ((x + 0.5) / size - 0.5) * 0.26);
      map.data[index + 1] = 255 * (0.5 - ((y + 0.5) / size - 0.5) * 0.22);
      map.data[index + 3] = 255;
    }
  }
  context.putImageData(map, 0, 0);
  return canvas.toDataURL();
}

type OpticsTarget =
  | { navigation: RefObject<HTMLElement | null>; siteWide?: never }
  | { siteWide: true; navigation?: never };

export function PrimaryNavigationOptics({ navigation, displacementScale = 42 }: OpticsTarget & { displacementScale?: number }) {
  const filterId = `cuberoot-nav-refraction-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const texture = useRef<SVGFEImageElement>(null);

  useEffect(() => {
    const target = navigation ? navigation.current : document.body;
    const property = navigation ? '--app-nav-lens-optics' : '--site-glass-refraction';
    const image = texture.current;
    if (!target || !image || !/Chrome|Chromium|Edg/.test(navigator.userAgent) ||
      /iPhone|iPad|iPod/.test(navigator.userAgent)) return;

    // Frost before displacement so the lens does not magnify sharp text.
    const backdrop = `blur(4px) url("#${filterId}") blur(1.5px) saturate(1.55)`;
    if (!CSS.supports('backdrop-filter', backdrop)) return;
    const map = createLensMap();
    if (!map) return;

    image.setAttribute('href', map);
    target.style.setProperty(property, backdrop);
    if (!navigation) target.dataset.siteGlass = 'liquid';
    return () => {
      target.style.removeProperty(property);
      if (!navigation) target.dataset.siteGlass = 'solid';
      image.removeAttribute('href');
    };
  }, [filterId, navigation]);

  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: 'absolute', pointerEvents: 'none' }}>
      <filter id={filterId} x="0%" y="0%" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feImage ref={texture} x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="lensMap" />
        <feDisplacementMap in="SourceGraphic" in2="lensMap" scale={displacementScale} xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  );
}
