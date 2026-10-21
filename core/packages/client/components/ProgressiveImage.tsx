'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import './progressive-image.css';

interface ProgressiveImageProps {
  src: string;
  previewSrc?: string | null;
  alt: string;
  className?: string;
  loading?: 'lazy' | 'eager';
  referrerPolicy?: React.HTMLAttributeReferrerPolicy;
  fallback?: ReactNode;
  onError?: () => void;
}

/** The caller reserves dimensions; a small preview and the decoded image share that box. */
export function ProgressiveImage(props: ProgressiveImageProps) {
  return <ProgressiveImageSource key={`${props.src}\n${props.previewSrc ?? ''}`} {...props} />;
}

function ProgressiveImageSource({
  src, previewSrc, alt, className, loading = 'lazy', referrerPolicy, fallback, onError,
}: ProgressiveImageProps) {
  const fullRef = useRef<HTMLImageElement>(null);
  const previewRef = useRef<HTMLImageElement>(null);
  const [ready, setReady] = useState(false);
  const [previewReady, setPreviewReady] = useState(false);
  const [failed, setFailed] = useState(false);

  const reveal = async (img: HTMLImageElement, preview: boolean) => {
    // onLoad alone can precede decoding. Never paint a partially received image.
    try { await img.decode(); } catch { /* Some formats cannot explicitly decode. */ }
    if ((preview ? previewRef.current : fullRef.current) !== img || !img.naturalWidth) return;
    if (preview) setPreviewReady(true);
    else setReady(true);
  };

  useEffect(() => {
    // Cached images may finish before hydration attaches onLoad.
    for (const [img, preview] of [[fullRef.current, false], [previewRef.current, true]] as const) {
      if (img?.complete && img.naturalWidth) void reveal(img, preview);
    }
  }, []);

  return (
    <span className={`progressive-image${className ? ` ${className}` : ''}`}
      data-state={ready ? 'ready' : failed ? 'error' : 'loading'} data-preview-ready={previewReady}>
      <span className="progressive-image-frame">
        <span className="progressive-image-fallback" aria-hidden="true">{fallback}</span>
        {previewSrc && previewSrc !== src && (
          <img ref={previewRef} className="progressive-image-preview" src={previewSrc} alt="" aria-hidden="true"
            loading={loading} decoding="async" referrerPolicy={referrerPolicy}
            onLoad={event => { void reveal(event.currentTarget, true); }} />
        )}
        <img ref={fullRef} className="progressive-image-full" src={src} alt={alt}
          loading={loading} decoding="async" referrerPolicy={referrerPolicy}
          onLoad={event => { void reveal(event.currentTarget, false); }}
          onError={() => { setFailed(true); onError?.(); }} />
      </span>
    </span>
  );
}
