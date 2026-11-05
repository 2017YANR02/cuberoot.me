'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, ChevronDown, LockKeyhole, ShoppingBag, Trash2 } from '@app-foundation/icons/lucide';
import AppLink from '@/components/AppLink';
import { useT } from '@/hooks/useT';
import { useLang } from '@/i18n/tr';
import { nextQuery, useAuthUser } from '@/lib/auth-store';
import { executePlatformAction, loadPlatformResource, localizePlatformEntity } from '@/lib/platform-gateway';
import { createPlatformOrder, quotePlatformOrder, type PlatformQuote } from '@/lib/platform-checkout';
import { PLATFORM_ROUTES } from '@/lib/platform-routes';
import { SHOP_ROOT, productHref, productVariants, type CartLine, type ShopVariant } from '@/lib/shop';
import { removePurchasedShopItems, setShopCartQuantity, useShopCart } from '@/lib/shop-cart';
import type { PlatformActionId, PlatformEntity } from '@/lib/platform-types';
import { PlatformShippingAddressManager } from '@/components/platform/PlatformDomainActions';
import { commerceMoney } from '@/lib/platform-commerce-format';
import { ShopProductImage } from './ShopProductImage';

type ResolvedLine = { line: CartLine; product?: PlatformEntity; variant?: ShopVariant };
const ADDRESS_ROUTE = PLATFORM_ROUTES.find(item => item.id === 'account-shipping')!;
const ATTEMPT_KEY = 'cuberoot.shop.checkout-attempt.v1';

/** Kept through refresh / a lost response; contains IDs, not address or payment details. */
function orderAttempt(signature: string): string {
  try {
    const old = JSON.parse(sessionStorage.getItem(ATTEMPT_KEY) ?? 'null') as { signature?: string; key?: string } | null;
    if (old?.signature === signature && old.key && /^[a-zA-Z0-9-]{1,120}$/.test(old.key)) return old.key;
  } catch { /* Storage can be disabled. The mounted form also retains its key. */ }
  const key = crypto.randomUUID();
  try { sessionStorage.setItem(ATTEMPT_KEY, JSON.stringify({ signature, key })); } catch { /* Use in-memory fallback. */ }
  return key;
}

