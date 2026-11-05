'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, PackageOpen, ShoppingBag, X } from '@app-foundation/icons/lucide';
import { parseAsInteger, parseAsString, parseAsStringEnum, useQueryStates } from 'nuqs';
import AppLink from '@/components/AppLink';
import { useT } from '@/hooks/useT';
import { useLang } from '@/i18n/tr';
import { useIsAdmin } from '@/lib/auth-store';
import { loadPlatformResource, localizePlatformEntity } from '@/lib/platform-gateway';
import { SHOP_CATEGORY, SHOP_ROOT, productHref, shopAmount } from '@/lib/shop';
import { SHOP_DESIGNS } from '@/lib/shop-designs';
import type { PlatformResourceResult } from '@/lib/platform-types';
import { commerceMoney } from '@/lib/platform-commerce-format';
import { ShopProductImage } from './ShopProductImage';

export function ShopCatalog() {
  const t = useT();
  const lang = useLang();
  const admin = useIsAdmin();
  const [filters, setFilters] = useQueryStates({ q: parseAsString.withDefault(''), sort: parseAsStringEnum(['updated', 'title']).withDefault('updated'), page: parseAsInteger.withDefault(1) }, { history: 'replace', scroll: false });
  const [result, setResult] = useState<PlatformResourceResult | null>(null);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const page = Math.max(1, filters.page);
  useEffect(() => {
    const controller = new AbortController();
    setResult(null); setError(false);
    void loadPlatformResource('products', { params: {}, query: filters.q, category: SHOP_CATEGORY, sort: filters.sort as 'title' | 'updated', page, pageSize: 24, signal: controller.signal })
      .then(next => { if (!controller.signal.aborted) setResult(next); })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [filters.q, filters.sort, page, revision]);
  const items = result?.items.map(item => localizePlatformEntity(item, lang)) ?? [];
  const filtered = !!filters.q;
  const designs = page === 1 ? SHOP_DESIGNS.filter(design =>
    !items.some(item => item.data?.slug === design.slug)
    && [design.title.zh, design.title.en, design.summary.zh, design.summary.en].join(' ').toLocaleLowerCase().includes(filters.q.trim().toLocaleLowerCase())
  ).toSorted((a, b) => filters.sort === 'title' ? t(a.title.zh, a.title.en).localeCompare(t(b.title.zh, b.title.en), lang) : 0) : [];
  return <>
    <section id="catalog" className="shop-catalog">
      <header className="shop-catalog-heading">
        <h1>{filtered ? t('搜索结果', 'Search results') : t('CubeRoot 周边', 'CubeRoot merch')}</h1>
        <div className="shop-catalog-tools">
          {result && <span className="shop-result-count">{(result.total ?? items.length) > 0 ? t(`${result.total ?? items.length} 件商品`, `${result.total ?? items.length} products`) : t(`${designs.length} 款待开售`, `${designs.length} upcoming designs`)}</span>}
          <label className="shop-select"><span>{t('排序', 'Sort by')}</span><select className="shop-control shop-sort-select" value={filters.sort} onChange={event => { void setFilters({ sort: event.target.value as 'title' | 'updated', page: 1 }); }}><option value="updated">{t('最近上新', 'Newest arrivals')}</option><option value="title">{t('商品名称', 'Product name')}</option></select></label>
        </div>
      </header>
      {filtered && <div className="shop-filter-summary"><span>“{filters.q}”</span><button type="button" className="shop-control shop-text-link" onClick={() => { void setFilters({ q: '', page: 1 }); }}><X size={15} aria-hidden />{t('清除搜索', 'Clear search')}</button></div>}
      {designs.length > 0 && <div className="shop-design-grid">{designs.map((design, index) => <article className="shop-design-card" key={design.slug}>
        <AppLink href={`${SHOP_ROOT}/${design.slug}`} prefetch={false} className="shop-design-art"><img src={design.image} width={2400} height={1200} alt={t(design.alt.zh, design.alt.en)} loading={index === 0 ? 'eager' : 'lazy'} fetchPriority={index === 0 ? 'high' : 'auto'} /></AppLink>
        <div className="shop-design-copy"><h2><AppLink href={`${SHOP_ROOT}/${design.slug}`} prefetch={false}>{t(design.title.zh, design.title.en)}</AppLink></h2><p>{t(design.summary.zh, design.summary.en)}</p>
          <div className="shop-design-action"><span>{t('价格待定', 'Price to be announced')}</span><AppLink href={`${SHOP_ROOT}/${design.slug}`} prefetch={false} className="shop-button">{t('查看款式', 'View design')}<ArrowRight size={17} aria-hidden /></AppLink></div>
        </div>
      </article>)}</div>}
      {error ? <div className="shop-empty" role="alert"><p>{t('商品暂时无法加载，请重试。', 'Products could not be loaded. Please try again.')}</p><button className="shop-control shop-button" onClick={() => setRevision(value => value + 1)}>{t('重新加载', 'Try again')}</button></div>
        : !result ? <div className="shop-product-grid" aria-label={t('正在加载商品', 'Loading products')} aria-busy="true">{[1, 2, 3, 4].map(id => <div className="shop-product-skeleton" key={id} />)}</div>
        : items.length ? <>
          <div className="shop-product-grid">{items.map(product => {
            const data = product.data ?? {};
            const amount = shopAmount(data.fromAmountMinor);
            return <article key={product.id} className="shop-product-card">
              <AppLink href={productHref(product)} prefetch={false} className="shop-product-card-content">
                <ShopProductImage product={product} />
                <div className="shop-product-card-copy"><h2>{product.title}</h2><p className="shop-card-price">{amount === null ? t('价格待定', 'Price to be announced') : `${commerceMoney(amount, data.currency)} ${t('起', 'and up')}`}</p></div>
              </AppLink>
              <AppLink href={productHref(product)} className="shop-card-buy" prefetch={false} aria-label={t(`查看 ${product.title} 并选择规格`, `View ${product.title} and choose a variant`)}>{amount === null ? <ArrowRight size={17} aria-hidden /> : <ShoppingBag size={17} aria-hidden />}{amount === null ? t('查看商品', 'View product') : t('选择规格', 'Choose options')}</AppLink>
            </article>;
          })}</div>
          {(result.total ?? 0) > 24 && <nav className="shop-pagination" aria-label={t('商品分页', 'Product pages')}><button className="shop-control shop-button" disabled={page <= 1} onClick={() => { void setFilters({ page: page - 1 }); }}>{t('上一页', 'Previous')}</button><span>{page} / {Math.ceil((result.total ?? 0) / 24)}</span><button className="shop-control shop-button" disabled={page * 24 >= (result.total ?? 0)} onClick={() => { void setFilters({ page: page + 1 }); }}>{t('下一页', 'Next')}</button></nav>}
        </> : designs.length ? null : <div className="shop-empty"><PackageOpen size={32} strokeWidth={1.4} aria-hidden /><h2>{filtered ? t('没有找到相关商品', 'No matching products') : t('暂无上架商品', 'No products available yet')}</h2>{filtered && <button className="shop-control shop-button" onClick={() => { void setFilters({ q: '', page: 1 }); }}>{t('查看全部周边', 'View all merch')}</button>}{!filtered && admin && <AppLink href="/platform/admin/products/new" className="shop-button" prefetch={false}>{t('添加商品', 'Add a product')}</AppLink>}</div>}
    </section>
  </>;
}
