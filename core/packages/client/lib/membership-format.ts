// Display formatters shared across the /membership pages (page + PayModal + AdminPanel).

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