export function ShopCart({ checkout }: { checkout: boolean }) {
  const t = useT();
  const lang = useLang();
  const cart = useShopCart();
  const [products, setProducts] = useState<Record<string, PlatformEntity>>({});
  const [resolvedKey, setResolvedKey] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const productKey = JSON.stringify([...new Set(cart.map(item => item.productId))].sort());
  useEffect(() => {
    const controller = new AbortController();
    setResolvedKey(null);
    const ids = JSON.parse(productKey) as string[];
    void Promise.allSettled(ids.map(id => loadPlatformResource('products', { params: { id }, signal: controller.signal })))
      .then(results => {
        if (controller.signal.aborted) return;
        const next: Record<string, PlatformEntity> = {};
        results.forEach((result, index) => { if (result.status === 'fulfilled' && result.value.items[0]) next[ids[index]] = result.value.items[0]; });
        setProducts(next); setResolvedKey(productKey);
      });
    return () => controller.abort();
  }, [productKey, revision]);
  // Revalidate on returning from another tab, including catalog/inventory changes.
  useEffect(() => { const refresh = () => setRevision(value => value + 1); window.addEventListener('focus', refresh); return () => window.removeEventListener('focus', refresh); }, []);
  const rows = useMemo<ResolvedLine[]>(() => cart.map(line => {
    const product = products[line.productId] ? localizePlatformEntity(products[line.productId], lang) : undefined;
    return { line, product, variant: product && productVariants(product).find(item => item.id === line.variantId) };
  }), [cart, products, lang]);
  const loading = resolvedKey !== productKey;
  const invalid = rows.some(({ line, product, variant }) => !product || !variant?.purchasable || line.quantity > variant.available);
  const currencies = new Set(rows.map(row => row.variant?.currency).filter(Boolean));
  const mixedCurrency = currencies.size > 1;
  const currency = rows[0]?.variant?.currency ?? '';
  const subtotal = rows.reduce((total, { line, variant }) => total + (variant?.amountMinor ?? 0) * line.quantity, 0);
  const valid = cart.length > 0 && !loading && !invalid && !mixedCurrency && Number.isSafeInteger(subtotal);
  const physical = rows.some(row => row.product?.data?.productType === 'physical');
  return <section className="shop-cart-page">
    <AppLink href={checkout ? `${SHOP_ROOT}/cart` : SHOP_ROOT} className="shop-back" prefetch={false}>{checkout ? t('返回购物车', 'Back to bag') : t('继续逛逛', 'Continue shopping')}</AppLink>
    <header className="shop-section-heading"><div><h1>{checkout ? t('结算', 'Checkout') : t('购物车', 'Your bag')}<small>{cart.reduce((sum, line) => sum + line.quantity, 0)}</small></h1></div></header>
    {!cart.length ? <div className="shop-empty"><ShoppingBag size={42} strokeWidth={1.1} aria-hidden /><h2>{t('购物车还是空的', 'Your bag is empty')}</h2><AppLink className="shop-button shop-button-primary" href={SHOP_ROOT} prefetch={false}>{t('去逛逛', 'Explore the shop')}<ArrowRight size={17} aria-hidden /></AppLink></div> : <div className="shop-cart-layout"><div>
      <div className="shop-cart-lines" aria-busy={loading}>{rows.map(({ line, product, variant }) => <article key={line.variantId} className="shop-cart-line">
        {product ? <AppLink href={productHref(product)} prefetch={false}><ShopProductImage product={product} /></AppLink> : <div className="shop-product-image"><ShoppingBag size={28} aria-hidden /></div>}
        <div className="shop-cart-line-info"><h2>{product ? <AppLink href={productHref(product)} prefetch={false}>{product.title}</AppLink> : loading ? t('正在读取商品…', 'Loading product…') : t('商品暂不可用', 'Product unavailable')}</h2>{variant && <p>{t(variant.titleZh, variant.titleEn)}</p>}
          {!loading && (!variant?.purchasable || line.quantity > variant.available) && <p className="shop-error">{!product ? t('读取失败或商品已下架，请重试或移除。', 'Could not load this product. Retry or remove it.') : !variant?.purchasable ? t('此规格当前不可购买，请移除或重新选择。', 'This variant is unavailable. Remove it or choose another.') : t(`当前最多可购买 ${variant.available} 件，请调整数量。`, `Only ${variant.available} available. Please reduce the quantity.`)}</p>}
          <div className="shop-cart-line-actions"><label className="shop-quantity"><span>{t('数量', 'Quantity')}</span><input className="shop-control shop-quantity-input" type="number" min={1} max={variant?.available || 99} step={1} value={line.quantity} disabled={loading} onChange={event => { const value = Number(event.target.value); if (value >= 1) setShopCartQuantity(line.variantId, value); }} /></label><button className="shop-control shop-icon-button" type="button" aria-label={t(`移除 ${product?.title ?? '商品'}`, `Remove ${product?.title ?? 'item'}`)} onClick={() => setShopCartQuantity(line.variantId, 0)}><Trash2 size={18} aria-hidden /></button></div>
        </div><strong className="shop-line-total">{variant?.amountMinor != null ? commerceMoney(variant.amountMinor * line.quantity, variant.currency) : '—'}</strong>
      </article>)}</div>
      {!loading && invalid && <button className="shop-control shop-text-link" onClick={() => setRevision(value => value + 1)}>{t('重新核对商品与库存', 'Refresh products and stock')}</button>}
      {mixedCurrency && <p className="shop-error" role="alert">{t('不同币种的商品需分开结算。请先移除其他币种的商品。', 'Products in different currencies need separate orders. Remove the other currency to continue.')}</p>}
      {checkout && <CheckoutForm key={lang} cart={cart} valid={valid} physical={physical} />}
    </div><aside className="shop-order-summary" data-site-surface="panel"><h2>{t('购物袋小计', 'Bag subtotal')}</h2><div><span>{t('商品金额', 'Products')}</span><strong>{valid ? commerceMoney(subtotal, currency) : '—'}</strong></div><p>{t('优惠与最终应付金额在结算时确认。', 'Discounts and the final amount are confirmed at checkout.')}</p>{!checkout && (valid ? <AppLink className="shop-button shop-button-primary" href={`${SHOP_ROOT}/checkout`} prefetch={false}>{t('前往结算', 'Continue to checkout')}<ArrowRight size={18} aria-hidden /></AppLink> : <button className="shop-control shop-button shop-button-primary" disabled>{loading ? t('核对商品中…', 'Checking products…') : t('请先处理购物车中的商品', 'Review your bag to continue')}</button>)}<span className="shop-summary-note"><LockKeyhole size={14} aria-hidden />{t('订单页确认支付结果', 'Payment status in your orders')}</span></aside></div>}
  </section>;
}

