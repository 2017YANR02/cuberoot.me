'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useEntryRouter as useRouter } from '@/hooks/useEntryRouter';
import { parseAsString, useQueryState } from 'nuqs';
import { ArrowUpRight, Heart, MapPin, Package, Search, ShoppingBag, UserRound } from '@app-foundation/icons/lucide';
import AppLink from '@/components/AppLink';
import { CompactSelect } from '@/components/CompactSelect';
import { usePopoverDismiss } from '@/hooks/usePopoverDismiss';
import SearchInput from '@/components/SearchInput';
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
  const [searchOpen, setSearchOpen] = useState(false);
  const searchTrigger = useRef<HTMLButtonElement>(null);
  const searchPanel = useRef<HTMLDivElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restoreSearchFocus = useRef(false);
  const searchVisible = searchOpen;
  function cancelPendingSearch() {
    if (searchTimer.current !== null) clearTimeout(searchTimer.current);
    searchTimer.current = null;
  }
  function search(value: string) {
    cancelPendingSearch();
    const catalog = `${lang === 'zh' ? '/zh' : ''}${SHOP_ROOT}`;
    if (value !== query || path !== catalog) {
      router.replace(`${catalog}${value ? `?q=${encodeURIComponent(value)}` : ''}`, { scroll: false });
    }
  }
  function closeSearch(reason: 'escape' | 'outside') {
    // Flush the visible text before closing so a pending debounce or IME commit is not lost.
    const value = searchPanel.current?.querySelector('input')?.value ?? query;
    search(value);
    restoreSearchFocus.current = reason === 'escape';
    setSearchOpen(false);
  }
  usePopoverDismiss(searchVisible, closeSearch, searchPanel, searchTrigger);
  useEffect(() => cancelPendingSearch, [path]);
  useEffect(() => {
    if (searchVisible) searchPanel.current?.querySelector('input')?.focus();
    if (!searchVisible && restoreSearchFocus.current) {
      restoreSearchFocus.current = false;
      searchTrigger.current?.focus();
    }
  }, [searchVisible]);
  const [accountOpen, setAccountOpen] = useState(false);
  useEffect(() => { setAccountOpen(false); setSearchOpen(false); }, [path]);
  const count = useShopCart().reduce((sum, item) => sum + item.quantity, 0);
  // The server gate verifies access; this also hides an already-open shop on logout/role preview.
  if (!admin) return null;
  return <div className="shop-shell">
    <a href="#shop-main" className="shop-skip">{t('跳至商品内容', 'Skip to shop content')}</a>
    <header className="shop-header" data-search-open={searchVisible}>
      <AppLink href={SHOP_ROOT} className="shop-wordmark" aria-label={t('CubeRoot 商店首页', 'CubeRoot shop home')}><img src="/icons/CubeRoot-mark.svg" width={36} height={36} alt="" /><strong>CubeRoot</strong></AppLink>
    <nav className="shop-category-nav" aria-label={t('商店导航', 'Shop navigation')}>
      <AppLink href={SHOP_ROOT} prefetch={false} aria-current={path.replace(/^\/zh/, '') === SHOP_ROOT ? 'page' : undefined}>{t('全部周边', 'All merch')}</AppLink>
      <AppLink href={`${SHOP_ROOT}/help`} prefetch={false}>{t('购物帮助', 'Shopping help')}</AppLink>
      <AppLink href="/contact" prefetch={false}>{t('联系我们', 'Contact us')}</AppLink>
      <AppLink href="/" prefetch={false}>{t('主页', 'Home')}</AppLink>
    </nav>
      <nav className="shop-utilities" aria-label={t('购物服务', 'Shopping services')}>
        <div className="shop-search-slot" data-open={searchVisible}>
          {/* allow-manual-search: Opens the live search field; query updates while typing. */}
          <button ref={searchTrigger} type="button" className="shop-control shop-icon-button shop-search-trigger" tabIndex={searchVisible ? -1 : 0} aria-label={t('搜索商品', 'Search products')} aria-expanded={searchVisible} aria-controls="shop-search" onClick={() => setSearchOpen(true)}><Search size={21} aria-hidden /></button>
          <div ref={searchPanel} id="shop-search" className="shop-search" role="search" inert={!searchVisible} aria-hidden={!searchVisible}>
            <SearchInput className="shop-search-field" inputClassName="shop-control shop-search-input" value={query} onChange={value => {
              cancelPendingSearch();
              if (!value) search('');
              else searchTimer.current = setTimeout(() => search(value), 300);
            }} placeholder={t('搜索周边商品', 'Search CubeRoot merch')} ariaLabel={t('搜索店铺商品', 'Search shop products')} maxLength={200} />
          </div>
        </div>
        <CompactSelect open={accountOpen} onOpenChange={setAccountOpen} unstyledTrigger triggerClassName="shop-control shop-icon-button" popupClassName="shop-account-menu" ariaLabel={t('我的账户', 'My account')} label={<UserRound size={21} aria-hidden />} items={[]} onChange={() => {}} panelContent={<nav aria-label={t('我的账户', 'My account')}>
          <AppLink href={user ? '/account' : `/account${nextQuery(path)}`} prefetch={false} onClick={() => setAccountOpen(false)}><UserRound size={18} aria-hidden />{t('我的账号', 'My account')}</AppLink>
          <AppLink href="/platform/orders" prefetch={false} onClick={() => setAccountOpen(false)}><Package size={18} aria-hidden />{t('订单与物流', 'Orders & delivery')}</AppLink>
          <AppLink href="/platform/account/shipping" prefetch={false} onClick={() => setAccountOpen(false)}><MapPin size={18} aria-hidden />{t('收货地址', 'Shipping addresses')}</AppLink>
          <AppLink href="/platform/account/wishlist" prefetch={false} onClick={() => setAccountOpen(false)}><Heart size={18} aria-hidden />{t('心愿单', 'Wishlist')}</AppLink>
          {admin && <AppLink href="/platform/admin/products" prefetch={false} onClick={() => setAccountOpen(false)}><ArrowUpRight size={18} aria-hidden />{t('店铺管理', 'Manage shop')}</AppLink>}
        </nav>} />
        <AppLink href={`${SHOP_ROOT}/cart`} className="shop-bag-link" prefetch={false} aria-label={t(`购物车，${count} 件商品`, `Shopping bag, ${count} items`)}><ShoppingBag size={22} aria-hidden /><b>{count}</b></AppLink>
        <HeaderToggles />
      </nav>
    </header>
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
