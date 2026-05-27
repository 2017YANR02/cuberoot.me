'use client';

/**
 * /wca/globe — shell page.
 *
 * The actual MapLibre-driven globe lives in `GlobeMapClient.tsx`. We dynamic-
 * import it with `ssr: false` so the ~550KB maplibre-gl bundle (+ all of its
 * deps) only ships when the user actually navigates here, and only after
 * client mount. This page itself stays tiny.
 */
import dynamic from 'next/dynamic';
import 'maplibre-gl/dist/maplibre-gl.css';

const GlobeMapClient = dynamic(() => import('./GlobeMapClient'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#000',
        color: 'rgba(255,255,255,0.55)',
        fontSize: 13,
        letterSpacing: 0.4,
      }}
    >
      Loading globe…
    </div>
  ),
});

export default function GlobePage() {
  return <GlobeMapClient />;
}