function CheckoutForm({ cart, valid, physical }: { cart: CartLine[]; valid: boolean; physical: boolean }) {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const user = useAuthUser();
  const userKey = user ? String(user.uid ?? user.wcaId ?? '') : '';
  const [addresses, setAddresses] = useState<PlatformEntity[]>([]);
  const [addressId, setAddressId] = useState('');
  const [coupon, setCoupon] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [quote, setQuote] = useState<{ value: PlatformQuote; signature: string } | null>(null);
  const request = useRef<AbortController | null>(null);
  const submitting = useRef(false);
  const attempt = useRef<{ signature: string; key: string } | null>(null);
  const payload = { items: cart.map(line => ({ productVariantId: line.variantId, quantity: line.quantity })), ...(coupon.trim() ? { couponCode: coupon.trim() } : {}), ...(physical && addressId ? { shippingAddressId: addressId } : {}) };
  const signature = JSON.stringify({ userKey, ...payload });
  const signatureRef = useRef(signature);
  signatureRef.current = signature;
  const addressValid = !physical || addresses.some(item => item.id === addressId);
  const canQuote = valid && !!user && addressValid;
  const confirmed = quote?.signature === signature && canQuote;
  useEffect(() => {
    request.current?.abort(); setQuote(null); setError('');
    setBusy(previous => previous === 'quote' ? null : previous);
    return () => request.current?.abort();
  }, [signature, valid]);
  useEffect(() => { setAddresses([]); setAddressId(''); }, [userKey]);
  useEffect(() => { if (!addresses.some(item => item.id === addressId)) setAddressId(addresses.find(item => item.data?.isDefault)?.id ?? addresses[0]?.id ?? ''); }, [addresses, addressId]);
  const acceptAddresses = useCallback((items: PlatformEntity[]) => setAddresses(items), []);
  const addressAction = async (action: PlatformActionId, id?: string, input?: Record<string, unknown>) => {
    if (submitting.current) return;
    setBusy(action); setError(''); setQuote(null);
    try { return await executePlatformAction(ADDRESS_ROUTE, { action, resourceId: id, payload: input }); }
    catch (reason) { setError(reason instanceof Error ? reason.message : t('地址保存失败', 'Could not save the address')); }
    finally { setBusy(null); }
  };
  async function review() {
    if (!canQuote || busy) return;
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    setBusy('quote'); setError(''); setQuote(null);
    const requestedSignature = signature;
    try {
      const result = await quotePlatformOrder(payload.items, coupon, controller.signal);
      if (!controller.signal.aborted && signatureRef.current === requestedSignature) setQuote({ value: result, signature: requestedSignature });
    } catch (reason) { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : t('金额确认失败，请重试。', 'Could not confirm the total. Try again.')); }
    finally { if (!controller.signal.aborted) setBusy(null); }
  }
  async function placeOrder() {
    if (!confirmed || submitting.current || busy) return;
    submitting.current = true; setBusy('order'); setError('');
    if (attempt.current?.signature !== signature) attempt.current = { signature, key: orderAttempt(signature) };
    try {
      const result = await createPlatformOrder(payload, attempt.current.key);
      const id = result.orderId ?? result.id;
      if (!id) throw new Error(t('无法确认订单结果，请重试或查看我的订单。', 'Could not confirm the order. Retry or check your orders.'));
      removePurchasedShopItems(cart);
      try { sessionStorage.removeItem(ATTEMPT_KEY); } catch { /* Optional persistence. */ }
      router.push(`${lang === 'zh' ? '/zh' : ''}/platform/orders/${encodeURIComponent(id)}`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : t('订单未确认，请重试。', 'Order not confirmed. Please retry.')); }
    finally { submitting.current = false; setBusy(null); }
  }
  if (!user) return <div className="shop-checkout-login" data-site-surface="panel"><h2>{t('登录后继续结算', 'Sign in to checkout')}</h2><p>{t('购物车会保留在此浏览器中。', 'Your bag will stay in this browser.')}</p><AppLink className="shop-button shop-button-primary" href={`/account${nextQuery(`${lang === 'zh' ? '/zh' : ''}${SHOP_ROOT}/checkout`)}`} prefetch={false}>{t('登录 CubeRoot', 'Sign in to CubeRoot')}<ArrowRight size={17} aria-hidden /></AppLink></div>;
  return <section className="shop-checkout-form"><fieldset disabled={busy === 'order'}>
    {physical && <section><h2><span>01</span>{t('收货地址', 'Shipping address')}</h2>{addresses.length > 0 && <div className="shop-addresses">{addresses.map(item => { const data = item.data ?? {}; return <label key={item.id} className="shop-address" data-selected={item.id === addressId}><input className="shop-control shop-address-input" type="radio" name="shipping-address" checked={item.id === addressId} onChange={() => setAddressId(item.id)} /><span><strong>{String(data.recipientName ?? item.title)} · {String(data.phone ?? '')}</strong><span>{[data.countryCode, data.region, data.city, data.addressLine1, data.addressLine2, data.postalCode].filter(Boolean).join(' ')}</span></span></label>; })}</div>}
      <details className="shop-disclosure" open={addresses.length === 0 ? true : undefined}><summary>{addresses.length ? t('新增或管理地址', 'Add or manage addresses') : t('添加收货地址', 'Add a shipping address')}<ChevronDown size={18} aria-hidden /></summary><PlatformShippingAddressManager key={userKey} definition={ADDRESS_ROUTE} params={{}} busy={busy} runAction={addressAction} onAddresses={acceptAddresses} /></details>
    </section>}
    <section><h2><span>{physical ? '02' : '01'}</span>{t('确认金额', 'Review your total')}</h2><label className="shop-coupon"><span>{t('优惠码（选填）', 'Coupon code (optional)')}</span><input className="shop-control shop-coupon-input" value={coupon} onChange={event => setCoupon(event.target.value)} maxLength={64} autoCapitalize="characters" autoComplete="off" /></label><button type="button" className="shop-control shop-button" disabled={!canQuote || !!busy} onClick={() => { void review(); }}>{busy === 'quote' ? t('正在确认…', 'Confirming…') : t('确认金额与优惠', 'Confirm total & discounts')}</button>
      {confirmed && quote && <div className="shop-quote" aria-live="polite"><div><span>{t('商品金额', 'Subtotal')}</span><span>{commerceMoney(quote.value.subtotalAmountMinor, quote.value.currency)}</span></div><div><span>{t('优惠', 'Discount')}</span><span>−{commerceMoney(quote.value.discountAmountMinor, quote.value.currency)}</span></div><div className="shop-quote-total"><strong>{t('应付金额', 'Total')}</strong><strong>{commerceMoney(quote.value.totalAmountMinor, quote.value.currency)}</strong></div>{quote.value.member && <p>{t('已应用课程会员价格。', 'Course membership pricing applied.')}</p>}</div>}
      <button type="button" className="shop-control shop-button shop-button-primary shop-checkout-submit" disabled={!confirmed || !!busy} onClick={() => { void placeOrder(); }}>{busy === 'order' ? t('正在创建订单…', 'Placing order…') : quote ? t(`提交订单并支付 ${commerceMoney(quote.value.totalAmountMinor, quote.value.currency)}`, `Place order & pay ${commerceMoney(quote.value.totalAmountMinor, quote.value.currency)}`) : t('提交订单并支付', 'Place order & pay')}<ArrowRight size={22} aria-hidden /></button>
    </section></fieldset>{error && <p className="shop-error" role="alert">{error}</p>}<p className="shop-muted">{t('支付前可在订单页核对金额。', 'Review the amount on the order page before paying.')}</p>
  </section>;
}
