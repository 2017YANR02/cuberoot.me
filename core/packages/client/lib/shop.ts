import type { PlatformEntity } from './platform-types';
import { commerceRecord as shopRecord } from './platform-commerce-format';
export { commerceRecord as shopRecord } from './platform-commerce-format';

export const SHOP_ROOT = '/shop';
export const SHOP_POSTER = '/images/shop/cuberoot-poster-ced7ef25.svg';
export const SHOP_CATEGORY = 'lifestyle';
export const SHOP_CATEGORIES = [
  { id: SHOP_CATEGORY, zh: 'CubeRoot 周边', en: 'CubeRoot merch' },
] as const;

/** Missing prices are different from an explicitly configured free item. */
export function shopAmount(value: unknown): number | null {
  if ((typeof value !== 'number' && typeof value !== 'string') || (typeof value === 'string' && !value.trim())) return null;
  const amount = Number(value);
  return Number.isSafeInteger(amount) && amount >= 0 ? amount : null;
}

export function shopImage(value: unknown): string | null {
  return typeof value === 'string' && /^(https?:\/\/|\/(?!\/))/.test(value) ? value : null;
}

export function productImages(product: PlatformEntity): string[] {
  const presentation = shopRecord(product.data?.presentation);
  return [...new Set([presentation.imageUrl, ...(Array.isArray(presentation.imageUrls) ? presentation.imageUrls : [])]
    .map(shopImage).filter((url): url is string => !!url))].slice(0, 10);
}

export interface ShopVariant {
  id: string;
  titleZh: string;
  titleEn: string;
  sku: string;
  amountMinor: number | null;
  currency: string;
  available: number;
  purchasable: boolean;
}

export function productVariants(product: PlatformEntity): ShopVariant[] {
  return (Array.isArray(product.data?.variants) ? product.data.variants : []).map(value => {
    const item = shopRecord(value);
    const amountMinor = shopAmount(item.amountMinor);
    const available = Math.max(0, Math.min(99, Math.floor(Number(item.availableQuantity) || 0)));
    const currency = typeof item.currency === 'string' && /^[A-Z]{3}$/.test(item.currency) ? item.currency : '';
    return {
      id: String(item.id ?? ''), sku: String(item.sku ?? ''),
      titleZh: String(item.titleZh || item.titleEn || ''), titleEn: String(item.titleEn || item.titleZh || ''),
      amountMinor, currency, available,
      purchasable: product.status === 'active' && item.status === 'active' && amountMinor !== null && !!currency && available > 0,
    };
  }).filter(item => item.id);
}

export function productHref(product: PlatformEntity): string {
  const slug = String(product.data?.slug || product.id);
  const id = ['cart', 'checkout', 'help'].includes(slug) ? product.id : slug;
  return `${SHOP_ROOT}/${encodeURIComponent(id)}`;
}

export interface CartLine { productId: string; variantId: string; quantity: number }
export const MAX_CART_LINES = 100;

/** Persist references and quantities only; price and inventory always come from the API. */
export function parseCart(raw: string | null): CartLine[] {
  try {
    const value: unknown = JSON.parse(raw ?? '[]');
    if (!Array.isArray(value)) return [];
    const result: CartLine[] = [];
    for (const input of value.slice(0, MAX_CART_LINES)) {
      const row = shopRecord(input);
      if (typeof row.productId !== 'string' || typeof row.variantId !== 'string'
        || !/^[a-zA-Z0-9-]{1,128}$/.test(row.productId) || !/^[a-zA-Z0-9-]{1,128}$/.test(row.variantId)
        || !Number.isInteger(row.quantity) || Number(row.quantity) < 1 || Number(row.quantity) > 99) continue;
      const previous = result.find(item => item.variantId === row.variantId);
      if (previous) previous.quantity = Math.min(99, previous.quantity + Number(row.quantity));
      else result.push({ productId: row.productId, variantId: row.variantId, quantity: Number(row.quantity) });
    }
    return result;
  } catch { return []; }
}

export function purchasedCartRemainder(current: CartLine[], purchased: CartLine[]): CartLine[] {
  return current.map(line => ({ ...line, quantity: line.quantity - (purchased.find(item => item.variantId === line.variantId)?.quantity ?? 0) }))
    .filter(line => line.quantity > 0);
}
