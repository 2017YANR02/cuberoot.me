// Display formatters shared across membership surfaces.

/** Compact display only; retain the original identifier for storage and API calls. */
export function fmtVipId(vipId: string): string {
  return vipId.replace(/^VIP0+(\d+)$/, 'VIP$1');
}

/** Price in minor units (cents) with its currency symbol; integer amounts drop the decimals. */
export function fmtPrice(cents: number, currency: string): string {
  const sym = currency === 'CNY' ? '¥' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '';
  const n = cents / 100;
  return sym + (Number.isInteger(n) ? String(n) : n.toFixed(2));
}

/** ISO timestamp → YYYY-MM-DD (UTC); empty string when null. */
export function fmtDate(iso: string | null): string {
  return iso ? new Date(iso).toISOString().slice(0, 10) : '';
}

/** Older store bridges expose formatted prices only. Omit the badge when either
 * the currency label or the numeric interpretation is ambiguous. */
export function annualStoreSavings(monthly?: string, yearly?: string): number | null {
  function read(price?: string) {
    const match = price?.trim().match(/^([^\d.,+-]*)(\d+(?:[.,]\d{1,2})?)([^\d.,+-]*)$/u);
    if (!match) return null;
    const currency = (match[1] + match[3]).trim();
    return currency ? { currency, amount: Number(match[2].replace(',', '.')) } : null;
  }
  const month = read(monthly);
  const year = read(yearly);
  if (!month || !year || month.currency !== year.currency || month.amount <= 0 || year.amount <= 0) return null;
  const percent = Math.round(100 * (1 - year.amount / (12 * month.amount)));
  return percent > 0 && percent < 100 ? percent : null;
}
