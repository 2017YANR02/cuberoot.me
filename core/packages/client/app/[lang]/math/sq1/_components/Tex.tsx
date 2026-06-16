'use client';

/**
 * KaTeX wrappers for the Square-1 God's-number page. Mirrors /math/god's Tex
 * but with `.sq1-tex` classes (styled in sq1.css). Always pass String.raw`…`
 * sources so backslashes survive.
 */
import { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

export function TeX({ src }: { src: string }) {
  const html = useMemo(
    () => katex.renderToString(src, { throwOnError: false, output: 'html', strict: 'ignore' }),
    [src],
  );
  return <span className="sq1-tex" dangerouslySetInnerHTML={{ __html: html }} />;
}

export function TeXBlock({ src }: { src: string }) {
  const html = useMemo(
    () => katex.renderToString(src, { throwOnError: false, output: 'html', strict: 'ignore', displayMode: true }),
    [src],
  );
  return <span className="sq1-tex-block" dangerouslySetInnerHTML={{ __html: html }} />;
}
