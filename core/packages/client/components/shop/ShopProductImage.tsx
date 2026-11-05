'use client';
import { useEffect, useState } from 'react';
import { Box } from '@app-foundation/icons/lucide';
import { useT } from '@/hooks/useT';
import { productImages } from '@/lib/shop';
import type { PlatformEntity } from '@/lib/platform-types';

export function ShopProductImage({ product, className = '' }: { product: PlatformEntity; className?: string }) {
  const t = useT();
  const src = productImages(product)[0];
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return <div className={`shop-product-image ${className}`}>
    {src && !failed ? <img src={src} alt={product.title} loading="lazy" onError={() => setFailed(true)} /> : <div className="shop-image-fallback"><Box size={48} strokeWidth={1} aria-hidden /><span>{t('图片待更新', 'Image coming soon')}</span></div>}
  </div>;
}
