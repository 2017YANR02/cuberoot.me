'use client';

import dynamic from 'next/dynamic';

// Lazy-load the interactive cubing.js player. TwistySection itself dynamic-imports
// `cubing/twisty` on mount; wrapping it in next/dynamic({ ssr:false }) keeps the heavy
// chunk out of the server / SSG bundle and defers it until this embed actually mounts.
const TwistySection = dynamic(() => import('../TwistySection'), { ssr: false });

// Conservative WCA-ish cube notation: layer letters R U F L D B, slice M E S,
// rotations x y z, with optional wide `w`, repeat digits, and prime `'`. Spaces separate
// tokens. Anything outside this closed set (HTML, JS, exotic moves) fails → render nothing.
// untrusted authors: never pass an unvalidated string into the player.
const ALG_RE = /^[RUFLDBMESxyzw0-9'\s]+$/;

export default function ArticleAlgEmbed({ alg, puzzle = '3x3x3' }: { alg: string; puzzle?: string }) {
  const trimmed = (alg ?? '').trim();
  if (!trimmed || !ALG_RE.test(trimmed)) return null;

  return (
    <span className="article-alg-embed">
      <TwistySection puzzle={puzzle} scramble="" alg={trimmed} />
    </span>
  );
}
