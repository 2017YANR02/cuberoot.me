import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseCart, productHref, productVariants, purchasedCartRemainder, shopAmount } from '@/lib/shop';
import { createPlatformOrder, quotePlatformOrder } from '@/lib/platform-checkout';
import { matchPlatformRoute } from '@/lib/platform-routes';
import { addToShopCart } from '@/lib/shop-cart';
import { loadPlatformResource } from '@/lib/platform-gateway';
import { SHOP_DESIGNS, shopDesignPreview } from '@/lib/shop-designs';

vi.mock('@/lib/admin-api', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/admin-api')>(), authHeaders: () => ({ 'Content-Type': 'application/json' }) }));
vi.mock('@/lib/session-fetch', () => ({ sessionFetch: (...args: Parameters<typeof fetch>) => fetch(...args) }));
afterEach(() => vi.unstubAllGlobals());

describe('shop pricing and cart boundaries', () => {
  it('keeps artwork previews out of purchasing until commerce supplies variants', () => {
    for (const design of SHOP_DESIGNS) {
      const preview = shopDesignPreview(design);
      expect(preview.status).toBe('preview');
      expect(productVariants(preview)).toEqual([]);
      expect(shopAmount(preview.data?.fromAmountMinor)).toBeNull();
      expect(productHref(preview)).toBe(`/shop/${design.slug}`);
    }
  });
  it('distinguishes a missing commerce product from a failed request', async () => {
    const mocked = vi.fn()
      .mockResolvedValueOnce(new Response('{}', { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Unavailable' }), { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ product: { id: 'real-id', slug: 'cubetown-mat', titleEn: 'Cubetown', status: 'active', variants: [{ id: 'real-variant', status: 'active', amountMinor: 5800, currency: 'CNY', availableQuantity: 3 }] } }), { status: 200 }));
    vi.stubGlobal('fetch', mocked);
    expect((await loadPlatformResource('products', { params: { id: 'cubetown-mat' } })).items).toEqual([]);
    await expect(loadPlatformResource('products', { params: { id: 'cubetown-mat' } })).rejects.toThrow('Unavailable');
    const live = (await loadPlatformResource('products', { params: { id: 'cubetown-mat' } })).items[0];
    expect(live.id).toBe('real-id');
    expect(productVariants(live)[0].purchasable).toBe(true);
  });
  it('never turns an unset price into a free item', () => {
    expect([null, undefined, '', false, -1, 'abc', 1.5].map(shopAmount)).toEqual([null, null, null, null, null, null, null]);
    expect(shopAmount(0)).toBe(0);
    expect(shopAmount('1990')).toBe(1990);
    const variants = productVariants({ id: 'product', title: '', status: 'active', data: { variants: [
      { id: 'unpriced', status: 'active', availableQuantity: 10, currency: 'CNY', amountMinor: null },
      { id: 'sold', status: 'sold_out', availableQuantity: 10, currency: 'CNY', amountMinor: 1990 },
      { id: 'no-stock', status: 'active', availableQuantity: 0, currency: 'CNY', amountMinor: 1990 },
      { id: 'ready', status: 'active', availableQuantity: 4, currency: 'CNY', amountMinor: 1990 },
    ] } });
    expect(variants.map(item => item.purchasable)).toEqual([false, false, false, true]);
  });
  it('rejects corrupt storage, discards client prices, and merges duplicate variants', () => {
    expect(parseCart('{broken')).toEqual([]);
    expect(parseCart(JSON.stringify([
      { productId: 'p1', variantId: 'v1', quantity: 2, amountMinor: 1, status: 'active' },
      { productId: 'p1', variantId: 'v1', quantity: 3 },
      { productId: 'p2', variantId: 'v2', quantity: -1 },
      { productId: '../invalid', variantId: 'v3', quantity: 1 },
    ]))).toEqual([{ productId: 'p1', variantId: 'v1', quantity: 5 }]);
  });
  it('only removes purchased quantities, preserving items added while an order was in flight', () => {
    expect(purchasedCartRemainder([{ productId: 'p1', variantId: 'v1', quantity: 3 }, { productId: 'p2', variantId: 'v2', quantity: 1 }], [{ productId: 'p1', variantId: 'v1', quantity: 2 }]))
      .toEqual([{ productId: 'p1', variantId: 'v1', quantity: 1 }, { productId: 'p2', variantId: 'v2', quantity: 1 }]);
  });
  it('does not resurrect a cart cleared by another tab', () => {
    const storage = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) });
    vi.stubGlobal('window', new EventTarget());
    expect(addToShopCart({ productId: 'p1', variantId: 'v1', quantity: 2 }, 5)).toBe(true);
    storage.clear();
    expect(addToShopCart({ productId: 'p1', variantId: 'v1', quantity: 1 }, 5)).toBe(true);
    expect(parseCart(storage.get('cuberoot.shop.cart.v1') ?? null)).toEqual([{ productId: 'p1', variantId: 'v1', quantity: 1 }]);
  });
  it('reserves cart, checkout and help URLs ahead of product identifiers', () => {
    expect(['cart','checkout','help'].map(id => matchPlatformRoute(['shop', id])?.definition.id)).toEqual(['shop-cart','shop-checkout','shop-help']);
    expect(matchPlatformRoute(['shop', 'my-product'])?.definition.id).toBe('product-detail');
    expect(productHref({ id: 'product-1', title: '', data: { slug: 'cart' } })).toBe('/shop/product-1');
  });
});

describe('shop checkout API', () => {
  it('quotes multiple variants and keeps the same creation key after a lost response', async () => {
    const calls: RequestInit[] = [];
    const mocked = vi.fn(async (_input: unknown, init: RequestInit = {}) => { calls.push(init); return new Response(JSON.stringify({ id: 'order-1', currency: 'CNY', totalAmountMinor: 5000 }), { status: 200 }); });
    vi.stubGlobal('fetch', mocked);
    const items = [{ productVariantId: 'v1', quantity: 2 }, { productVariantId: 'v2', quantity: 1 }];
    await quotePlatformOrder(items, 'SAVE');
    const payload = { items, couponCode: 'SAVE', shippingAddressId: 'address-1' };
    await createPlatformOrder(payload, 'same-attempt-key');
    await createPlatformOrder(payload, 'same-attempt-key');
    expect(JSON.parse(String(calls[0].body))).toEqual({ items, couponCode: 'SAVE' });
    expect(calls[1].headers).toEqual(calls[2].headers);
    expect(new Headers(calls[1].headers).get('Idempotency-Key')).toBe('same-attempt-key');
    expect(calls[1].body).toBe(calls[2].body);
    expect(JSON.parse(String(calls[1].body))).toEqual(payload);
  });
});
