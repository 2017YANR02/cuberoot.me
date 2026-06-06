'use client';

import { VisualCube } from '../VisualCube';

// Allowed visualcube view modes (article author contract). Anything else → fallback 'iso'.
const VIEW_ENUM = ['iso', 'plan', 'f2l', 'oll', 'pll', 'pll-iso', 'trans', 'top', 'net', 'wca'] as const;
type View = (typeof VIEW_ENUM)[number];

// Same conservative notation gate as ArticleAlgEmbed — alg/setup feed the cube state URL,
// so reject anything outside the closed cube-notation set (untrusted authors).
const ALG_RE = /^[RUFLDBMESxyzw0-9'\s]*$/;

const MIN_SIZE = 32;
const MAX_SIZE = 512;
const DEFAULT_SIZE = 120;

function clampSize(raw: string | number | undefined): number {
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_SIZE;
  return Math.max(MIN_SIZE, Math.min(MAX_SIZE, Math.round(n)));
}

export default function ArticleCubeEmbed({
  alg,
  setup,
  view,
  mask,
  size,
}: {
  alg?: string;
  setup?: string;
  view?: string;
  mask?: string;
  size?: string | number;
}) {
  const safeView: View = (VIEW_ENUM as readonly string[]).includes(view ?? '')
    ? (view as View)
    : 'iso';

  const algStr = (alg ?? '').trim();
  const setupStr = (setup ?? '').trim();
  // Bad notation degrades to the solved cube rather than passing junk to the endpoint.
  const safeAlg = ALG_RE.test(algStr) ? algStr : '';
  const safeSetup = setupStr && ALG_RE.test(setupStr) ? setupStr : undefined;
  // mask is a short masking-enum token (e.g. vh / els / oll) — letters/digits/hyphen only.
  const safeMask = mask && /^[a-z0-9-]+$/i.test(mask) ? mask : undefined;

  return (
    <span className="article-cube-embed">
      <VisualCube
        algorithm={safeAlg}
        setup={safeSetup}
        // VisualCube's prop type is a narrower union; the visualcube.svg endpoint accepts
        // the full enum above, and we already validated against the closed list.
        view={safeView as 'iso' | 'f2l' | 'oll' | 'pll' | 'pll-iso' | 'trans'}
        mask={safeMask}
        size={clampSize(size)}
      />
    </span>
  );
}
