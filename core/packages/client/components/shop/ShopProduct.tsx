'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, ChevronDown, ShoppingBag } from '@app-foundation/icons/lucide';
import AppLink from '@/components/AppLink';
import { useT } from '@/hooks/useT';
import { useLang } from '@/i18n/tr';
import { loadPlatformResource, localizePlatformEntity } from '@/lib/platform-gateway';
import { addToShopCart } from '@/lib/shop-cart';
import { SHOP_ROOT, productHref, productImages, productVariants, shopRecord } from '@/lib/shop';
import type { PlatformEntity, PlatformRouteDefinition } from '@/lib/platform-types';
import { commerceMoney, commerceText } from '@/lib/platform-commerce-format';
import { PlatformFavoriteButton } from '@/components/platform/PlatformFavoriteButton';
import { renderArticleMarkdown } from '@/lib/article-markdown';
import { ShopProductImage } from './ShopProductImage';
import { findShopDesign, shopDesignPreview } from '@/lib/shop-designs';

export function ShopProduct({ id, definition }: { id: string; definition: PlatformRouteDefinition }) {
  const t = useT();
  const lang = useLang();
  const [product, setProduct] = useState<PlatformEntity | null>(null);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const design = findShopDesign(id);
    const preview = design ? shopDesignPreview(design) : null;
    setProduct(preview); setError(false);
    void loadPlatformResource('products', { params: { id }, signal: controller.signal }).then(result => {
      if (!controller.signal.aborted) { setProduct(result.items[0] ?? preview); setError(!result.items.length && !preview); }
    }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [id, revision]);
  return <section className="shop-product-page"><AppLink className="shop-back" href={SHOP_ROOT} prefetch={false} aria-label={t('返回全部商品', 'Back to all products')}><ArrowLeft size={20} aria-hidden /></AppLink>
    {error && <div className="shop-empty" role="alert"><p>{t('商品购买信息暂时无法加载，请重试。', 'Purchase information could not be loaded. Please try again.')}</p><button className="shop-control shop-button" onClick={() => setRevision(value => value + 1)}>{t('重试', 'Retry')}</button></div>}
    {product ? <ProductDetails key={product.id} product={localizePlatformEntity(product, lang)} definition={definition} /> : !error && <div className="shop-empty" role="status">{t('正在加载商品…', 'Loading product…')}</div>}
  </section>;
}

