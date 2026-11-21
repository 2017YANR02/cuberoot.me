import { useEffect, useLayoutEffect, useState, type RefObject } from 'react';

const filterId = 'cuberoot-primary-nav-refraction';
// Frost before displacement so the lens does not magnify sharp text.
const backdrop = `blur(4px) url("#${filterId}") blur(1.5px) saturate(1.55)`;

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

export function PrimaryNavigationOptics({ navigation }: { navigation: RefObject<HTMLElement | null> }) {
  const [map, setMap] = useState<string>();
  useEffect(() => {
    if (CSS.supports('backdrop-filter', backdrop) && CSS.supports('color', 'color-mix(in srgb, black, white)')) {
      setMap(createLensMap());
    }
  }, []);

  useLayoutEffect(() => {
    const nav = navigation.current;
    if (!nav || !map) return;
    nav.style.setProperty('--app-nav-lens-optics', backdrop);
    return () => { nav.style.removeProperty('--app-nav-lens-optics'); };
  }, [map, navigation]);

  if (!map) return null;
  return (
    <svg className="primary-nav-optics" width="0" height="0" aria-hidden="true">
      <filter id={filterId} x="0%" y="0%" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feImage href={map} x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="lensMap" />
        <feDisplacementMap in="SourceGraphic" in2="lensMap" scale="42" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  );
}
