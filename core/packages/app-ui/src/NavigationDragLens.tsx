import { useId, useLayoutEffect, useRef } from 'react';

// Kyant0/AndroidLiquidGlass, RoundedRectRefraction: invert the capsule normal
// to sample inward. RG encode horizontal/vertical offsets; 128 is neutral.
function capsuleMap(width: number, height: number, band: number) {
  const canvas = document.createElement('canvas');
  // Keep the thin rim smooth at the emulator/device pixel density.
  const resolution = Math.min(window.devicePixelRatio || 1, 3);
  width = Math.round(width * resolution);
  height = Math.round(height * resolution);
  band *= resolution;
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return '';
  const pixels = context.createImageData(width, height);
  const radius = Math.min(width, height) / 2;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x + 0.5 - Math.max(radius, Math.min(width - radius, x + 0.5));
      const dy = y + 0.5 - height / 2;
      const distance = Math.hypot(dx, dy);
      const edge = Math.max(0, Math.min(1, 1 - (radius - distance) / band));
      const bend = (1 - Math.sqrt(1 - edge * edge)) / (distance || 1);
      const i = 4 * (y * width + x);
      pixels.data[i] = 128 - 127 * dx * bend;
      pixels.data[i + 1] = 128 - 127 * dy * bend;
      pixels.data[i + 3] = 255;
    }
  }
  context.putImageData(pixels, 0, 0);
  return canvas.toDataURL();
}

const channels = [
  { name: 'red', factor: 1.01, matrix: '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0' },
  { name: 'green', factor: 1, matrix: '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0' },
  { name: 'blue', factor: 0.99, matrix: '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0' },
];

export function NavigationDragLens() {
  const id = 'nav-refraction-' + useId().replace(/[^\w-]/g, '');
  const ref = useRef<HTMLSpanElement>(null);
  const filterRef = useRef<SVGFilterElement>(null);
  useLayoutEffect(() => {
    const lens = ref.current;
    const filter = filterRef.current;
    if (!lens || !filter) return;
    const image = filter.querySelector('feImage')!;
    const samples = filter.querySelectorAll('feDisplacementMap');
    const maps = new Map<number, string>();
    let frame = 0;
    let previousBand = 0;

    function paint() {
      frame = 0;
      if (!lens) return;
      // CSS animates this opacity in both directions, including interrupted
      // releases. Use that same progress for rim width and sampling distance.
      const progress = Number(getComputedStyle(lens).opacity);
      const band = Math.max(1, Math.round(10 * progress));
      if (progress && band !== previousBand && lens.offsetWidth && lens.offsetHeight) {
        const href = maps.get(band) ?? capsuleMap(lens.offsetWidth, lens.offsetHeight, band);
        maps.set(band, href);
        // In a zero-size SVG definition, WebView resolves feImage percentages
        // against the SVG viewport. Give it the actual backdrop extent.
        image.setAttribute('width', String(lens.offsetWidth));
        image.setAttribute('height', String(lens.offsetHeight));
        image.setAttribute('href', href);
        previousBand = band;
      }
      samples.forEach((sample, i) => sample.setAttribute('scale', String(28 * progress * channels[i].factor)));
      if (lens.getAnimations().some(animation => animation.playState === 'running')) schedule();
    }
    function schedule() {
      if (!frame) frame = requestAnimationFrame(paint);
    }
    const resize = new ResizeObserver(() => {
      maps.clear();
      previousBand = 0;
      schedule();
    });
    resize.observe(lens);
    const changes = new MutationObserver(schedule);
    changes.observe(lens.parentElement!, { attributes: true, attributeFilter: ['data-lens-pressed'] });
    lens.addEventListener('transitionrun', schedule);
    lens.addEventListener('transitionend', schedule);
    return () => {
      cancelAnimationFrame(frame);
      changes.disconnect();
      resize.disconnect();
      lens.removeEventListener('transitionrun', schedule);
      lens.removeEventListener('transitionend', schedule);
    };
  }, []);

  return <>
    <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: 'absolute', pointerEvents: 'none' }}>
      <defs>
        <filter ref={filterRef} id={id} x="0%" y="0%" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feImage x="0" y="0" preserveAspectRatio="none" result="rim" />
          {channels.flatMap(channel => [
            <feDisplacementMap key={channel.name + '-sample'} in="SourceGraphic" in2="rim" scale="0"
              xChannelSelector="R" yChannelSelector="G" result={channel.name + '-sample'} />,
            <feColorMatrix key={channel.name} in={channel.name + '-sample'} type="matrix" values={channel.matrix} result={channel.name} />,
          ])}
          <feBlend in="red" in2="green" mode="screen" result="redGreen" />
          <feBlend in="redGreen" in2="blue" mode="screen" result="dispersed" />
          {/* Keep high-contrast strokes mostly neutral even when channel sampling rounds to different pixels. */}
          <feComposite in="green-sample" in2="dispersed" operator="arithmetic" k2="0.85" k3="0.15" />
        </filter>
      </defs>
    </svg>
    <span ref={ref} className="navigation-drag-lens" aria-hidden="true" style={{ backdropFilter: 'url(#' + id + ')' }} />
  </>;
}