function ProductDetails({ product, definition }: { product: PlatformEntity; definition: PlatformRouteDefinition }) {
  const t = useT();
  const data = product.data ?? {};
  const preview = data.designPreview === true;
  const presentation = shopRecord(data.presentation);
  const images = productImages(product);
  const variants = productVariants(product);
  const [selected, setSelected] = useState(() => variants.find(item => item.purchasable)?.id ?? variants[0]?.id ?? '');
  const variant = variants.find(item => item.id === selected);
  const [image, setImage] = useState(images[0] ?? '');
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState('');
  const [added, setAdded] = useState(false);
  const features = t('zh', 'en') === 'zh' ? presentation.featuresZh ?? presentation.featuresEn : presentation.featuresEn ?? presentation.featuresZh;
  function add() {
    if (!variant?.purchasable) return;
    const ok = addToShopCart({ productId: product.id, variantId: variant.id, quantity }, variant.available);
    setAdded(ok);
    setMessage(ok ? t('已加入购物车', 'Added to your bag') : t('购物车中的数量已达到库存或购买上限。', 'Your bag has reached the stock or quantity limit.'));
  }
  return <>
    <div className="shop-product-layout" data-mat={presentation.imageAspectRatio === '2:1' || !!findShopDesign(String(data.slug))}><div className="shop-gallery">
      {image ? <div className="shop-gallery-main"><img src={image} alt={product.title} onError={() => setImage('')} /></div> : <ShopProductImage product={product} />}
      {images.length > 1 && <div className="shop-gallery-thumbs">{images.map((src, index) => <button className="shop-control shop-gallery-thumb" key={src} type="button" aria-label={t(`查看图片 ${index + 1}`, `View image ${index + 1}`)} aria-pressed={image === src} onClick={() => setImage(src)}><img src={src} alt="" /></button>)}</div>}
    </div><div className="shop-product-info"><h1>{product.title}</h1><p className="shop-detail-price">{variant?.amountMinor != null ? commerceMoney(variant.amountMinor, variant.currency) : t('价格待定', 'Price to be announced')}</p>
      {commerceText(presentation, 'subtitle', t) && <p className="shop-product-summary">{commerceText(presentation, 'subtitle', t)}</p>}
      {variants.length > 0 && <fieldset className="shop-variants"><legend>{t('选择规格', 'Choose a variant')}</legend>{variants.map(item => <button className="shop-control shop-variant" key={item.id} type="button" aria-pressed={selected === item.id} onClick={() => { setSelected(item.id); setQuantity(1); setAdded(false); setMessage(''); }}>{t(item.titleZh, item.titleEn)}{!item.purchasable && <span>{item.amountMinor === null ? t('待定', 'Pending') : t('缺货', 'Sold out')}</span>}</button>)}</fieldset>}
      {variant?.purchasable ? <p className="shop-stock">{t('有货', 'In stock')}</p> : <p className="shop-muted">{variants.length ? t('此规格暂不可购买', 'This variant is currently unavailable') : t('商品价格与规格公布后开放购买。', 'Purchasing opens when pricing and variants are announced.')}</p>}
      {data.memberOnly === true && <p>{t('此商品仅限课程会员购买。', 'This product requires a course membership.')} <AppLink href="/platform/membership" prefetch={false}>{t('查看权益', 'View membership')}</AppLink></p>}
      {preview ? <div className="shop-add-row"><button className="shop-control shop-button shop-button-primary" type="button" disabled>{t('待开售', 'Coming soon')}</button></div> : <div className="shop-add-row"><label className="shop-quantity"><span>{t('数量', 'Quantity')}</span><input className="shop-control shop-quantity-input" type="number" min={1} max={variant?.available || 1} step={1} value={quantity} onChange={event => { setQuantity(Number(event.target.value)); setAdded(false); }} /></label><button className="shop-control shop-button shop-button-primary" type="button" disabled={!variant?.purchasable || !Number.isInteger(quantity) || quantity < 1 || quantity > variant.available} onClick={add}><ShoppingBag size={18} aria-hidden />{t('加入购物车', 'Add to bag')}</button></div>}
      {message && <div className="shop-add-feedback" role="status"><span>{message}</span>{added && <AppLink href={`${SHOP_ROOT}/cart`} prefetch={false}>{t('查看购物车', 'View bag')}<ArrowRight size={16} aria-hidden /></AppLink>}</div>}
      {!preview && <PlatformFavoriteButton definition={definition} targetType="product" entityId={product.id} />}
      {Array.isArray(features) && features.length > 0 && <ul className="shop-features">{features.map((item, index) => <li key={index}>{String(item)}</li>)}</ul>}
      <details className="shop-disclosure" open><summary>{t('商品详情', 'Product details')}<ChevronDown size={17} aria-hidden /></summary><div className="shop-description">{renderArticleMarkdown(commerceText(data as Record<string, unknown>, 'description', t))}{variant?.sku && <p className="shop-muted">SKU: {variant.sku}</p>}</div></details>
      <details className="shop-disclosure"><summary>{t('配送与售后', 'Delivery & support')}<ChevronDown size={17} aria-hidden /></summary><p>{commerceText(presentation, 'shipping', t) || t('具体配送范围与时效请在购买前联系客服确认。发货进度可在订单详情查看。', 'Contact us to confirm delivery coverage and timing before purchase. Dispatch updates appear in your order details.')}</p><AppLink href={`${SHOP_ROOT}/help`} prefetch={false}>{t('查看购物帮助', 'View shopping help')}</AppLink></details>
    </div></div>
    {Array.isArray(data.related) && data.related.length > 0 && <section className="shop-related"><h2>{t('继续发现', 'Keep exploring')}</h2>{data.related.map(raw => { const item = shopRecord(raw); return <AppLink key={String(item.id)} href={productHref({ id: String(item.id), title: '', data: item })} prefetch={false}>{commerceText(item, 'title', t)}<ArrowRight size={16} aria-hidden /></AppLink>; })}</section>}
  </>;
}
