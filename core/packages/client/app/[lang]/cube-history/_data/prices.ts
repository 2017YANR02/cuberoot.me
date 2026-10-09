import type { CubePrice, LocalizedText, PriceMarket } from './types';

/** Keep market currencies separate; never choose a quote by comparing unlike amounts. */
export function sortedPrices(prices: readonly CubePrice[]): CubePrice[] {
  const priority = (price: CubePrice) => price.kind === 'launch' ? 0 : price.region === 'CN' ? 1 : 2;
  return [...prices].sort((a, b) => priority(a) - priority(b)
    || (b.asOf ?? '').localeCompare(a.asOf ?? '', 'en')
    || a.sourceId.localeCompare(b.sourceId, 'en'));
}

export function preferredPrice(prices: readonly CubePrice[]): CubePrice | undefined {
  return sortedPrices(prices)[0];
}

export function priceLabel(price: CubePrice): LocalizedText {
  if (price.kind === 'launch') return { zh: '中国首发价', en: 'China launch price' };
  return price.region === 'CN'
    ? { zh: '当前参考价', en: 'Current reference price' }
    : { zh: '海外当前参考价', en: 'Current overseas price' };
}

export function priceAmount(price: CubePrice): string {
  const symbols = { CNY: '¥', USD: 'US$', EUR: '€', GBP: '£' };
  return symbols[price.currency] + price.amount.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

export const PRICE_MARKETS: Record<PriceMarket, LocalizedText> = {
  CN: { zh: '中国大陆', en: 'Mainland China' },
  US: { zh: '美国', en: 'United States' },
  UK: { zh: '英国', en: 'United Kingdom' },
  EU: { zh: '欧盟', en: 'European Union' },
  INTL: { zh: '国际站', en: 'International store' },
};
