'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { parseAsString, useQueryState } from 'nuqs';
import { ArrowUpRight, Heart, Package, Search, ShoppingBag, UserRound } from '@app-foundation/icons/lucide';
import AppLink from '@/components/AppLink';
import HeaderToggles from '@/components/HeaderToggles';
import { useT } from '@/hooks/useT';
import { useLang } from '@/i18n/tr';
import { nextQuery, useAuthUser, useIsAdmin } from '@/lib/auth-store';
import { SHOP_ROOT } from '@/lib/shop';
import { useShopCart } from '@/lib/shop-cart';
import './shop.css';

export function ShopShell({ children }: { children: ReactNode }) {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const user = useAuthUser();
  const admin = useIsAdmin();
  const path = usePathname();
  const [query] = useQueryState('q', parseAsString.withDefault(''));
  const [search, setSearch] = useState(query);
  useEffect(() => setSearch(query), [query, path]);
  const count = useShopCart().reduce((sum, item) => sum + item.quantity, 0);
  return <div className="shop-shell">
    <a href="#shop-main" className="shop-skip">{t('跳至商品内容', 'Skip to shop content')}</a>
    <header className="shop-header">
      <AppLink href={SHOP_ROOT} className="shop-wordmark" aria-label={t('CubeRoot 商店首页', 'CubeRoot shop home')}><img src="/icons/CubeRoot-mark.svg" width={36} height={36} alt="" /><strong>CubeRoot</strong></AppLink>
      <div className="shop-search" role="search">
        <Search size={19} aria-hidden />
        <input className="shop-control shop-search-input" type="search" value={search} onChange={event => {
          const value = event.target.value;
          setSearch(value);
          router.replace(`${lang === 'zh' ? '/zh' : ''}${SHOP_ROOT}${value ? `?q=${encodeURIComponent(value)}` : ''}`, { scroll: false });
        }} placeholder={t('搜索周边商品', 'Search CubeRoot merch')} aria-label={t('搜索店铺商品', 'Search shop products')} maxLength={200} />
      </div>
      <nav className="shop-utilities" aria-label={t('购物服务', 'Shopping services')}>
        <AppLink href="/platform/orders" prefetch={false} aria-label={t('我的订单', 'My orders')}><Package size={21} aria-hidden /></AppLink>
        <AppLink href="/platform/account/wishlist" prefetch={false} aria-label={t('心愿单', 'Wishlist')}><Heart size={21} aria-hidden /></AppLink>
        <AppLink href={user ? '/account' : `/account${nextQuery(path)}`} prefetch={false} aria-label={t('我的账号', 'My account')}><UserRound size={21} aria-hidden /></AppLink>
        <AppLink href={`${SHOP_ROOT}/cart`} className="shop-bag-link" prefetch={false} aria-label={t(`购物车，${count} 件商品`, `Shopping bag, ${count} items`)}><ShoppingBag size={22} aria-hidden /><b>{count}</b></AppLink>
        <HeaderToggles />
      </nav>
    </header>
    <nav className="shop-category-nav" aria-label={t('商店导航', 'Shop navigation')}>
      <AppLink href={SHOP_ROOT} prefetch={false}>{t('全部周边', 'All merch')}</AppLink>
      <AppLink href={`${SHOP_ROOT}/help`} prefetch={false}>{t('购物帮助', 'Shopping help')}</AppLink>
      <AppLink href="/contact" prefetch={false}>{t('联系我们', 'Contact us')}</AppLink>
      <AppLink href="/" prefetch={false}>{t('CubeRoot 主页', 'CubeRoot home')}</AppLink>
      {admin && <AppLink className="shop-manage-link" href="/platform/admin/products" prefetch={false}>{t('店铺管理', 'Manage shop')}<ArrowUpRight size={14} aria-hidden /></AppLink>}
    </nav>
    <main id="shop-main" className="shop-main">{children}</main>
    <footer className="shop-footer">
      <AppLink href="/" className="shop-footer-brand" prefetch={false}>CubeRoot</AppLink>
      <nav aria-label={t('购物服务', 'Shopping support')}>
        <h2>{t('购物服务', 'Support')}</h2>
        <AppLink href={`${SHOP_ROOT}/help`} prefetch={false}>{t('购物与售后', 'Shopping & support')}</AppLink>
        <AppLink href="/contact" prefetch={false}>{t('联系我们', 'Contact us')}</AppLink>
        <AppLink href="/privacy" prefetch={false}>{t('隐私政策', 'Privacy')}</AppLink>
      </nav>
      <nav aria-label={t('我的账户', 'My account')}>
        <h2>{t('我的账户', 'My account')}</h2>
        <AppLink href="/platform/orders" prefetch={false}>{t('订单与物流', 'Orders & delivery')}</AppLink>
        <AppLink href="/platform/account/shipping" prefetch={false}>{t('收货地址', 'Shipping addresses')}</AppLink>
        <AppLink href="/platform/account/wishlist" prefetch={false}>{t('心愿单', 'Wishlist')}</AppLink>
      </nav>
    </footer>
  </div>;
}
